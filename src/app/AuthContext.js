import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { dataStore } from "../services/localStore";
import { firebaseAuth, toLoginEmail } from "../services/firebaseClient";
import {
  getSyncMode,
  startCloudSync,
  stopCloudSync,
} from "../services/cloudSync";

const AuthContext = createContext(null);

// Older builds stored the signed-in user id here, which let anyone pick an identity.
const LEGACY_SESSION_KEY = "pbtr_active_user";

const LOGIN_ERRORS = {
  "auth/invalid-credential": "Invalid credentials. Check your username and password.",
  "auth/wrong-password": "Invalid credentials. Check your username and password.",
  "auth/user-not-found": "Invalid credentials. Check your username and password.",
  "auth/invalid-email": "Enter a valid username.",
  "auth/user-disabled": "This account has been disabled.",
  "auth/too-many-requests": "Too many attempts. Wait a moment and try again.",
  "auth/network-request-failed": "Network error. Check your connection.",
};

export function AuthProvider({ children }) {
  // { uid, role, name, email } once the signed-in user's role and data are loaded.
  const [session, setSession] = useState(null);
  const [residentProfile, setResidentProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_SESSION_KEY);
    } catch {}

    if (!firebaseAuth) {
      setLoading(false);
      return undefined;
    }

    return onAuthStateChanged(firebaseAuth, async (user) => {
      if (!user) {
        stopCloudSync();
        setSession(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const { claims } = await user.getIdTokenResult();
        if (claims.role === "device") {
          throw new Error("Bin device accounts cannot sign in to the web app.");
        }
        const role = claims.role === "admin" ? "admin" : "user";

        const result = await startCloudSync({ uid: user.uid, role });
        if (!result.ok) {
          throw new Error(result.error);
        }

        setAuthError("");
        setSession({
          uid: user.uid,
          role,
          name: user.displayName || "Admin",
          email: user.email || "",
        });
      } catch (error) {
        setAuthError(error.message);
        setSession(null);
        await signOut(firebaseAuth);
      } finally {
        setLoading(false);
      }
    });
  }, []);

  // Residents' profile (name, balance, ...) lives in Firestore and updates live.
  useEffect(() => {
    if (session?.role !== "user") {
      setResidentProfile(null);
      return undefined;
    }

    return dataStore.subscribe((snapshot) => {
      const profile =
        snapshot.users.find((user) => user.id === session.uid) || null;
      setResidentProfile(profile);

      // A resident whose profile was deleted while signed in is signed out.
      if (!profile && getSyncMode() === "firebase" && firebaseAuth) {
        setAuthError("Your resident profile was removed. Contact the admin.");
        signOut(firebaseAuth);
      }
    });
  }, [session]);

  const currentUser = useMemo(() => {
    if (session?.role === "admin") {
      return {
        id: session.uid,
        name: session.name,
        email: session.email,
        role: "admin",
      };
    }
    if (session?.role === "user") {
      return residentProfile;
    }
    return null;
  }, [session, residentProfile]);

  // `loginId` is a username, or an email for admins and older resident accounts.
  const login = async ({ loginId, password }) => {
    if (!firebaseAuth) {
      return { ok: false, error: "Firebase is not configured." };
    }
    setAuthError("");
    try {
      await signInWithEmailAndPassword(
        firebaseAuth,
        toLoginEmail(loginId),
        String(password || "")
      );
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: LOGIN_ERRORS[error.code] || "Sign-in failed. Please try again.",
      };
    }
  };

  const logout = async () => {
    if (firebaseAuth) {
      await signOut(firebaseAuth);
    }
  };

  const value = {
    currentUser,
    loading: loading || (session?.role === "user" && !residentProfile),
    authError,
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
