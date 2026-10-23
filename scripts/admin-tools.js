#!/usr/bin/env node
/*
 * Firebase account tools that need the Admin SDK (run on a trusted computer, not in the browser).
 *
 * Setup:
 *   1. Firebase console -> Project settings -> Service accounts -> Generate new private key.
 *   2. Save the JSON outside the repo (or as serviceAccountKey.json, which is git-ignored).
 *   3. Point GOOGLE_APPLICATION_CREDENTIALS at it, e.g. in PowerShell:
 *        $env:GOOGLE_APPLICATION_CREDENTIALS="C:\path\to\serviceAccountKey.json"
 *
 * Usage (npm run admin -- <command> ...). <login> is a username or an email:
 *   create-admin  <login> <password> [name]   Create/upgrade an admin login
 *   create-device <login> <password> <binId>  Create/upgrade an ESP32 bin login
 *   migrate-residents                         Give every household doc a Firebase login
 *                                             and remove stored plaintext passwords
 *   set-password  <login> <newPassword>       Change any user's password
 *   delete-login  <login>                     Delete a login (e.g. after removing a resident)
 */
const crypto = require("crypto");
const fs = require("fs");
const { initializeApp, applicationDefault } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getDatabase } = require("firebase-admin/database");

const DATABASE_URL =
  process.env.FIREBASE_DATABASE_URL ||
  "https://plastictorice-default-rtdb.firebaseio.com";
const MIN_PASSWORD_LENGTH = 6;

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  fail(
    "Set GOOGLE_APPLICATION_CREDENTIALS to the path of your Firebase service account JSON."
  );
}

initializeApp({ credential: applicationDefault(), databaseURL: DATABASE_URL });
const auth = getAuth();
const firestore = getFirestore();
const rtdb = getDatabase();

function readProjectId() {
  try {
    const key = JSON.parse(fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, "utf8"));
    if (key.project_id) return key.project_id;
  } catch {}
  return process.env.FIREBASE_PROJECT_ID || "plastictorice";
}

// Must match USERNAME_LOGIN_DOMAIN in src/services/firebaseClient.js.
const USERNAME_LOGIN_DOMAIN = `${readProjectId()}.firebaseapp.com`;
const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,29}$/;

// Turns a username into the email Firebase Auth uses; emails pass through unchanged.
function toLoginEmail(loginId) {
  const id = String(loginId || "").trim().toLowerCase();
  if (id.includes("@")) return id;
  if (!USERNAME_PATTERN.test(id)) {
    fail("Usernames are 3-30 characters: lowercase letters, numbers, dots, dashes or underscores.");
  }
  return `${id}@${USERNAME_LOGIN_DOMAIN}`;
}

