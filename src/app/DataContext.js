import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { dataStore } from "../services/localStore";
import {
  flushWrites,
  getSyncMode,
  setResidentFlag,
} from "../services/cloudSync";
import {
  createResidentLogin,
  firebaseAuth,
  normalizeLoginId,
  toLoginEmail,
  USERNAME_PATTERN,
  USERNAME_RULES,
} from "../services/firebaseClient";

const DataContext = createContext(null);

const MIN_PASSWORD_LENGTH = 6;

// Where api/admin-reset-password.js is deployed. Empty means the same origin
// (the web app itself is hosted on Vercel).
const ADMIN_API_URL = (process.env.REACT_APP_ADMIN_API_URL || "").replace(/\/$/, "");

const CREATE_LOGIN_ERRORS = {
  "auth/email-already-in-use": "That username is already taken.",
  "auth/invalid-email": `Invalid username. ${USERNAME_RULES}`,
  "auth/weak-password": `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
  "auth/operation-not-allowed":
    "Email/password sign-in is disabled in the Firebase console.",
};

export function DataProvider({ children }) {
  const [state, setState] = useState(dataStore.getState());
  const [syncMode, setSyncMode] = useState(getSyncMode());

  useEffect(() => {
    const unsubscribe = dataStore.subscribe((snapshot) => {
      setState(snapshot);
      setSyncMode(getSyncMode());
    });
    return unsubscribe;
  }, []);

  const actions = useMemo(
    () => ({
      addUser: async (payload) => {
        const name = String(payload.name || "").trim();
        const username = normalizeLoginId(payload.username);
        const password = String(payload.password || "");
        const barangay = String(payload.barangay || "").trim();

        if (!name || !username || !barangay) {
          return { ok: false, error: "Name, username, and barangay are required." };
        }
        if (!USERNAME_PATTERN.test(username)) {
          return { ok: false, error: `Invalid username. ${USERNAME_RULES}` };
        }
        const email = toLoginEmail(username);
        if (password.length < MIN_PASSWORD_LENGTH) {
          return {
            ok: false,
            error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
          };
        }

        let uid;
        try {
          uid = await createResidentLogin(email, password);
        } catch (error) {
          return {
            ok: false,
            error: CREATE_LOGIN_ERRORS[error.code] || error.message,
          };
        }

        const result = dataStore.addUser({ id: uid, name, username, email, barangay });
        if (!result.ok) {
          return result;
        }

        const [syncResult, flagResult] = await Promise.all([
          flushWrites(),
          setResidentFlag(uid, true),
        ]);
        if (!syncResult.ok || !flagResult.ok) {
          return {
            ok: false,
            error: `Login created for ${username}, but saving the resident profile failed: ${
              syncResult.error || flagResult.error
            }`,
          };
        }

        return result;
      },
      updateUser: async (userId, updates) => {
        const result = dataStore.updateUser(userId, {
          name: updates.name,
          barangay: updates.barangay,
          weightKg: updates.weightKg,
        });
        if (!result.ok) {
          return result;
        }

        const syncResult = await flushWrites();
        return syncResult.ok ? result : syncResult;
      },
      // Removes the resident's profile, which blocks their login from all data.
      // Their Firebase Auth login itself can only be deleted with scripts/admin-tools.js.
      deleteUser: async (userId) => {
        const result = dataStore.deleteUser(userId);
        if (!result.ok) {
          return result;
        }

        const [syncResult] = await Promise.all([
          flushWrites(),
          setResidentFlag(userId, false),
        ]);
        return syncResult.ok ? result : syncResult;
      },
      // Runs on the server (api/admin-reset-password.js); the browser can't change
      // another user's password.
      resetResidentPassword: async (userId, newPassword) => {
        if (String(newPassword || "").length < MIN_PASSWORD_LENGTH) {
          return {
            ok: false,
            error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
          };
        }
        const admin = firebaseAuth?.currentUser;
        if (!admin) {
          return { ok: false, error: "Sign in as an admin first." };
        }
        try {
          const response = await fetch(`${ADMIN_API_URL}/api/admin-reset-password`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${await admin.getIdToken()}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ userId, newPassword }),
          });
          const body = await response.json().catch(() => ({}));
          if (!response.ok) {
            return {
              ok: false,
              error: body.error || `Password reset failed (HTTP ${response.status}).`,
            };
          }
          return { ok: true };
        } catch {
          return {
            ok: false,
            error: "Could not reach the password reset service. Check that it is deployed.",
          };
        }
      },
      insertBottle: (userId, bottleCount) =>
        dataStore.insertBottle(userId, bottleCount),
      insertBottleFromHardware: (userId, weightKg, binId) =>
        dataStore.insertBottleFromHardware(userId, weightKg, binId),
      finalizeBottleSession: (userId, bottleWeightsKg, binId) =>
        dataStore.finalizeBottleSession(userId, bottleWeightsKg, binId),
      updateBinAssignment: (binId, userId, userName) =>
        dataStore.updateBinAssignment(binId, userId, userName),
      addBin: (binId, userId, userName) =>
        dataStore.addBin(binId, userId, userName),
      redeemRice: (userId, kgToRedeem) =>
        dataStore.redeemRice(userId, kgToRedeem),
      declineRedemption: (transactionId) =>
        dataStore.declineRedemption(transactionId),
      updateSystemConfig: (updates) => dataStore.updateSystemConfig(updates),
      restockRice: (amountKg) => dataStore.restockRice(amountKg),
      clearBottleStorage: () => dataStore.clearBottleStorage(),
      sendManualNotification: (payload) =>
        dataStore.sendManualNotification(payload),
      markNotificationRead: (notificationId, userId) =>
        dataStore.markNotificationRead(notificationId, userId),
      markAllNotificationsRead: (user) => dataStore.markAllNotificationsRead(user),
    }),
    []
  );

  const value = useMemo(
    () => ({
      ...state,
      syncMode,
      actions,
    }),
    [state, syncMode, actions]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error("useData must be used inside DataProvider.");
  }
  return context;
}
