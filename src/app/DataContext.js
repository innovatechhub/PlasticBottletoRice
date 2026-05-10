import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { dataStore } from "../services/localStore";
import { getSyncMode, startCloudSync } from "../services/cloudSync";

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
      addUser: (payload) => dataStore.addUser(payload),
      updateUser: (userId, updates) => dataStore.updateUser(userId, updates),
      deleteUser: (userId) => dataStore.deleteUser(userId),
      insertBottle: (userId, bottleCount) =>
        dataStore.insertBottle(userId, bottleCount),
      redeemRice: (userId, pointsToRedeem) =>
        dataStore.redeemRice(userId, pointsToRedeem),
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
