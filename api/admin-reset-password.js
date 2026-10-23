// Vercel serverless function: lets a signed-in admin set a resident's password.
//
// Request:  POST /api/admin-reset-password
//           Authorization: Bearer <Firebase ID token of an admin>
//           { "userId": "<resident uid>", "newPassword": "..." }
//
// Vercel environment variables:
//   FIREBASE_SERVICE_ACCOUNT  Service account JSON (the whole file contents)
//   ALLOWED_ORIGINS           Comma-separated web app origins allowed to call this,
//                             e.g. https://plastictorice.vercel.app (same-origin calls need none)
const { initializeApp, getApps, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");

const MIN_PASSWORD_LENGTH = 6;
const MAX_PASSWORD_LENGTH = 128;

function getAdminApp() {
  if (getApps().length > 0) return getApps()[0];
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccount) {
    return initializeApp({ credential: cert(JSON.parse(serviceAccount)) });
  }
  // Local emulator testing only (FIREBASE_AUTH_EMULATOR_HOST / FIRESTORE_EMULATOR_HOST).
  return initializeApp({ projectId: process.env.GCLOUD_PROJECT });
}

function applyCors(req, res) {
  const origin = req.headers.origin;
  const allowed = String(process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (origin && allowed.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  }
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  try {
    return JSON.parse(req.body || "{}");
  } catch {
    return {};
  }
}

module.exports = async function handler(req, res) {
  applyCors(req, res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== "POST") {
    send(res, 405, { error: "Method not allowed." });
    return;
  }

  const match = /^Bearer (.+)$/.exec(req.headers.authorization || "");
  if (!match) {
    send(res, 401, { error: "Sign in as an admin first." });
    return;
  }

  const app = getAdminApp();
  const auth = getAuth(app);

  let caller;
  try {
    caller = await auth.verifyIdToken(match[1], true);
  } catch {
    send(res, 401, { error: "Your session has expired. Sign in again." });
    return;
  }
  if (caller.role !== "admin") {
    send(res, 403, { error: "Only admins can reset passwords." });
    return;
  }

  const { userId, newPassword } = readBody(req);
  if (typeof userId !== "string" || !userId) {
    send(res, 400, { error: "userId is required." });
    return;
  }
  if (
    typeof newPassword !== "string" ||
    newPassword.length < MIN_PASSWORD_LENGTH ||
    newPassword.length > MAX_PASSWORD_LENGTH
  ) {
    send(res, 400, {
      error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    });
    return;
  }

  // Only resident logins can be reset here; admin and bin logins use scripts/admin-tools.js.
  const profile = await getFirestore(app).collection("household").doc(userId).get();
  if (!profile.exists) {
    send(res, 404, { error: "Resident not found." });
    return;
  }

  let target;
  try {
    target = await auth.getUser(userId);
  } catch {
    send(res, 404, { error: "This resident has no login." });
    return;
  }
  if (target.customClaims?.role) {
    send(res, 403, { error: "Admin and bin logins can't be reset here." });
    return;
  }

  await auth.updateUser(userId, { password: newPassword });
  // Sign the resident out everywhere so the old password stops working immediately.
  await auth.revokeRefreshTokens(userId);
  send(res, 200, { ok: true });
};
