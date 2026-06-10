const REQUIRED_ADMIN_ACCOUNT = {
  id: "admin_main",
  name: "Admin",
  email: "admin@admin.com",
  password: "Admin12345",
  role: "admin",
};
const REQUIRED_HOUSEHOLD_ACCOUNT = {
  id: "user_main",
  name: "Garcia Household",
  email: "garcia@pbtr.local",
  password: "user123",
  role: "user",
};

const now = () => new Date().toISOString();

const createId = (prefix) =>
  `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const roundToThree = (value) => Math.round(value * 1000) / 1000;

const cloneDeep = (value) => JSON.parse(JSON.stringify(value));

const createEmptyLifetimeStats = () => ({
  recycledItemCount: 0,
  totalRecycledWeightKg: 0,
});

const buildLifetimeStats = (transactions = []) => {
  const perUser = new Map();
  let totalItemsRecycled = 0;
  let totalWeightRecycledKg = 0;

  transactions.forEach((transaction) => {
    if (transaction?.type !== "bottle") {
      return;
    }

    const bottleCount = Math.max(
      0,
      Math.floor(toNumber(transaction.bottleDelta ?? transaction.amount, 0))
    );
    const weightKg = Math.max(0, roundToThree(toNumber(transaction.kgDelta, 0)));

    totalItemsRecycled += bottleCount;
    totalWeightRecycledKg = roundToThree(totalWeightRecycledKg + weightKg);

    const current = perUser.get(transaction.userId) || createEmptyLifetimeStats();
    perUser.set(transaction.userId, {
      recycledItemCount: current.recycledItemCount + bottleCount,
      totalRecycledWeightKg: roundToThree(
        current.totalRecycledWeightKg + weightKg
      ),
    });
  });

  return {
    perUser,
    totalItemsRecycled,
    totalWeightRecycledKg,
  };
};

const seedState = () => ({
  users: [
    {
      id: REQUIRED_ADMIN_ACCOUNT.id,
      name: REQUIRED_ADMIN_ACCOUNT.name,
      email: REQUIRED_ADMIN_ACCOUNT.email,
      password: REQUIRED_ADMIN_ACCOUNT.password,
      role: REQUIRED_ADMIN_ACCOUNT.role,
      weightKg: 0,
      recycledItemCount: 0,
      totalRecycledWeightKg: 0,
      createdAt: now(),
    },
    {
      id: REQUIRED_HOUSEHOLD_ACCOUNT.id,
      name: REQUIRED_HOUSEHOLD_ACCOUNT.name,
      email: REQUIRED_HOUSEHOLD_ACCOUNT.email,
      password: REQUIRED_HOUSEHOLD_ACCOUNT.password,
      role: REQUIRED_HOUSEHOLD_ACCOUNT.role,
      weightKg: 0,
      recycledItemCount: 0,
      totalRecycledWeightKg: 0,
      createdAt: now(),
    },
  ],
  transactions: [],
  notifications: [],
  system: {
    riceStock: 0,
    bottleStorage: 0,
    totalItemsRecycled: 0,
    totalWeightRecycledKg: 0,
    maxBottleCapacity: 500,
    kgPerBottle: 0.025,
    bins: {
      bin_001: { assignedUserId: "", assignedUserName: "Unassigned" },
    },
  },
});

const sanitizeUser = (user) => {
  const { password, ...safeUser } = user;
  return safeUser;
};

const isNotificationForUser = (notification, user) => {
  if (!notification || !user) {
    return false;
  }

  if (notification.userId) {
    return notification.userId === user.id;
  }

  if (notification.targetRole === "all") {
    return true;
  }

  return notification.targetRole === user.role;
};

const toPublicState = (rawState) => {
  const snapshot = cloneDeep(rawState);
  snapshot.users = snapshot.users.map((user) => sanitizeUser(user));
  return snapshot;
};

const normalizeState = (candidateState) => {
  const base = seedState();
  const transactions = Array.isArray(candidateState?.transactions)
    ? candidateState.transactions.map((transaction) => ({
        id: transaction.id || createId("tx"),
        userId: transaction.userId || "",
        userName: transaction.userName || "Unknown",
        type: transaction.type || "system",
        amount: toNumber(transaction.amount, 0),
        kgDelta: roundToThree(toNumber(transaction.kgDelta, 0)),
        riceDeltaKg: roundToThree(toNumber(transaction.riceDeltaKg, 0)),
        bottleDelta: Math.max(
          0,
          Math.floor(
            toNumber(
              transaction.bottleDelta ??
                (transaction.type === "bottle" ? transaction.amount : 0),
              0
            )
          )
        ),
        details: transaction.details || "",
        timestamp: transaction.timestamp || now(),
      }))
    : base.transactions;
  const lifetimeStats = buildLifetimeStats(transactions);

  if (!candidateState || typeof candidateState !== "object") {
    return base;
  }

  const users = Array.isArray(candidateState.users)
    ? candidateState.users
        .map((user) => ({
          ...(lifetimeStats.perUser.get(user.id) || createEmptyLifetimeStats()),
          id: user.id || createId("user"),
          name: user.name || "Unnamed Household",
          email: String(user.email || "").toLowerCase(),
          password: user.password || "user123",
          role: user.role === "admin" ? "admin" : "user",
          weightKg: Math.max(
            0,
            roundToThree(toNumber(user.weightKg ?? user.points, 0))
          ),
          recycledItemCount: Math.max(
            0,
            Math.floor(
              toNumber(
                user.recycledItemCount,
                lifetimeStats.perUser.get(user.id)?.recycledItemCount ?? 0
              )
            )
          ),
          totalRecycledWeightKg: Math.max(
            0,
            roundToThree(
              toNumber(
                user.totalRecycledWeightKg,
                lifetimeStats.perUser.get(user.id)?.totalRecycledWeightKg ?? 0
              )
            )
          ),
          createdAt: user.createdAt || now(),
        }))
        .filter((user) => user.email)
    : base.users;

  const upsertRequiredUser = (requiredUser) => {
    const index = users.findIndex((user) => user.email === requiredUser.email);
    if (index >= 0) {
      users[index] = {
        ...users[index],
        name: requiredUser.name,
        role: requiredUser.role,
        password: requiredUser.password,
      };
      return;
    }

    users.unshift({
      id: requiredUser.id,
      name: requiredUser.name,
      email: requiredUser.email,
      password: requiredUser.password,
      role: requiredUser.role,
      weightKg: 0,
      recycledItemCount: 0,
      totalRecycledWeightKg: 0,
      createdAt: now(),
    });
  };

  upsertRequiredUser(REQUIRED_ADMIN_ACCOUNT);
  upsertRequiredUser(REQUIRED_HOUSEHOLD_ACCOUNT);

  const hasAdmin = users.some((user) => user.role === "admin");
  if (!hasAdmin) {
    users.unshift(base.users[0]);
  }

  return {
    users,
    transactions,
    notifications: Array.isArray(candidateState.notifications)
      ? candidateState.notifications
      : base.notifications,
    system: {
      ...base.system,
      ...(candidateState.system || {}),
      riceStock: Math.max(
        0,
        roundToThree(
          toNumber(candidateState.system?.riceStock, base.system.riceStock)
        )
      ),
      bottleStorage: Math.max(
        0,
        Math.floor(
          toNumber(candidateState.system?.bottleStorage, base.system.bottleStorage)
        )
      ),
      totalItemsRecycled: Math.max(
        0,
        Math.floor(
          toNumber(
            candidateState.system?.totalItemsRecycled,
            lifetimeStats.totalItemsRecycled
          )
        )
      ),
      totalWeightRecycledKg: Math.max(
        0,
        roundToThree(
          toNumber(
            candidateState.system?.totalWeightRecycledKg,
            lifetimeStats.totalWeightRecycledKg
          )
        )
      ),
      maxBottleCapacity: Math.max(
        1,
        Math.floor(
          toNumber(
            candidateState.system?.maxBottleCapacity,
            base.system.maxBottleCapacity
          )
        )
      ),
      kgPerBottle: Math.max(
        0.001,
        roundToThree(
          toNumber(candidateState.system?.kgPerBottle, base.system.kgPerBottle)
        )
      ),
    },
  };
};

let state = seedState();
const listeners = new Set();
const rawListeners = new Set();

const emit = () => {
  const snapshot = toPublicState(state);
  listeners.forEach((listener) => listener(snapshot));
  const rawSnapshot = cloneDeep(state);
  rawListeners.forEach((listener) => listener(rawSnapshot));
};

const getUserById = (userId) => state.users.find((user) => user.id === userId);

const appendNotification = ({
  title,
  message,
  targetRole = "all",
  userId = null,
  type = "info",
}) => {
  const notification = {
    id: createId("notif"),
    title,
    message,
    targetRole,
    userId,
    type,
    createdAt: now(),
    readBy: [],
  };
  state.notifications.unshift(notification);
  return notification;
};

const appendTransaction = ({
  userId,
  userName,
  type,
  amount,
  kgDelta = 0,
  riceDeltaKg = 0,
  bottleDelta = 0,
  details = "",
}) => {
  const transaction = {
    id: createId("tx"),
    userId,
    userName,
    type,
    amount: toNumber(amount, 0),
    kgDelta: roundToThree(toNumber(kgDelta, 0)),
    riceDeltaKg: roundToThree(toNumber(riceDeltaKg, 0)),
    bottleDelta: Math.max(0, Math.floor(toNumber(bottleDelta, 0))),
    details,
    timestamp: now(),
  };
  state.transactions.unshift(transaction);
  return transaction;
};

const applyBottleCredit = (user, bottleCount, kgEarned) => {
  user.weightKg = roundToThree(user.weightKg + kgEarned);
  user.recycledItemCount = Math.max(
    0,
    Math.floor(toNumber(user.recycledItemCount, 0)) + bottleCount
  );
  user.totalRecycledWeightKg = roundToThree(
    toNumber(user.totalRecycledWeightKg, 0) + kgEarned
  );
  state.system.totalItemsRecycled = Math.max(
    0,
    Math.floor(toNumber(state.system.totalItemsRecycled, 0)) + bottleCount
  );
  state.system.totalWeightRecycledKg = roundToThree(
    toNumber(state.system.totalWeightRecycledKg, 0) + kgEarned
  );
};

export const dataStore = {
  subscribe(listener) {
    listeners.add(listener);
    listener(this.getState());
    return () => {
      listeners.delete(listener);
    };
  },

  subscribeRaw(listener) {
    rawListeners.add(listener);
    listener(this.getRawState());
    return () => {
      rawListeners.delete(listener);
    };
  },

  getState() {
    return toPublicState(state);
  },

  getRawState() {
    return cloneDeep(state);
  },

  replaceRawState(nextState) {
    state = normalizeState(nextState);
    emit();
    return {
      ok: true,
    };
  },

  login(email, password) {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const attemptedPassword = String(password || "");
    const user = state.users.find(
      (item) =>
        item.email.toLowerCase() === normalizedEmail &&
        item.password === attemptedPassword
    );

    if (!user) {
      return {
        ok: false,
        error: "Invalid credentials. Check your email and password.",
      };
    }

    return {
      ok: true,
      user: sanitizeUser(user),
    };
  },

  addUser(payload) {
    const name = String(payload.name || "").trim();
    const email = String(payload.email || "").trim().toLowerCase();
    const password = String(payload.password || "").trim();

    if (!name || !email || !password) {
      return {
        ok: false,
        error: "Name, email, and password are required.",
      };
    }

    const user = {
      id: createId("user"),
      name,
      email,
      password,
      role: "user",
      weightKg: 0,
      recycledItemCount: 0,
      totalRecycledWeightKg: 0,
      createdAt: now(),
    };

    state.users.push(user);
    appendNotification({
      title: "New Household Added",
      message: `${name} was added by admin.`,
      targetRole: "admin",
      type: "info",
    });

    emit();
    return {
      ok: true,
      user: sanitizeUser(user),
      rawUser: { ...user },
    };
  },

  updateUser(userId, updates) {
    const user = getUserById(userId);
    if (!user) {
      return {
        ok: false,
        error: "User not found.",
      };
    }

    if (typeof updates.name !== "undefined") {
      const name = String(updates.name).trim();
      if (!name) {
        return {
          ok: false,
          error: "Name cannot be empty.",
        };
      }
      user.name = name;
    }

    if (typeof updates.email !== "undefined") {
      const email = String(updates.email).trim().toLowerCase();
      if (!email) {
        return {
          ok: false,
          error: "Email cannot be empty.",
        };
      }
      user.email = email;
    }

    if (typeof updates.password !== "undefined" && updates.password !== "") {
      user.password = String(updates.password);
    }

    if (typeof updates.weightKg !== "undefined") {
      user.weightKg = Math.max(
        0,
        roundToThree(toNumber(updates.weightKg, user.weightKg))
      );
    }

    emit();
    return {
      ok: true,
      user: sanitizeUser(user),
      rawUser: { ...user },
    };
  },

  deleteUser(userId) {
    const user = getUserById(userId);
    if (!user) {
      return {
        ok: false,
        error: "User not found.",
      };
    }

    if (user.role === "admin") {
      return {
        ok: false,
        error: "Admin account cannot be removed.",
      };
    }

    state.users = state.users.filter((item) => item.id !== userId);
    appendNotification({
      title: "Household Removed",
      message: `${user.name} account was deleted.`,
      targetRole: "admin",
      type: "warning",
    });

    emit();
    return {
      ok: true,
      rawUser: { ...user },
    };
  },

  insertBottle(userId, bottleCount = 1) {
    const user = getUserById(userId);
    if (!user) {
      return {
        ok: false,
        error: "User not found.",
      };
    }

    const count = Math.max(1, Math.floor(toNumber(bottleCount, 1)));
    const kgEarned = roundToThree(
      count * toNumber(state.system.kgPerBottle, 0.025)
    );
    const previousStorage = state.system.bottleStorage;

    applyBottleCredit(user, count, kgEarned);
    state.system.bottleStorage = Math.max(0, previousStorage + count);

    appendTransaction({
      userId: user.id,
      userName: user.name,
      type: "bottle",
      amount: count,
      kgDelta: kgEarned,
      riceDeltaKg: 0,
      bottleDelta: count,
      details: `${count} bottle(s) inserted. +${kgEarned} kg credited.`,
    });

    appendNotification({
      title: "Bottle Recorded",
      message: `You earned ${kgEarned} kg from ${count} bottle(s).`,
      userId: user.id,
      type: "success",
    });

    if (
      previousStorage < state.system.maxBottleCapacity &&
      state.system.bottleStorage >= state.system.maxBottleCapacity
    ) {
      appendNotification({
        title: "Bottle Storage Full",
        message: "Bottle storage reached max capacity.",
        targetRole: "admin",
        type: "warning",
      });
    }

    emit();
    return {
      ok: true,
      kgEarned,
    };
  },

  insertBottleFromHardware(userId, weightKg, binId = "hardware") {
    const user = getUserById(userId);
    if (!user) {
      return { ok: false, error: "User not found." };
    }

    const kg = roundToThree(Math.max(0, toNumber(weightKg, 0)));
    if (kg === 0) {
      return { ok: false, error: "Invalid weight from hardware." };
    }

    const previousStorage = state.system.bottleStorage;
    applyBottleCredit(user, 1, kg);
    state.system.bottleStorage = previousStorage + 1;

    appendTransaction({
      userId: user.id,
      userName: user.name,
      type: "bottle",
      amount: 1,
      kgDelta: kg,
      riceDeltaKg: 0,
      bottleDelta: 1,
      details: `1 bottle via ${binId} — ${kg} kg credited.`,
    });

    appendNotification({
      title: "Bottle Recorded",
      message: `${kg} kg credited from bin ${binId}.`,
      userId: user.id,
      type: "success",
    });

    if (
      previousStorage < state.system.maxBottleCapacity &&
      state.system.bottleStorage >= state.system.maxBottleCapacity
    ) {
      appendNotification({
        title: "Bottle Storage Full",
        message: "Bottle storage reached max capacity.",
        targetRole: "admin",
        type: "warning",
      });
    }

    emit();
    return { ok: true, kgEarned: kg };
  },

  finalizeBottleSession(userId, bottleWeightsKg = [], binId = "hardware") {
    const user = getUserById(userId);
    if (!user) {
      return { ok: false, error: "User not found." };
    }

    const acceptedWeights = Array.isArray(bottleWeightsKg)
      ? bottleWeightsKg
          .map((weight) => roundToThree(Math.max(0, toNumber(weight, 0))))
          .filter((weight) => weight > 0)
      : [];

    const bottleCount = acceptedWeights.length;
    if (bottleCount === 0) {
      return { ok: false, error: "No accepted bottles to save." };
    }

    const totalKg = roundToThree(
      acceptedWeights.reduce((sum, weight) => sum + weight, 0)
    );
    const previousStorage = state.system.bottleStorage;

    applyBottleCredit(user, bottleCount, totalKg);
    state.system.bottleStorage = previousStorage + bottleCount;

    appendTransaction({
      userId: user.id,
      userName: user.name,
      type: "bottle",
      amount: bottleCount,
      kgDelta: totalKg,
      riceDeltaKg: 0,
      bottleDelta: bottleCount,
      details: `${bottleCount} bottle(s) via ${binId}. +${totalKg} kg credited on session save.`,
    });

    appendNotification({
      title: "Bottle Session Saved",
      message: `${bottleCount} bottle(s) worth ${totalKg} kg were added to your balance.`,
      userId: user.id,
      type: "success",
    });

    if (
      previousStorage < state.system.maxBottleCapacity &&
      state.system.bottleStorage >= state.system.maxBottleCapacity
    ) {
      appendNotification({
        title: "Bottle Storage Full",
        message: "Bottle storage reached max capacity.",
        targetRole: "admin",
        type: "warning",
      });
    }

    emit();
    return { ok: true, kgEarned: totalKg, bottleCount };
  },

  updateBinAssignment(binId, userId, userName) {
    if (!state.system.bins) state.system.bins = {};
    state.system.bins[binId] = { assignedUserId: userId, assignedUserName: userName };
    emit();
    return { ok: true };
  },

  redeemRice(userId, kgToRedeem) {
    const user = getUserById(userId);
    if (!user) {
      return {
        ok: false,
        error: "User not found.",
      };
    }

    const riceKg = roundToThree(Math.max(0.001, toNumber(kgToRedeem, 0)));

    if (user.weightKg < riceKg) {
      return {
        ok: false,
        error: "Not enough kg balance for this redemption.",
      };
    }

    const previousRice = state.system.riceStock;
    user.weightKg = roundToThree(user.weightKg - riceKg);
    // Allow redemption to proceed for dispenser/servo testing even when stock is depleted.
    state.system.riceStock = Math.max(
      0,
      roundToThree(state.system.riceStock - riceKg)
    );

    appendTransaction({
      userId: user.id,
      userName: user.name,
      type: "redeem",
      amount: riceKg,
      kgDelta: -riceKg,
      riceDeltaKg: -riceKg,
      bottleDelta: 0,
      details: `${riceKg} kg plastic redeemed for ${riceKg} kg rice.`,
    });

    appendNotification({
      title: "Redemption Successful",
      message: `You redeemed ${riceKg} kg of plastic for ${riceKg} kg of rice.`,
      userId: user.id,
      type: "success",
    });

    if (previousRice > 0 && state.system.riceStock <= 0) {
      appendNotification({
        title: "Out of Rice",
        message: "Rice stock reached zero. Restock is required.",
        targetRole: "all",
        type: "warning",
      });
    }

    emit();
    return {
      ok: true,
      riceKg,
    };
  },

  updateSystemConfig(updates) {
    const nextConfig = {
      kgPerBottle: toNumber(updates.kgPerBottle, state.system.kgPerBottle),
      maxBottleCapacity: Math.max(
        1,
        Math.floor(
          toNumber(updates.maxBottleCapacity, state.system.maxBottleCapacity)
        )
      ),
    };

    if (nextConfig.kgPerBottle <= 0) {
      return {
        ok: false,
        error: "Configuration values must be greater than zero.",
      };
    }

    state.system = {
      ...state.system,
      ...nextConfig,
    };

    appendTransaction({
      userId: "system",
      userName: "System",
      type: "system",
      amount: 0,
      details: "System configuration updated: kg per bottle and max bottle capacity.",
    });

    emit();
    return {
      ok: true,
    };
  },

  restockRice(amountKg) {
    const amount = roundToThree(toNumber(amountKg, 0));
    if (amount <= 0) {
      return {
        ok: false,
        error: "Restock amount must be greater than zero.",
      };
    }

    state.system.riceStock = roundToThree(state.system.riceStock + amount);

    appendTransaction({
      userId: "system",
      userName: "System",
      type: "system",
      amount,
      kgDelta: 0,
      riceDeltaKg: amount,
      bottleDelta: 0,
      details: `Rice restocked by ${amount} kg.`,
    });

    appendNotification({
      title: "Rice Restocked",
      message: `${amount} kg of rice was added to storage.`,
      targetRole: "all",
      type: "info",
    });

    emit();
    return {
      ok: true,
    };
  },

  clearBottleStorage() {
    state.system.bottleStorage = 0;

    appendTransaction({
      userId: "system",
      userName: "System",
      type: "system",
      amount: 0,
      kgDelta: 0,
      riceDeltaKg: 0,
      bottleDelta: 0,
      details: "Bottle storage cleared by admin.",
    });

    appendNotification({
      title: "Bottle Storage Cleared",
      message: "Bottle storage level has been reset to zero.",
      targetRole: "admin",
      type: "info",
    });

    emit();
    return {
      ok: true,
    };
  },

  sendManualNotification(payload) {
    const title = String(payload.title || "").trim();
    const message = String(payload.message || "").trim();
    const targetRole = payload.targetRole || "all";
    const userId = payload.userId || null;

    if (!title || !message) {
      return {
        ok: false,
        error: "Notification title and message are required.",
      };
    }

    if (targetRole === "user" && !userId) {
      return {
        ok: false,
        error: "Select a household user when target is specific user.",
      };
    }

    appendNotification({
      title,
      message,
      targetRole: targetRole === "user" ? "user" : targetRole,
      userId: targetRole === "user" ? userId : null,
      type: "info",
    });

    emit();
    return {
      ok: true,
    };
  },

  markNotificationRead(notificationId, userId) {
    const notification = state.notifications.find(
      (item) => item.id === notificationId
    );
    if (!notification || !userId) {
      return {
        ok: false,
      };
    }

    if (notification.readBy.includes(userId)) {
      return {
        ok: true,
      };
    }

    notification.readBy.push(userId);
    emit();
    return {
      ok: true,
    };
  },

  markAllNotificationsRead(user) {
    if (!user) {
      return {
        ok: false,
      };
    }

    let changed = false;
    state.notifications.forEach((notification) => {
      if (
        isNotificationForUser(notification, user) &&
        !notification.readBy.includes(user.id)
      ) {
        notification.readBy.push(user.id);
        changed = true;
      }
    });

    if (changed) {
      emit();
    }

    return {
      ok: true,
    };
  },
};

export { isNotificationForUser, normalizeState };
