import {
  arrayUnion,
  collection,
  doc,
  increment,
  onSnapshot,
  query,
  where,
  writeBatch,
} from "firebase/firestore";
import {
  equalTo,
  get,
  onValue,
  orderByChild,
  query as rtdbQuery,
  ref,
  remove,
  serverTimestamp,
  set,
  update,
} from "firebase/database";
import { dataStore, normalizeState } from "./localStore";
import { firestoreDb, hasSignedInUser, realtimeDb } from "./firebaseClient";

const HOUSEHOLD_COLLECTION = "household";
const SYSTEM_DOC_ID = "config";
const INITIAL_LOAD_TIMEOUT_MS = 20000;

// Numeric fields written with increment() so concurrent updates don't overwrite each other.
const USER_COUNTER_FIELDS = new Set([
  "weightKg",
  "recycledItemCount",
  "totalRecycledWeightKg",
]);
const SYSTEM_COUNTER_FIELDS = new Set([
  "riceStock",
  "bottleStorage",
  "totalItemsRecycled",
  "totalWeightRecycledKg",
]);
// Live hardware readings come from the Realtime Database and are never written to Firestore.
const SYSTEM_LOCAL_ONLY_FIELDS = new Set(["hardwareBins"]);

let syncMode = "local";
let session = null;
let applyingRemote = false;

export function getSyncMode() {
  return syncMode;
}

// Data sources that failed to load, so pages can say so instead of showing an empty list.
export function getSyncErrors() {
  return session ? [...session.loadErrors] : [];
}

const roundToThree = (value) => Math.round(value * 1000) / 1000;
const sameValue = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const byIdMap = (items) => new Map(items.map((item) => [item.id, item]));

const sortByKeyDesc = (items, key) =>
  items.sort((a, b) => String(b[key] || "").localeCompare(String(a[key] || "")));

const mergeParts = (parts) => {
  const merged = new Map();
  Object.values(parts).forEach((items) =>
    items.forEach((item) => merged.set(item.id, item))
  );
  return [...merged.values()];
};

const snapshotItems = (snapshot) => {
  if ("docs" in snapshot) {
    return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  }
  return snapshot.exists() ? [{ id: snapshot.id, ...snapshot.data() }] : [];
};

const buildStateFromRemote = () => {
  const { parts, hardwareStatus } = session;
  const systemDoc = mergeParts(parts.system)[0] || null;
  let system;
  if (systemDoc) {
    const { id, ...systemData } = systemDoc;
    system = systemData;
  }

  const normalized = normalizeState({
    users: sortByKeyDesc(mergeParts(parts.users), "createdAt"),
    transactions: sortByKeyDesc(mergeParts(parts.transactions), "timestamp"),
    notifications: sortByKeyDesc(mergeParts(parts.notifications), "createdAt"),
    system,
  });
  normalized.system = { ...normalized.system, hardwareBins: hardwareStatus };
  return { normalized, systemExists: Boolean(systemDoc) };
};

const applyRemoteToLocal = () => {
  if (!session || session.pending.size > 0) return;

  const { normalized, systemExists } = buildStateFromRemote();
  session.systemExists = systemExists;

  applyingRemote = true;
  dataStore.replaceRawState(normalized);
  applyingRemote = false;
  session.baseline = dataStore.getRawState();

  if (session.resolveInitialLoad) {
    const resolve = session.resolveInitialLoad;
    session.resolveInitialLoad = null;
    resolve();
  }
};

const listen = (key, part, source) => {
  const current = session;
  const readyKey = `${key}:${part}`;
  current.parts[key][part] = [];
  current.pending.add(readyKey);

  const unsubscribe = onSnapshot(
    source,
    (snapshot) => {
      if (session !== current) return;
      current.parts[key][part] = snapshotItems(snapshot);
      current.loadErrors.delete(readyKey);
      current.pending.delete(readyKey);
      applyRemoteToLocal();
    },
    (error) => {
      if (session !== current) return;
      console.error(`Firestore listener error (${readyKey}):`, error);
      current.loadErrors.add(readyKey);
      current.parts[key][part] = [];
      current.pending.delete(readyKey);
      applyRemoteToLocal();
    }
  );
  current.unsubscribers.push(unsubscribe);
};

