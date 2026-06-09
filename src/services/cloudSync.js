import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import { dataStore, normalizeState } from "./localStore";
import {
  ensureFirebaseSession,
  firestoreDb,
  isFirebaseConfigured,
} from "./firebaseClient";

const USERS_COLLECTION = "users";
const TRANSACTIONS_COLLECTION = "transactions";
const NOTIFICATIONS_COLLECTION = "notifications";
const SYSTEM_COLLECTION = "system";
const SYSTEM_DOC_ID = "config";
const LEGACY_STATE_COLLECTION = "pbtr_state";
const LEGACY_STATE_DOC_ID = "main";
const BIN_EVENTS_COLLECTION = "bin_events";

const stableHash = (value) => JSON.stringify(value);

let started = false;
let syncMode = "local";
let applyingRemote = false;
let lastSyncedHash = "";
let writeChain = Promise.resolve();

const processedBinCommands = new Set();   // prevent double-crediting on rapid re-fires

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

const extractOrderedDocs = (snapshot, key = "createdAt") =>
  snapshot.docs
    .map((item) => ({
      id: item.id,
      ...item.data(),
    }))
    .sort((a, b) => String(b[key] || "").localeCompare(String(a[key] || "")));

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
  if (!allReady()) {
    return;
  }

  const normalized = buildStateFromRemote();
  const hash = stableHash(normalized);
  if (hash === lastSyncedHash) {
    return;
  }

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
  if (deletes.length > 0) {
    await Promise.all(deletes);
  }
};

const writeUsers = async (users) => {
  const localIds = new Set();
  for (const user of users) {
    localIds.add(user.id);
    await setDoc(doc(firestoreDb, USERS_COLLECTION, user.id), user, {
      merge: true,
    });
  }
  await deleteMissingDocs(USERS_COLLECTION, localIds, remoteIdSets.users);
};

const writeTransactions = async (transactions) => {
  const localIds = new Set();
  for (const tx of transactions) {
    localIds.add(tx.id);
    await setDoc(doc(firestoreDb, TRANSACTIONS_COLLECTION, tx.id), tx, {
      merge: true,
    });
  }
  await deleteMissingDocs(
    TRANSACTIONS_COLLECTION,
    localIds,
    remoteIdSets.transactions
  );
};

const writeNotifications = async (notifications) => {
  const localIds = new Set();
  for (const notification of notifications) {
    localIds.add(notification.id);
    await setDoc(
      doc(firestoreDb, NOTIFICATIONS_COLLECTION, notification.id),
      notification,
      { merge: true }
    );
  }
  await deleteMissingDocs(
    NOTIFICATIONS_COLLECTION,
    localIds,
    remoteIdSets.notifications
  );
};

const writeSystemConfig = async (systemConfig) => {
  await setDoc(doc(firestoreDb, SYSTEM_COLLECTION, SYSTEM_DOC_ID), systemConfig, {
    merge: true,
  });
};

