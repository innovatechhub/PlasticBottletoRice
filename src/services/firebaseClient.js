import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";

const fallbackFirebaseConfig = {
  apiKey: "AIzaSyCD0HR0qKk5BDbT1xD8OGSn06Y_80MP3ZI",
  authDomain: "plastictorice.firebaseapp.com",
  databaseURL: "https://plastictorice-default-rtdb.firebaseio.com",
  projectId: "plastictorice",
  storageBucket: "plastictorice.firebasestorage.app",
  messagingSenderId: "938982719172",
  appId: "1:938982719172:web:034513005aef65be44d391",
  measurementId: "G-DXMGSKP9S2",
};

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || fallbackFirebaseConfig.apiKey,
  authDomain:
    process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || fallbackFirebaseConfig.authDomain,
  databaseURL:
    process.env.REACT_APP_FIREBASE_DATABASE_URL || fallbackFirebaseConfig.databaseURL,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || fallbackFirebaseConfig.projectId,
  storageBucket:
    process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || fallbackFirebaseConfig.storageBucket,
  messagingSenderId:
    process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID ||
    fallbackFirebaseConfig.messagingSenderId,
  appId: process.env.REACT_APP_FIREBASE_APP_ID || fallbackFirebaseConfig.appId,
  measurementId:
    process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || fallbackFirebaseConfig.measurementId,
};

const requiredConfigValues = [
  firebaseConfig.apiKey,
  firebaseConfig.authDomain,
  firebaseConfig.projectId,
  firebaseConfig.storageBucket,
  firebaseConfig.messagingSenderId,
  firebaseConfig.appId,
];

export const isFirebaseConfigured = requiredConfigValues.every(
  (value) => typeof value === "string" && value.trim() !== ""
);

export const firebaseApp = isFirebaseConfigured
  ? initializeApp(firebaseConfig)
  : null;

export const firebaseAuth = firebaseApp ? getAuth(firebaseApp) : null;
export const firestoreDb = firebaseApp ? getFirestore(firebaseApp) : null;
export const realtimeDb =
  firebaseApp && firebaseConfig.databaseURL ? getDatabase(firebaseApp) : null;

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