// Builds a Firestore update payload for the fields that differ between two versions of a doc.
const fieldChanges = (before, after, counterFields, skipFields = new Set()) => {
  const changes = {};
  Object.keys(after).forEach((field) => {
    if (field === "id" || skipFields.has(field)) return;
    if (sameValue(before[field], after[field])) return;

    if (
      counterFields.has(field) &&
      typeof before[field] === "number" &&
      typeof after[field] === "number"
    ) {
      changes[field] = increment(roundToThree(after[field] - before[field]));
      return;
    }

    if (field === "readBy" && Array.isArray(before.readBy) && Array.isArray(after.readBy)) {
      const added = after.readBy.filter((id) => !before.readBy.includes(id));
      if (added.length > 0) changes.readBy = arrayUnion(...added);
      return;
    }

    changes[field] = after[field];
  });
  return changes;
};

const toDocData = (item) => {
  const { id, password, ...data } = item;
  return data;
};

// Turns a local state change into the minimal set of Firestore writes.
const diffToBatch = (before, after) => {
  const batch = writeBatch(firestoreDb);
  let opCount = 0;

  const diffCollection = (collectionName, beforeItems, afterItems, counterFields, allowDelete) => {
    const beforeMap = byIdMap(beforeItems);
    const afterMap = byIdMap(afterItems);

    afterMap.forEach((item, id) => {
      const docRef = doc(firestoreDb, collectionName, id);
      const previous = beforeMap.get(id);
      if (!previous) {
        batch.set(docRef, toDocData(item));
        opCount += 1;
        return;
      }
      const changes = fieldChanges(previous, item, counterFields);
      if (Object.keys(changes).length > 0) {
        batch.update(docRef, changes);
        opCount += 1;
      }
    });

    if (allowDelete) {
      beforeMap.forEach((item, id) => {
        if (!afterMap.has(id)) {
          batch.delete(doc(firestoreDb, collectionName, id));
          opCount += 1;
        }
      });
    }
  };

  const isAdmin = session.role === "admin";
  diffCollection(
    HOUSEHOLD_COLLECTION,
    before.users.filter((user) => user.role === "user"),
    after.users.filter((user) => user.role === "user"),
    USER_COUNTER_FIELDS,
    isAdmin
  );
  diffCollection("transactions", before.transactions, after.transactions, new Set(), false);
  diffCollection("notifications", before.notifications, after.notifications, new Set(), false);

  const systemRef = doc(firestoreDb, "system", SYSTEM_DOC_ID);
  if (!session.systemExists && isAdmin) {
    const systemData = { ...after.system };
    SYSTEM_LOCAL_ONLY_FIELDS.forEach((field) => delete systemData[field]);
    batch.set(systemRef, systemData);
    session.systemExists = true;
    opCount += 1;
  } else if (session.systemExists) {
    const changes = fieldChanges(
      before.system,
      after.system,
      SYSTEM_COUNTER_FIELDS,
      SYSTEM_LOCAL_ONLY_FIELDS
    );
    if (Object.keys(changes).length > 0) {
      batch.update(systemRef, changes);
      opCount += 1;
    }
  }

  return opCount > 0 ? batch : null;
};

const handleLocalChange = (rawState) => {
  if (applyingRemote || !session?.baseline) return;

  const batch = diffToBatch(session.baseline, rawState);
  session.baseline = rawState;
  if (!batch) return;

  session.lastWrite = batch.commit().then(
    () => ({ ok: true }),
    (error) => {
      console.error("Firestore write rejected:", error);
      return {
        ok: false,
        error:
          error.code === "permission-denied"
            ? "You don't have permission to make this change."
            : error.message,
      };
    }
  );
};

