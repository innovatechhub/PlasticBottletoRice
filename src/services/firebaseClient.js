import { getApps, initializeApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  inMemoryPersistence,
  initializeAuth,
  signOut,
} from "firebase/auth";
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

// Username logins are stored in Firebase Auth as <username>@<project>.firebaseapp.com.
// That domain belongs to the Firebase project and has no mailbox. scripts/admin-tools.js
// uses the same mapping.
export const USERNAME_LOGIN_DOMAIN = `${firebaseConfig.projectId}.firebaseapp.com`;
export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,29}$/;
export const USERNAME_RULES =
  "3-30 characters: lowercase letters, numbers, dots, dashes or underscores.";

export const normalizeLoginId = (value) => String(value || "").trim().toLowerCase();

// Accepts a username or an email and returns the email Firebase Auth uses.
export function toLoginEmail(loginId) {
  const id = normalizeLoginId(loginId);
  return id.includes("@") ? id : `${id}@${USERNAME_LOGIN_DOMAIN}`;
}

export function isUsernameLogin(email) {
  return normalizeLoginId(email).endsWith(`@${USERNAME_LOGIN_DOMAIN}`);
}

// What to show an admin as a resident's login: their username, or email for older accounts.
export function displayLoginId(user) {
  if (user?.username) return user.username;
  const email = String(user?.email || "");
  return isUsernameLogin(email) ? email.split("@")[0] : email;
}

export function hasSignedInUser() {
  return Boolean(firebaseAuth?.currentUser);
}

// Creating a user with the client SDK signs that user in, so resident logins are
// created on a separate, non-persisted app instance to keep the admin signed in.
const PROVISIONING_APP_NAME = "resident-provisioning";
let provisioningAuth = null;

function getProvisioningAuth() {
  if (!provisioningAuth) {
    const app =
      getApps().find((item) => item.name === PROVISIONING_APP_NAME) ||
      initializeApp(firebaseConfig, PROVISIONING_APP_NAME);
    provisioningAuth = initializeAuth(app, { persistence: inMemoryPersistence });
  }
  return provisioningAuth;
}

export async function createResidentLogin(email, password) {
  if (!firebaseApp) {
    throw new Error("Firebase not configured.");
  }
  const auth = getProvisioningAuth();
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  await signOut(auth);
  return credential.user.uid;
}
