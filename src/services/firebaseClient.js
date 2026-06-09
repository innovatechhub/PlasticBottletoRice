import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL,
};

const configValues = Object.values(firebaseConfig);

export const isFirebaseConfigured = configValues.every(
  (value) => typeof value === "string" && value.trim() !== ""
);

export const firebaseApp = isFirebaseConfigured
  ? initializeApp(firebaseConfig)
  : null;

export const firebaseAuth = firebaseApp ? getAuth(firebaseApp) : null;
export const realtimeDb = firebaseApp ? getDatabase(firebaseApp) : null;

// Resolves once Firebase has loaded the persisted auth state from localStorage.
// Without awaiting this, currentUser may be null immediately after page load
// even when a session was previously saved, causing signInAnonymously to create
// a new UID and breaking session restoration.
const authReady = firebaseAuth
  ? new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
        unsubscribe();
        resolve(user);
      });
    })
  : Promise.resolve(null);

let sessionPromise = null;

export async function ensureFirebaseSession() {
  if (!firebaseAuth) {
    return false;
  }

  // Wait for Firebase to finish restoring auth state from localStorage
  // before checking currentUser or calling signInAnonymously.
  await authReady;

  if (firebaseAuth.currentUser) {
    return true;
  }

  if (!sessionPromise) {
    sessionPromise = signInAnonymously(firebaseAuth)
      .then(() => true)
      .catch(() => false)
      .finally(() => {
        sessionPromise = null;
      });
  }

  return sessionPromise;
}