// Waits for the most recent local change to reach Firestore.
export function flushWrites() {
  return session?.lastWrite || Promise.resolve({ ok: true });
}

const processedBinEvents = new Set();

const processBinEvent = async (event) => {
  if (processedBinEvents.has(event.id)) return;
  processedBinEvents.add(event.id);

  try {
    await update(ref(realtimeDb, `bin_events/${event.id}`), {
      processed: true,
    });
  } catch (err) {
    processedBinEvents.delete(event.id);
    console.error("processBinEvent error:", err);
  }
};

const startAdminHardwareListeners = () => {
  if (!realtimeDb) return;
  const current = session;

  current.unsubscribers.push(
    onValue(
      rtdbQuery(ref(realtimeDb, "bin_events"), orderByChild("processed"), equalTo(false)),
      (snapshot) => {
        if (!snapshot.exists()) return;
        snapshot.forEach((child) => {
          processBinEvent({ id: child.key, ...child.val() });
        });
      },
      (error) => console.error("bin_events listener error:", error)
    )
  );

  current.unsubscribers.push(
    onValue(
      ref(realtimeDb, "bin_status"),
      (snapshot) => {
        if (session !== current) return;
        current.hardwareStatus = snapshot.exists() ? snapshot.val() : {};
        current.loadErrors.delete("bin_status");
        applyRemoteToLocal();
      },
      (error) => {
        console.error("bin_status listener error:", error);
        if (session !== current) return;
        current.loadErrors.add("bin_status");
        applyRemoteToLocal();
      }
    )
  );
};

export function stopCloudSync() {
  if (!session) return;
  session.unsubscribers.forEach((unsubscribe) => unsubscribe());
  session = null;
  syncMode = "local";

  applyingRemote = true;
  dataStore.replaceRawState({});
  applyingRemote = false;
}

// Starts role-scoped listeners for a signed-in user. Resolves once the first
// snapshot of every listener has arrived.
export async function startCloudSync({ uid, role }) {
  if (!firestoreDb) {
    return { ok: false, error: "Firebase is not configured." };
  }

  stopCloudSync();

  session = {
    uid,
    role,
    parts: { users: {}, transactions: {}, notifications: {}, system: {} },
    pending: new Set(),
    hardwareStatus: {},
    // Data sources that failed to load, e.g. "users:all" or "bin_status".
    loadErrors: new Set(),
    unsubscribers: [],
    baseline: null,
    systemExists: false,
    lastWrite: null,
    resolveInitialLoad: null,
  };
  const current = session;
  const initialLoad = new Promise((resolve) => {
    current.resolveInitialLoad = resolve;
  });

  if (role === "admin") {
    listen("users", "all", collection(firestoreDb, HOUSEHOLD_COLLECTION));
    listen("transactions", "all", collection(firestoreDb, "transactions"));
    listen("notifications", "all", collection(firestoreDb, "notifications"));
    startAdminHardwareListeners();
  } else {
    listen("users", "self", doc(firestoreDb, HOUSEHOLD_COLLECTION, uid));
    listen(
      "transactions",
      "self",
      query(collection(firestoreDb, "transactions"), where("userId", "==", uid))
    );
    listen(
      "notifications",
      "direct",
      query(collection(firestoreDb, "notifications"), where("userId", "==", uid))
    );
    listen(
      "notifications",
      "broadcast",
      query(
        collection(firestoreDb, "notifications"),
        where("userId", "==", null),
        where("targetRole", "in", ["all", "user"])
      )
    );
  }
  listen("system", "config", doc(firestoreDb, "system", SYSTEM_DOC_ID));

  let timeoutId;
  const loaded = await Promise.race([
    initialLoad.then(() => true),
    new Promise((resolve) => {
      timeoutId = setTimeout(() => resolve(false), INITIAL_LOAD_TIMEOUT_MS);
    }),
  ]);
  clearTimeout(timeoutId);

  if (session !== current) {
    return { ok: false, error: "Sign-in was interrupted." };
  }
  if (!loaded) {
    stopCloudSync();
    return { ok: false, error: "Could not reach the server. Check your connection." };
  }

  if (role !== "admin" && current.parts.users.self.length === 0) {
    stopCloudSync();
    return {
      ok: false,
      error: "No resident profile is linked to this login. Contact the admin.",
    };
  }

  current.unsubscribers.push(dataStore.subscribeRaw(handleLocalChange));
  syncMode = "firebase";

  // First admin login on an empty project: create system/config with defaults.
  if (role === "admin" && !current.systemExists) {
    handleLocalChange({
      ...current.baseline,
      system: { ...current.baseline.system },
    });
  }

  return { ok: true };
}

