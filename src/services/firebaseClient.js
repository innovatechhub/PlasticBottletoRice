import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

const configValues = Object.values(firebaseConfig);

export const isFirebaseConfigured = configValues.every(
  (value) => typeof value === "string" && value.trim() !== ""
);

export const firebaseApp = isFirebaseConfigured
  ? initializeApp(firebaseConfig)
  : null;

export const firebaseAuth = firebaseApp ? getAuth(firebaseApp) : null;
export const firestoreDb = firebaseApp ? getFirestore(firebaseApp) : null;

let sessionPromise = null;

export async function ensureFirebaseSession() {
  if (!firebaseAuth) {
    return false;
  }

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
