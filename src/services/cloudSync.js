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

const processedBinCommands = new Set();
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
    .catch(() => {
      syncMode = "local";
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
  const [householdSnap, txSnap, notifSnap, sysSnap] = await Promise.all([
    getDocs(collection(firestoreDb, HOUSEHOLD_COLLECTION)),
    getDocs(collection(firestoreDb, "transactions")),
    getDocs(collection(firestoreDb, "notifications")),
    getDoc(doc(firestoreDb, "system", "config")),
  ]);

  setRemoteState("users", docsToSortedArray(householdSnap, "createdAt"));
  setRemoteState("transactions", docsToSortedArray(txSnap, "timestamp"));
  setRemoteState("notifications", docsToSortedArray(notifSnap, "createdAt"));
  setRemoteState("system", sysSnap.exists() ? sysSnap.data() : null);

  const hasFirestoreData =
    !householdSnap.empty || !txSnap.empty || !notifSnap.empty || sysSnap.exists();

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
    const rawState = dataStore.getRawState();
    const bin = rawState.system.bins?.[event.binId];

    if (!bin?.assignedUserId) {
      console.warn(`bin_event ignored - no user assigned to bin "${event.binId}"`);
      return;
    }

    dataStore.insertBottleFromHardware(
      bin.assignedUserId,
      event.weightKg,
      event.binId
    );

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
    () => {
      syncMode = "local";
    }
  );

  onSnapshot(
    collection(firestoreDb, "transactions"),
    (snapshot) => {
      setRemoteState("transactions", docsToSortedArray(snapshot, "timestamp"));
      applyRemoteToLocal();
    },
    () => {
      syncMode = "local";
    }
  );

  onSnapshot(
    collection(firestoreDb, "notifications"),
    (snapshot) => {
      setRemoteState("notifications", docsToSortedArray(snapshot, "createdAt"));
      applyRemoteToLocal();
    },
    () => {
      syncMode = "local";
    }
  );

  onSnapshot(
    doc(firestoreDb, "system", "config"),
    (snapshot) => {
      setRemoteState("system", snapshot.exists() ? snapshot.data() : null);
      applyRemoteToLocal();
    },
    () => {
      syncMode = "local";
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

    // Listen for bin_commands status changes written by ESP32.
    onValue(
      ref(realtimeDb, "bin_commands"),
      (snapshot) => {
        if (!snapshot.exists()) return;
        snapshot.forEach((child) => {
          const data = { id: child.key, ...child.val() };

          if (data.status === "done" && data.userId && data.weightKg > 0) {
            const key = `${data.id}|${data.requestedAt}`;
            if (processedBinCommands.has(key)) return;
            processedBinCommands.add(key);

            dataStore.insertBottleFromHardware(
              data.userId,
              data.weightKg,
              data.binId || data.id
            );

            update(ref(realtimeDb, `bin_commands/${data.id}`), {
              status: "idle",
              weightKg: 0,
            }).catch(() => {});
          }
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