// Residents need a marker in the Realtime Database so its rules can recognise them.
export async function setResidentFlag(uid, enabled) {
  if (!realtimeDb) return { ok: false, error: "Firebase not configured." };
  try {
    const flagRef = ref(realtimeDb, `residents/${uid}`);
    if (enabled) {
      await set(flagRef, true);
    } else {
      await remove(flagRef);
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// Returns true if the bin is currently locked by a DIFFERENT user.
// "waiting" and "active" are the two locked states; everything else is free.
// The Realtime Database rules enforce the same lock server-side.
export async function isBinInUse(binId, requestingUserId) {
  if (!realtimeDb || !hasSignedInUser()) return false;
  try {
    const snapshot = await get(ref(realtimeDb, `bin_commands/${binId}`));
    if (!snapshot.exists()) return false;
    const { status, userId } = snapshot.val();
    return ["waiting", "active"].includes(status) && userId !== requestingUserId;
  } catch {
    return false; // the write below is still checked by the database rules
  }
}

const notSignedInError = {
  ok: false,
  error: "You are signed out. Sign in again to use the bin.",
};

const commandError = (err) => ({
  ok: false,
  error:
    err?.code === "PERMISSION_DENIED"
      ? "This bin is in use by another resident. Please wait."
      : err?.message || "Command failed.",
});

// Called by UI when a user requests a bottle insert.
// Writes "waiting" to RTDB; the ESP32 polls and activates.
export async function writeBinCommand(binId, userId, userName) {
  if (!realtimeDb) {
    return { ok: false, error: "Firebase not configured." };
  }
  if (!hasSignedInUser()) return notSignedInError;
  try {
    await set(ref(realtimeDb, `bin_commands/${binId}`), {
      binId,
      userId,
      userName,
      status: "waiting",
      requestedAt: new Date().toISOString(),
      updatedAtMs: serverTimestamp(),
      weightKg: 0,
      lastWeightKg: 0,
      acceptedCount: 0,
      lastAcceptedAt: "",
      lastValidationStatus: "ready",
      lastValidationMessage: "",
      lastValidationAt: "",
    });
    return { ok: true };
  } catch (err) {
    return commandError(err);
  }
}

// Cancels an in-progress bin command (user clicked Cancel).
export async function cancelBinCommand(binId) {
  if (!realtimeDb) return { ok: false };
  if (!hasSignedInUser()) return notSignedInError;
  try {
    await update(ref(realtimeDb, `bin_commands/${binId}`), {
      status: "idle",
      updatedAtMs: serverTimestamp(),
    });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

// Triggers the rice dispenser on a bin after a successful redemption.
// The ESP32 polls this and opens/closes the dispenser servo.
export async function writeRiceCommand(binId, userId, userName, amountKg) {
  if (!realtimeDb) {
    return { ok: false, error: "Firebase not configured." };
  }
  if (!hasSignedInUser()) return notSignedInError;
  try {
    await set(ref(realtimeDb, `rice_commands/${binId}`), {
      binId,
      userId,
      userName,
      amountKg,
      status: "dispensing",
      requestedAt: new Date().toISOString(),
      updatedAtMs: serverTimestamp(),
      dispensedKg: 0,
      lastDispenseAt: "",
      message: "",
    });
    return { ok: true };
  } catch (err) {
    return commandError(err);
  }
}
