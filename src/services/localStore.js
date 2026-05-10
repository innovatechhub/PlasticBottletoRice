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

const roundToTwo = (value) => Math.round(value * 100) / 100;

const cloneDeep = (value) => JSON.parse(JSON.stringify(value));

const seedState = () => ({
  users: [
    {
      id: REQUIRED_ADMIN_ACCOUNT.id,
      name: REQUIRED_ADMIN_ACCOUNT.name,
      email: REQUIRED_ADMIN_ACCOUNT.email,
      password: REQUIRED_ADMIN_ACCOUNT.password,
      role: REQUIRED_ADMIN_ACCOUNT.role,
      points: 0,
      createdAt: now(),
    },
    {
      id: REQUIRED_HOUSEHOLD_ACCOUNT.id,
      name: REQUIRED_HOUSEHOLD_ACCOUNT.name,
      email: REQUIRED_HOUSEHOLD_ACCOUNT.email,
      password: REQUIRED_HOUSEHOLD_ACCOUNT.password,
      role: REQUIRED_HOUSEHOLD_ACCOUNT.role,
      points: 0,
      createdAt: now(),
    },
  ],
  transactions: [],
  notifications: [],
  system: {
    riceStock: 0,
    bottleStorage: 0,
    maxBottleCapacity: 500,
    pointsPerBottle: 2,
    ricePerPoint: 0.1,
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

  if (!candidateState || typeof candidateState !== "object") {
    return base;
  }

  const users = Array.isArray(candidateState.users)
    ? candidateState.users
        .map((user) => ({
          id: user.id || createId("user"),
          name: user.name || "Unnamed Household",
          email: String(user.email || "").toLowerCase(),
          password: user.password || "user123",
          role: user.role === "admin" ? "admin" : "user",
          points: Math.max(0, toNumber(user.points, 0)),
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
      points: 0,
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
    transactions: Array.isArray(candidateState.transactions)
      ? candidateState.transactions
      : base.transactions,
    notifications: Array.isArray(candidateState.notifications)
      ? candidateState.notifications
      : base.notifications,
    system: {
      ...base.system,
      ...(candidateState.system || {}),
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
  pointsDelta = 0,
  riceDeltaKg = 0,
  bottleDelta = 0,
  details = "",
}) => {
  const transaction = {
    id: createId("tx"),
    userId,
    userName,
    type,
    amount,
    pointsDelta,
    riceDeltaKg,
    bottleDelta,
    details,
    timestamp: now(),
  };
  state.transactions.unshift(transaction);
  return transaction;
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
    const initialPoints = Math.max(0, toNumber(payload.points, 0));

    if (!name || !email || !password) {
      return {
        ok: false,
        error: "Name, email, and password are required.",
      };
    }

    const emailExists = state.users.some((user) => user.email === email);
    if (emailExists) {
      return {
        ok: false,
        error: "Email is already used by another account.",
      };
    }

    const user = {
      id: createId("user"),
      name,
      email,
      password,
      role: "user",
      points: initialPoints,
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
      const duplicate = state.users.some(
        (item) => item.id !== userId && item.email === email
      );
      if (duplicate) {
        return {
          ok: false,
          error: "Email is already used by another account.",
        };
      }
      user.email = email;
    }

    if (typeof updates.password !== "undefined" && updates.password !== "") {
      user.password = String(updates.password);
    }

    if (typeof updates.points !== "undefined") {
      user.points = Math.max(0, toNumber(updates.points, user.points));
    }

    emit();
    return {
      ok: true,
      user: sanitizeUser(user),
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
    const pointsEarned = count * toNumber(state.system.pointsPerBottle, 1);
    const previousStorage = state.system.bottleStorage;

    user.points = roundToTwo(user.points + pointsEarned);
    state.system.bottleStorage = Math.max(0, previousStorage + count);

    appendTransaction({
      userId: user.id,
      userName: user.name,
      type: "bottle",
      amount: count,
      pointsDelta: pointsEarned,
      riceDeltaKg: 0,
      bottleDelta: count,
      details: `${count} bottle(s) inserted.`,
    });

    appendNotification({
      title: "Bottle Recorded",
      message: `You earned ${pointsEarned} points from ${count} bottle(s).`,
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
      pointsEarned,
    };
  },

  redeemRice(userId, pointsToRedeem) {
    const user = getUserById(userId);
    if (!user) {
      return {
        ok: false,
        error: "User not found.",
      };
    }

    const points = Math.max(1, Math.floor(toNumber(pointsToRedeem, 0)));
    const riceKg = roundToTwo(points * toNumber(state.system.ricePerPoint, 0.1));

    if (user.points < points) {
      return {
        ok: false,
        error: "Not enough points for this redemption.",
      };
    }

    if (state.system.riceStock < riceKg) {
      return {
        ok: false,
        error: "Rice stock is not enough for this redemption.",
      };
    }

    const previousRice = state.system.riceStock;
    user.points = roundToTwo(user.points - points);
    state.system.riceStock = roundToTwo(state.system.riceStock - riceKg);

    appendTransaction({
      userId: user.id,
      userName: user.name,
      type: "redeem",
      amount: riceKg,
      pointsDelta: -points,
      riceDeltaKg: -riceKg,
      bottleDelta: 0,
      details: `${points} points converted to ${riceKg} kg rice.`,
    });

    appendNotification({
      title: "Redemption Successful",
      message: `You redeemed ${riceKg} kg rice using ${points} points.`,
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
      pointsPerBottle: toNumber(
        updates.pointsPerBottle,
        state.system.pointsPerBottle
      ),
      ricePerPoint: toNumber(updates.ricePerPoint, state.system.ricePerPoint),
      maxBottleCapacity: Math.max(
        1,
        Math.floor(
          toNumber(updates.maxBottleCapacity, state.system.maxBottleCapacity)
        )
      ),
    };

    if (nextConfig.pointsPerBottle <= 0 || nextConfig.ricePerPoint <= 0) {
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
      details:
        "System configuration updated: points per bottle, rice per point, and max bottle capacity.",
    });

    emit();
    return {
      ok: true,
    };
  },

  restockRice(amountKg) {
    const amount = roundToTwo(toNumber(amountKg, 0));
    if (amount <= 0) {
      return {
        ok: false,
        error: "Restock amount must be greater than zero.",
      };
    }

    state.system.riceStock = roundToTwo(state.system.riceStock + amount);

    appendTransaction({
      userId: "system",
      userName: "System",
      type: "system",
      amount,
      pointsDelta: 0,
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
      pointsDelta: 0,
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
