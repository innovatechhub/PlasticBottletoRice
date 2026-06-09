import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import { deleteDoc, doc, getDoc, setDoc } from "firebase/firestore";
import { dataStore } from "../services/localStore";
import {
  ensureFirebaseSession,
  firebaseAuth,
  firestoreDb,
  isFirebaseConfigured,
} from "../services/firebaseClient";

const AuthContext = createContext(null);
const SESSIONS_COLLECTION = "sessions";

export function AuthProvider({ children }) {
  const [activeUserId, setActiveUserId] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [resolvingUser, setResolvingUser] = useState(false);

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

  useEffect(() => {
    let mounted = true;

    const restoreSession = async () => {
      try {
        if (!isFirebaseConfigured || !firestoreDb || !firebaseAuth) {
          return;
        }

        const ready = await ensureFirebaseSession();
        if (!ready || !firebaseAuth.currentUser) {
          return;
        }

        const sessionRef = doc(
          firestoreDb,
          SESSIONS_COLLECTION,
          firebaseAuth.currentUser.uid
        );
        const snapshot = await getDoc(sessionRef);
        if (!mounted || !snapshot.exists()) {
          return;
        }

        const restoredUserId = String(snapshot.data()?.activeUserId || "");
        if (restoredUserId) {
          setResolvingUser(true);
          setActiveUserId(restoredUserId);
        }
      } finally {
        if (mounted) {
          setSessionReady(true);
        }
      }
    };

    restoreSession();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!sessionReady || !activeUserId || currentUser || !resolvingUser) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setActiveUserId("");
      setCurrentUser(null);
      setResolvingUser(false);
      clearActiveSession().catch(() => {});
    }, 5000);

    return () => window.clearTimeout(timeoutId);
  }, [sessionReady, activeUserId, currentUser, resolvingUser]);

  const persistActiveSession = async (userId) => {
    if (!isFirebaseConfigured || !firestoreDb || !firebaseAuth) {
      return;
    }
    const ready = await ensureFirebaseSession();
    if (!ready || !firebaseAuth.currentUser) {
      return;
    }

    await setDoc(
      doc(firestoreDb, SESSIONS_COLLECTION, firebaseAuth.currentUser.uid),
      {
        activeUserId: userId,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  };

  const clearActiveSession = async () => {
    if (!isFirebaseConfigured || !firestoreDb || !firebaseAuth) {
      return;
    }
    const ready = await ensureFirebaseSession();
    if (!ready || !firebaseAuth.currentUser) {
      return;
    }

    await deleteDoc(doc(firestoreDb, SESSIONS_COLLECTION, firebaseAuth.currentUser.uid));
  };

  const login = ({ email, password }) => {
    const result = dataStore.login(email, password);
    if (!result.ok) {
      return result;
    }

    setResolvingUser(true);
    setActiveUserId(result.user.id);
    setCurrentUser(result.user);
    setResolvingUser(false);
    persistActiveSession(result.user.id).catch(() => {});

    return {
      ok: true,
      user: result.user,
    };
  };

  const logout = () => {
    setActiveUserId("");
    setCurrentUser(null);
    setResolvingUser(false);
    clearActiveSession().catch(() => {});
  };

  const value = {
    currentUser,
    loading: !sessionReady || (Boolean(activeUserId) && resolvingUser && !currentUser),
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }
  return context;
}