const pushCollections = async (rawState) => {
  const normalized = normalizeState(rawState);
  const hash = stableHash(normalized);
  if (hash === lastSyncedHash) {
    return;
  }

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

const bootstrapRemote = async () => {
  const [usersSnap, txSnap, notificationSnap, systemSnap, legacyStateSnap] =
    await Promise.all([
    getDocs(collection(firestoreDb, USERS_COLLECTION)),
    getDocs(collection(firestoreDb, TRANSACTIONS_COLLECTION)),
    getDocs(collection(firestoreDb, NOTIFICATIONS_COLLECTION)),
    getDoc(doc(firestoreDb, SYSTEM_COLLECTION, SYSTEM_DOC_ID)),
    getDoc(doc(firestoreDb, LEGACY_STATE_COLLECTION, LEGACY_STATE_DOC_ID)),
  ]);

  setRemoteState("users", extractOrderedDocs(usersSnap, "createdAt"));
  setRemoteState("transactions", extractOrderedDocs(txSnap, "timestamp"));
  setRemoteState(
    "notifications",
    extractOrderedDocs(notificationSnap, "createdAt")
  );
  setRemoteState("system", systemSnap.exists() ? systemSnap.data() : null);

  const hasRemoteData =
    usersSnap.size > 0 ||
    txSnap.size > 0 ||
    notificationSnap.size > 0 ||
    systemSnap.exists();

  if (hasRemoteData) {
    applyRemoteToLocal();
  } else if (legacyStateSnap.exists() && legacyStateSnap.data()?.state) {
    const normalizedLegacy = normalizeState(legacyStateSnap.data().state);
    applyingRemote = true;
    dataStore.replaceRawState(normalizedLegacy);
    applyingRemote = false;
    await pushCollections(normalizedLegacy);
  } else {
    const cleanInitialState = normalizeState({});
    applyingRemote = true;
    dataStore.replaceRawState(cleanInitialState);
    applyingRemote = false;
    await pushCollections(cleanInitialState);
  }
};

const processBinEvent = async (event) => {
  try {
    const rawState = dataStore.getRawState();
    const bin = rawState.system.bins?.[event.binId];

    if (!bin?.assignedUserId) {
      console.warn(`bin_event ignored — no user assigned to bin "${event.binId}"`);
      return;
    }

    dataStore.insertBottleFromHardware(
      bin.assignedUserId,
      event.weightKg,
      event.binId
    );

    // Mark processed so the listener doesn't fire again
    await setDoc(
      doc(firestoreDb, BIN_EVENTS_COLLECTION, event.id),
      { processed: true },
      { merge: true }
    );
  } catch (err) {
    console.error("processBinEvent error:", err);
  }
};

const startRemoteListeners = () => {
  onSnapshot(
    collection(firestoreDb, USERS_COLLECTION),
    (snapshot) => {
      setRemoteState("users", extractOrderedDocs(snapshot, "createdAt"));
      applyRemoteToLocal();
    },
    () => {
      syncMode = "local";
    }
  );

  onSnapshot(
    collection(firestoreDb, TRANSACTIONS_COLLECTION),
    (snapshot) => {
      setRemoteState("transactions", extractOrderedDocs(snapshot, "timestamp"));
      applyRemoteToLocal();
    },
    () => {
      syncMode = "local";
    }
  );

  onSnapshot(
    collection(firestoreDb, NOTIFICATIONS_COLLECTION),
    (snapshot) => {
      setRemoteState("notifications", extractOrderedDocs(snapshot, "createdAt"));
      applyRemoteToLocal();
    },
    () => {
      syncMode = "local";
    }
  );

  onSnapshot(
    doc(firestoreDb, SYSTEM_COLLECTION, SYSTEM_DOC_ID),
    (snapshot) => {
      setRemoteState("system", snapshot.exists() ? snapshot.data() : null);
      applyRemoteToLocal();
    },
    () => {
      syncMode = "local";
    }
  );

  // Listen for new bottle events from hardware bins
  onSnapshot(
    query(
      collection(firestoreDb, BIN_EVENTS_COLLECTION),
      where("processed", "==", false)
    ),
    (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const event = { id: change.doc.id, ...change.doc.data() };
          processBinEvent(event);
        }
      });
    },
    () => {}
  );

  // Listen for bin_commands status changes (written by ESP32 after detecting a bottle)
  onSnapshot(
    collection(firestoreDb, "bin_commands"),
    (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type !== "added" && change.type !== "modified") return;

        const data = { id: change.doc.id, ...change.doc.data() };

        if (data.status === "done" && data.userId && data.weightKg > 0) {
          const key = `${data.id}|${data.requestedAt}`;
          if (processedBinCommands.has(key)) return;
          processedBinCommands.add(key);

          dataStore.insertBottleFromHardware(
            data.userId,
            data.weightKg,
            data.binId || data.id
          );

          // Reset so the document is reusable for the next insert
          await setDoc(
            doc(firestoreDb, "bin_commands", data.id),
            { status: "idle", weightKg: 0 },
            { merge: true }
          ).catch(() => {});
        }
      });
    },
    () => {}
  );
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

    // Ensure required baseline accounts/config are reflected in Firestore collections.
    queuePush(dataStore.getRawState());
  };

  bootstrap().catch(() => {
    syncMode = "local";
  });
}

// Called by the UI when a user requests a bottle insert via the web button.
// Writes a "waiting" command to Firestore; the ESP32 polls this and activates.
export async function writeBinCommand(binId, userId, userName) {
  if (!firestoreDb) {
    return { ok: false, error: "Firebase not configured." };
  }
  try {
    await ensureFirebaseSession();
    await setDoc(doc(firestoreDb, "bin_commands", binId), {
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
  if (!firestoreDb) return { ok: false };
  try {
    await setDoc(
      doc(firestoreDb, "bin_commands", binId),
      { status: "idle" },
      { merge: true }
    );
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
