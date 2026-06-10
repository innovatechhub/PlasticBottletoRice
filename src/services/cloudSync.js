import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
} from "firebase/firestore";
import {
  equalTo,
  get,
  onValue,
  orderByChild,
  query as rtdbQuery,
  ref,
  set,
  update,
} from "firebase/database";
import { dataStore, normalizeState } from "./localStore";
import {
  ensureFirebaseSession,
  firestoreDb,
  realtimeDb,
  isFirebaseConfigured,
} from "./firebaseClient";

const stableHash = (value) => JSON.stringify(value);
const HOUSEHOLD_COLLECTION = "household";
const LEGACY_HOUSEHOLD_PATH = "users";

let started = false;
let syncMode = "local";
let applyingRemote = false;
let lastSyncedHash = "";
let writeChain = Promise.resolve();

const processedBinEvents = new Set();

const remoteSnapshotState = {
  users: [],
  transactions: [],
  notifications: [],
  system: null,
};

const remoteIdSets = {
  users: new Set(),
  transactions: new Set(),
  notifications: new Set(),
};

const ready = {
  users: false,
  transactions: false,
  notifications: false,
  system: false,
};

export function getSyncMode() {
  return syncMode;
}

const objectToSortedArray = (val, sortKey = "createdAt") => {
  if (!val) return [];
  return Object.entries(val)
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) =>
      String(b[sortKey] || "").localeCompare(String(a[sortKey] || ""))
    );
};

const docsToSortedArray = (snapshot, sortKey = "createdAt") => {
  if (!snapshot || snapshot.empty) return [];
  return snapshot.docs
    .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
    .sort((a, b) =>
      String(b[sortKey] || "").localeCompare(String(a[sortKey] || ""))
    );
};

const setRemoteState = (type, items) => {
  remoteSnapshotState[type] = items;
  if (type !== "system") {
    remoteIdSets[type] = new Set(items.map((item) => item.id));
  }
  ready[type] = true;
};

const allReady = () =>
  ready.users && ready.transactions && ready.notifications && ready.system;

const buildStateFromRemote = () =>
  normalizeState({
    users: remoteSnapshotState.users,
    transactions: remoteSnapshotState.transactions,
    notifications: remoteSnapshotState.notifications,
    system: remoteSnapshotState.system || undefined,
  });

const applyRemoteToLocal = () => {
  if (!allReady()) return;

  const normalized = buildStateFromRemote();
  const hash = stableHash(normalized);
  if (hash === lastSyncedHash) return;

  applyingRemote = true;
  dataStore.replaceRawState(normalized);
  applyingRemote = false;
  lastSyncedHash = hash;
};

const deleteMissingDocs = async (collectionName, localIds, remoteIds) => {
  const deletes = [];
  remoteIds.forEach((id) => {
    if (!localIds.has(id)) {
      deletes.push(deleteDoc(doc(firestoreDb, collectionName, id)));
    }
  });
  if (deletes.length > 0) await Promise.all(deletes);
};

const writeUsers = async (users) => {
  const householdUsers = users.filter((user) => user.role === "user");
  const localIds = new Set();
  for (const user of householdUsers) {
    localIds.add(user.id);
    await setDoc(doc(firestoreDb, HOUSEHOLD_COLLECTION, user.id), user);
  }
  await deleteMissingDocs(HOUSEHOLD_COLLECTION, localIds, remoteIdSets.users);
};

export async function saveHouseholdUserToFirestore(user) {
  if (!firestoreDb) {
    return { ok: false, error: "Firebase not configured." };
  }

  try {
    if (!user || user.role !== "user") {
      return { ok: false, error: "Invalid household user." };
    }

    await ensureFirebaseSession();
    await setDoc(doc(firestoreDb, HOUSEHOLD_COLLECTION, user.id), user);
    return { ok: true };
  } catch (error) {
    console.error("saveHouseholdUserToFirestore error:", error);
    return { ok: false, error: error.message };
  }
}

export async function deleteHouseholdUserFromFirestore(userId) {
  if (!firestoreDb) {
    return { ok: false, error: "Firebase not configured." };
  }

  try {
    await deleteDoc(doc(firestoreDb, HOUSEHOLD_COLLECTION, userId));
    return { ok: true };
  } catch (error) {
    console.error("deleteHouseholdUserFromFirestore error:", error);
    return { ok: false, error: error.message };
  }
}

const writeTransactions = async (transactions) => {
  const localIds = new Set();
  for (const tx of transactions) {
    localIds.add(tx.id);
    await setDoc(doc(firestoreDb, "transactions", tx.id), tx);
  }
  await deleteMissingDocs("transactions", localIds, remoteIdSets.transactions);
};