function requirePassword(password) {
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    fail(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
}

async function findUserByEmail(email) {
  try {
    return await auth.getUserByEmail(email);
  } catch (error) {
    if (error.code === "auth/user-not-found") return null;
    throw error;
  }
}

async function upsertLogin({ email, password, displayName }) {
  const existing = await findUserByEmail(email);
  if (existing) {
    return auth.updateUser(existing.uid, { password, displayName });
  }
  return auth.createUser({ email, password, displayName });
}

async function createAdmin(loginId, password, name = "Admin") {
  requirePassword(password);
  const email = toLoginEmail(loginId);
  const user = await upsertLogin({ email, password, displayName: name });
  await auth.setCustomUserClaims(user.uid, { role: "admin" });
  console.log(`Admin login ready: ${loginId} (uid ${user.uid}).`);
}

async function createDevice(loginId, password, binId) {
  requirePassword(password);
  if (!binId) fail("binId is required.");
  const email = toLoginEmail(loginId);
  const user = await upsertLogin({ email, password, displayName: `Bin ${binId}` });
  await auth.setCustomUserClaims(user.uid, { role: "device", binId });
  console.log(`Device login ready for ${binId} (uid ${user.uid}).`);
  console.log("Put these in caspstone_project/include/secrets.h:");
  console.log(`  #define DEVICE_EMAIL      "${email}"`);
  console.log(`  #define DEVICE_PASSWORD   "<the password you just set>"`);
}

async function migrateResidents() {
  const snapshot = await firestore.collection("household").get();
  const tempPasswords = [];
  let migrated = 0;
  let skipped = 0;

  for (const docSnap of snapshot.docs) {
    const uid = docSnap.id;
    const data = docSnap.data();
    const email = String(data.email || "").trim().toLowerCase();
    if (!email) {
      console.warn(`- ${uid}: no email, skipped.`);
      skipped += 1;
      continue;
    }

    let login = null;
    try {
      login = await auth.getUser(uid);
    } catch (error) {
      if (error.code !== "auth/user-not-found") throw error;
    }

    if (!login) {
      const emailOwner = await findUserByEmail(email);
      if (emailOwner) {
        console.warn(
          `- ${uid}: ${email} already belongs to another login (${emailOwner.uid}); skipped.`
        );
        skipped += 1;
        continue;
      }

      let password = String(data.password || "");
      if (password.length < MIN_PASSWORD_LENGTH) {
        password = crypto.randomBytes(6).toString("base64url");
        tempPasswords.push({ name: data.name, email, password });
      }
      await auth.createUser({ uid, email, password, displayName: data.name || "" });
    }

    await docSnap.ref.update({ password: FieldValue.delete() });
    await rtdb.ref(`residents/${uid}`).set(true);
    migrated += 1;
    console.log(`- ${uid}: ${email} migrated.`);
  }

  // Older builds also kept users (with passwords) in the Realtime Database.
  for (const legacyPath of ["users", "household"]) {
    const legacy = await rtdb.ref(legacyPath).get();
    if (!legacy.exists()) continue;
    const updates = {};
    legacy.forEach((child) => {
      if (child.child("password").exists()) {
        updates[`${child.key}/password`] = null;
      }
    });
    if (Object.keys(updates).length > 0) {
      await rtdb.ref(legacyPath).update(updates);
      console.log(
        `Removed ${Object.keys(updates).length} plaintext password(s) from RTDB /${legacyPath}.`
      );
    }
  }

  console.log(`\nMigrated ${migrated} resident(s), skipped ${skipped}.`);
  if (tempPasswords.length > 0) {
    console.log(
      "\nThese residents had passwords shorter than 6 characters and got temporary ones:"
    );
    tempPasswords.forEach(({ name, email, password }) =>
      console.log(`  ${name || "(no name)"} <${email}>: ${password}`)
    );
  }
}

async function setPassword(loginId, password) {
  requirePassword(password);
  const user = await findUserByEmail(toLoginEmail(loginId));
  if (!user) fail(`No login found for ${loginId}.`);
  await auth.updateUser(user.uid, { password });
  await auth.revokeRefreshTokens(user.uid);
  console.log(`Password updated for ${loginId}; existing sessions were signed out.`);
}

async function deleteLogin(loginId) {
  const user = await findUserByEmail(toLoginEmail(loginId));
  if (!user) fail(`No login found for ${loginId}.`);
  const profile = await firestore.collection("household").doc(user.uid).get();
  if (profile.exists) {
    fail(`${loginId} still has a resident profile. Delete the resident in the admin app first.`);
  }
  await auth.deleteUser(user.uid);
  await rtdb.ref(`residents/${user.uid}`).remove();
  console.log(`Deleted login ${loginId}.`);
}

const commands = {
  "create-admin": createAdmin,
  "create-device": createDevice,
  "migrate-residents": migrateResidents,
  "set-password": setPassword,
  "delete-login": deleteLogin,
};

const [commandName, ...args] = process.argv.slice(2);
const command = commands[commandName];
if (!command) {
  fail(`Unknown command "${commandName || ""}". Commands: ${Object.keys(commands).join(", ")}`);
}

command(...args)
  .then(() => process.exit(0))
  .catch((error) => fail(error.message));
