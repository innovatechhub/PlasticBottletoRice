import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
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

const stableHash = (value) => JSON.stringify(value);

let started = false;
let syncMode = "local";
let applyingRemote = false;
let lastSyncedHash = "";
let writeChain = Promise.resolve();

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
