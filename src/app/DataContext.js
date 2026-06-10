import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { dataStore } from "../services/localStore";
import {
  deleteHouseholdUserFromFirestore,
  getSyncMode,
  saveHouseholdUserToFirestore,
  startCloudSync,
} from "../services/cloudSync";

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const [state, setState] = useState(dataStore.getState());
  const [syncMode, setSyncMode] = useState(getSyncMode());

  useEffect(() => {
    startCloudSync();
    const unsubscribe = dataStore.subscribe((snapshot) => {
      setState(snapshot);
      setSyncMode(getSyncMode());
    });
    return unsubscribe;
  }, []);

  const actions = useMemo(
    () => ({
      addUser: async (payload) => {
        const result = dataStore.addUser(payload);
        if (!result.ok) {
          return result;
        }

        const syncResult = await saveHouseholdUserToFirestore(result.rawUser);
        if (!syncResult.ok) {
          return {
            ok: false,
            error:
              syncResult.error ||
              "Household user was created locally but could not be saved to Firestore.",
          };
        }

        return result;
      },
      updateUser: async (userId, updates) => {
        const result = dataStore.updateUser(userId, updates);
        if (!result.ok) {
          return result;
        }

        const syncResult = await saveHouseholdUserToFirestore(result.rawUser);
        if (!syncResult.ok) {
          return {
            ok: false,
            error:
              syncResult.error ||
              "Household user was updated locally but could not be saved to Firestore.",
          };
        }

        return result;
      },
      deleteUser: async (userId) => {
        const currentUser =
          dataStore.getRawState().users.find(
            (user) => user.id === userId && user.role === "user"
          ) || null;
        const result = dataStore.deleteUser(userId);
        if (!result.ok) {
          return result;
        }

        if (currentUser) {
          const syncResult = await deleteHouseholdUserFromFirestore(userId);
          if (!syncResult.ok) {
            return {
              ok: false,
              error:
                syncResult.error ||
                "Household user was deleted locally but could not be removed from Firestore.",
            };
          }
        }

        return result;
      },
      insertBottle: (userId, bottleCount) =>
        dataStore.insertBottle(userId, bottleCount),
      insertBottleFromHardware: (userId, weightKg, binId) =>
        dataStore.insertBottleFromHardware(userId, weightKg, binId),
      updateBinAssignment: (binId, userId, userName) =>
        dataStore.updateBinAssignment(binId, userId, userName),
      redeemRice: (userId, kgToRedeem) =>
        dataStore.redeemRice(userId, kgToRedeem),
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