const writeNotifications = async (notifications) => {
  const localIds = new Set();
  for (const notification of notifications) {
    localIds.add(notification.id);
    await setDoc(doc(firestoreDb, "notifications", notification.id), notification);
  }
  await deleteMissingDocs(
    "notifications",
    localIds,
    remoteIdSets.notifications
  );
};

const writeSystemConfig = async (systemConfig) => {
  await setDoc(doc(firestoreDb, "system", "config"), systemConfig);
};

const pushCollections = async (rawState) => {
  const normalized = normalizeState(rawState);
  const hash = stableHash(normalized);
  if (hash === lastSyncedHash) return;

  await writeUsers(normalized.users);
  await writeTransactions(normalized.transactions);
  await writeNotifications(normalized.notifications);
  await writeSystemConfig(normalized.system);
  lastSyncedHash = hash;
};

const queuePush = (rawState) => {
  writeChain = writeChain
    .then(() => pushCollections(rawState))
    .catch((err) => {
      console.error("Firestore push error:", err);
    });
};

const readLegacyRealtimeState = async () => {
  if (!realtimeDb) return null;

  const [usersSnap, txSnap, notifSnap, sysSnap] = await Promise.all([
    get(ref(realtimeDb, LEGACY_HOUSEHOLD_PATH)),
    get(ref(realtimeDb, "transactions")),
    get(ref(realtimeDb, "notifications")),
    get(ref(realtimeDb, "system/config")),
  ]);

  const users = objectToSortedArray(usersSnap.val(), "createdAt").filter(
    (user) => user.role === "user"
  );
  const transactions = objectToSortedArray(txSnap.val(), "timestamp");
  const notifications = objectToSortedArray(notifSnap.val(), "createdAt");
  const system = sysSnap.exists() ? sysSnap.val() : null;

  return {
    users,
    transactions,
    notifications,
    system,
    hasData:
      usersSnap.exists() || txSnap.exists() || notifSnap.exists() || sysSnap.exists(),
  };
};

const bootstrapRemote = async () => {
  // Use allSettled so a permission error on one collection doesn't abort the whole bootstrap.
  const [householdRes, txRes, notifRes, sysRes] = await Promise.allSettled([
    getDocs(collection(firestoreDb, HOUSEHOLD_COLLECTION)),
    getDocs(collection(firestoreDb, "transactions")),
    getDocs(collection(firestoreDb, "notifications")),
    getDoc(doc(firestoreDb, "system", "config")),
  ]);

  const householdSnap = householdRes.status === "fulfilled" ? householdRes.value : null;
  const txSnap = txRes.status === "fulfilled" ? txRes.value : null;
  const notifSnap = notifRes.status === "fulfilled" ? notifRes.value : null;
  const sysSnap = sysRes.status === "fulfilled" ? sysRes.value : null;

  setRemoteState("users", householdSnap ? docsToSortedArray(householdSnap, "createdAt") : []);
  setRemoteState("transactions", txSnap ? docsToSortedArray(txSnap, "timestamp") : []);
  setRemoteState("notifications", notifSnap ? docsToSortedArray(notifSnap, "createdAt") : []);
  setRemoteState("system", sysSnap?.exists() ? sysSnap.data() : null);

  const hasFirestoreData =
    householdSnap?.empty === false ||
    txSnap?.empty === false ||
    notifSnap?.empty === false ||
    sysSnap?.exists();

  if (hasFirestoreData) {
    applyRemoteToLocal();
    return;
  }

  const legacyState = await readLegacyRealtimeState();
  if (legacyState?.hasData) {
    const normalized = normalizeState(legacyState);
    setRemoteState("users", normalized.users.filter((user) => user.role === "user"));
    setRemoteState("transactions", normalized.transactions);
    setRemoteState("notifications", normalized.notifications);
    setRemoteState("system", normalized.system);

    applyingRemote = true;
    dataStore.replaceRawState(normalized);
    applyingRemote = false;
    lastSyncedHash = "";
    await pushCollections(normalized);
    return;
  }

  const cleanInitialState = normalizeState({});
  applyingRemote = true;
  dataStore.replaceRawState(cleanInitialState);
  applyingRemote = false;
  lastSyncedHash = "";
  await pushCollections(cleanInitialState);
};

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

