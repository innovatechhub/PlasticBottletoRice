import { createContext, useContext, useEffect, useState } from "react";
import { dataStore } from "../services/localStore";

const AuthContext = createContext(null);
const SESSION_KEY = "pbtr_active_user";

function readSavedUserId() {
  try {
    return localStorage.getItem(SESSION_KEY) || "";
  } catch {
    return "";
  }
}

function persistActiveSession(userId) {
  try {
    localStorage.setItem(SESSION_KEY, userId);
  } catch {}
}

function clearActiveSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {}
}

export function AuthProvider({ children }) {
  const [activeUserId, setActiveUserId] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [resolvingUser, setResolvingUser] = useState(false);

  // Subscribe to dataStore so currentUser stays in sync with remote changes
  useEffect(() => {
    const unsubscribe = dataStore.subscribe((snapshot) => {
      if (!activeUserId) {
        setCurrentUser(null);
        setResolvingUser(false);
        return;
      }

      const matchedUser =
        snapshot.users.find((user) => user.id === activeUserId) || null;

      if (!matchedUser) {
        setCurrentUser(null);
        setResolvingUser(true);
        return;
      }

      setCurrentUser(matchedUser);
      setResolvingUser(false);
    });

    return unsubscribe;
  }, [activeUserId]);

  // Restore session from localStorage on mount (synchronous read — no async race)
  useEffect(() => {
    const savedId = readSavedUserId();
    if (savedId) {
      setActiveUserId(savedId);
      setResolvingUser(true);
    }
    setSessionReady(true);
  }, []);

  // Fallback: if the user ID from localStorage no longer resolves to a known
  // user within 5 s (e.g. user was deleted), clear the stale session.
  useEffect(() => {
    if (!sessionReady || !activeUserId || currentUser || !resolvingUser) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      clearActiveSession();
      setActiveUserId("");
      setCurrentUser(null);
      setResolvingUser(false);
    }, 5000);

    return () => window.clearTimeout(timeoutId);
  }, [sessionReady, activeUserId, currentUser, resolvingUser]);

  const login = ({ email, password }) => {
    const result = dataStore.login(email, password);
    if (!result.ok) {
      return result;
    }

    persistActiveSession(result.user.id);
    setActiveUserId(result.user.id);
    setCurrentUser(result.user);
    setResolvingUser(false);

    return { ok: true, user: result.user };
  };

  const logout = () => {
    clearActiveSession();
    setActiveUserId("");
    setCurrentUser(null);
    setResolvingUser(false);
  };

  const value = {
    currentUser,
    loading:
      !sessionReady ||
      (Boolean(activeUserId) && resolvingUser && !currentUser),
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }
  return context;
}
