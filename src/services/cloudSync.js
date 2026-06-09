import {
  equalTo,
  get,
  onValue,
  orderByChild,
  query,
  ref,
  remove,
  set,
  update,
} from "firebase/database";
import { dataStore, normalizeState } from "./localStore";
import {
  ensureFirebaseSession,
  realtimeDb,
  isFirebaseConfigured,
} from "./firebaseClient";

const stableHash = (value) => JSON.stringify(value);

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

const deleteMissingDocs = async (path, localIds, remoteIds) => {
  const deletes = [];
  remoteIds.forEach((id) => {
    if (!localIds.has(id)) {
      deletes.push(remove(ref(realtimeDb, `${path}/${id}`)));
    }
  });
  if (deletes.length > 0) await Promise.all(deletes);
};

const writeUsers = async (users) => {
  const localIds = new Set();
  for (const user of users) {
    localIds.add(user.id);
    await set(ref(realtimeDb, `users/${user.id}`), user);
  }
  await deleteMissingDocs("users", localIds, remoteIdSets.users);
};

const writeTransactions = async (transactions) => {
  const localIds = new Set();
  for (const tx of transactions) {
    localIds.add(tx.id);
    await set(ref(realtimeDb, `transactions/${tx.id}`), tx);
  }
  await deleteMissingDocs("transactions", localIds, remoteIdSets.transactions);
};

const writeNotifications = async (notifications) => {
  const localIds = new Set();
  for (const notification of notifications) {
    localIds.add(notification.id);
    await set(ref(realtimeDb, `notifications/${notification.id}`), notification);
  }
  await deleteMissingDocs(
    "notifications",
    localIds,
    remoteIdSets.notifications
  );
};

const writeSystemConfig = async (systemConfig) => {
  await set(ref(realtimeDb, "system/config"), systemConfig);
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

const bootstrapRemote = async () => {
  const [usersSnap, txSnap, notifSnap, sysSnap] = await Promise.all([
    get(ref(realtimeDb, "users")),
    get(ref(realtimeDb, "transactions")),
    get(ref(realtimeDb, "notifications")),
    get(ref(realtimeDb, "system/config")),
  ]);

  setRemoteState("users", objectToSortedArray(usersSnap.val(), "createdAt"));
  setRemoteState("transactions", objectToSortedArray(txSnap.val(), "timestamp"));
  setRemoteState(
    "notifications",
    objectToSortedArray(notifSnap.val(), "createdAt")
  );
  setRemoteState("system", sysSnap.exists() ? sysSnap.val() : null);

  const hasRemoteData =
    usersSnap.exists() ||
    txSnap.exists() ||
    notifSnap.exists() ||
    sysSnap.exists();

  if (hasRemoteData) {
    applyRemoteToLocal();
  } else {
    const cleanInitialState = normalizeState({});
    applyingRemote = true;
    dataStore.replaceRawState(cleanInitialState);
    applyingRemote = false;
    await pushCollections(cleanInitialState);
  }
};

const processBinEvent = async (event) => {
  if (processedBinEvents.has(event.id)) return;
  processedBinEvents.add(event.id);

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

    await update(ref(realtimeDb, `bin_events/${event.id}`), {
      processed: true,
    });
  } catch (err) {
    processedBinEvents.delete(event.id);
    console.error("processBinEvent error:", err);
  }
};

const startRemoteListeners = () => {
  onValue(
    ref(realtimeDb, "users"),
    (snapshot) => {
      setRemoteState("users", objectToSortedArray(snapshot.val(), "createdAt"));
      applyRemoteToLocal();
    },
    () => {
      syncMode = "local";
    }
  );

  onValue(
    ref(realtimeDb, "transactions"),
    (snapshot) => {
      setRemoteState(
        "transactions",
        objectToSortedArray(snapshot.val(), "timestamp")
      );
      applyRemoteToLocal();
    },
    () => {
      syncMode = "local";
    }
  );

  onValue(
    ref(realtimeDb, "notifications"),
    (snapshot) => {
      setRemoteState(
        "notifications",
        objectToSortedArray(snapshot.val(), "createdAt")
      );
      applyRemoteToLocal();
    },
    () => {
      syncMode = "local";
    }
  );

  onValue(
    ref(realtimeDb, "system/config"),
    (snapshot) => {
      setRemoteState("system", snapshot.exists() ? snapshot.val() : null);
      applyRemoteToLocal();
    },
    () => {
      syncMode = "local";
    }
  );

  // Listen for new unprocessed bin events from hardware bins
  onValue(
    query(
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

  // Listen for bin_commands status changes (written by ESP32 after bottle detected)
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
};

export function startCloudSync() {
  if (started || !isFirebaseConfigured || !realtimeDb) {
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
    await ensureFirebaseSession();
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
    await ensureFirebaseSession();
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