const startRemoteListeners = () => {
  onSnapshot(
    collection(firestoreDb, HOUSEHOLD_COLLECTION),
    (snapshot) => {
      setRemoteState("users", docsToSortedArray(snapshot, "createdAt"));
      applyRemoteToLocal();
    },
    (err) => {
      console.error("household listener error:", err);
      if (!ready.users) { setRemoteState("users", []); applyRemoteToLocal(); }
    }
  );

  onSnapshot(
    collection(firestoreDb, "transactions"),
    (snapshot) => {
      setRemoteState("transactions", docsToSortedArray(snapshot, "timestamp"));
      applyRemoteToLocal();
    },
    (err) => {
      console.error("transactions listener error:", err);
      if (!ready.transactions) { setRemoteState("transactions", []); applyRemoteToLocal(); }
    }
  );

  onSnapshot(
    collection(firestoreDb, "notifications"),
    (snapshot) => {
      setRemoteState("notifications", docsToSortedArray(snapshot, "createdAt"));
      applyRemoteToLocal();
    },
    (err) => {
      console.error("notifications listener error:", err);
      if (!ready.notifications) { setRemoteState("notifications", []); applyRemoteToLocal(); }
    }
  );

  onSnapshot(
    doc(firestoreDb, "system", "config"),
    (snapshot) => {
      setRemoteState("system", snapshot.exists() ? snapshot.data() : null);
      applyRemoteToLocal();
    },
    (err) => {
      console.error("system listener error:", err);
      if (!ready.system) { setRemoteState("system", null); applyRemoteToLocal(); }
    }
  );

  // Listen for new unprocessed bin events from hardware bins.
  if (realtimeDb) {
    onValue(
      rtdbQuery(
        ref(realtimeDb, "bin_events"),
        orderByChild("processed"),
        equalTo(false)
      ),
      (snapshot) => {
        if (!snapshot.exists()) return;
        snapshot.forEach((child) => {
          const event = { id: child.key, ...child.val() };
          processBinEvent(event);
        });
      },
      () => {}
    );

  }
};

export function startCloudSync() {
  if (started || !isFirebaseConfigured || !firestoreDb) {
    return;
  }
  started = true;

  const bootstrap = async () => {
    const sessionReady = await ensureFirebaseSession();
    if (!sessionReady) {
      syncMode = "local";
      return;
    }

    syncMode = "firebase";
    await bootstrapRemote();
    startRemoteListeners();

    dataStore.subscribeRaw((rawState) => {
      if (syncMode !== "firebase" || applyingRemote) {
        return;
      }
      queuePush(rawState);
    });

    queuePush(dataStore.getRawState());
  };

  bootstrap().catch(() => {
    syncMode = "local";
  });
}

// Returns true if the bin is currently locked by a DIFFERENT user.
// "waiting" and "active" are the two locked states; everything else is free.
export async function isBinInUse(binId, requestingUserId) {
  if (!realtimeDb) return false;
  try {
    await ensureFirebaseSession();
    const snapshot = await get(ref(realtimeDb, `bin_commands/${binId}`));
    if (!snapshot.exists()) return false;
    const { status, userId } = snapshot.val();
    return ["waiting", "active"].includes(status) && userId !== requestingUserId;
  } catch {
    return false; // fail open — don't block user if the check itself errors
  }
}

// Called by UI when a user requests a bottle insert.
// Writes "waiting" to RTDB; the ESP32 polls and activates.
export async function writeBinCommand(binId, userId, userName) {
  if (!realtimeDb) {
    return { ok: false, error: "Firebase not configured." };
  }
  try {
    const sessionReady = await ensureFirebaseSession();
    if (!sessionReady) {
      return {
        ok: false,
        error:
          "Firebase sign-in failed. Enable anonymous authentication before sending bin commands.",
      };
    }
    await set(ref(realtimeDb, `bin_commands/${binId}`), {
      binId,
      userId,
      userName,
      status: "waiting",
      requestedAt: new Date().toISOString(),
      weightKg: 0,
      lastWeightKg: 0,
      acceptedCount: 0,
      lastAcceptedAt: "",
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// Cancels an in-progress bin command (user clicked Cancel).
export async function cancelBinCommand(binId) {
  if (!realtimeDb) return { ok: false };
  try {
    const sessionReady = await ensureFirebaseSession();
    if (!sessionReady) {
      return {
        ok: false,
        error:
          "Firebase sign-in failed. Enable anonymous authentication before canceling bin commands.",
      };
    }
    await update(ref(realtimeDb, `bin_commands/${binId}`), { status: "idle" });
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
  try {
    const sessionReady = await ensureFirebaseSession();
    if (!sessionReady) {
      return {
        ok: false,
        error:
          "Firebase sign-in failed. Enable anonymous authentication before sending rice commands.",
      };
    }
    await set(ref(realtimeDb, `rice_commands/${binId}`), {
      binId,
      userId,
      userName,
      amountKg,
      status: "dispensing",
      requestedAt: new Date().toISOString(),
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
