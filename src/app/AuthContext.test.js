import { act, render } from "@testing-library/react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { AuthProvider, useAuth } from "./AuthContext";

// Firebase Auth is replaced with a fake that fails with chosen error codes.
jest.mock("firebase/auth", () => ({
  onAuthStateChanged: jest.fn((_auth, callback) => {
    callback(null);
    return () => {};
  }),
  signInWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
}));
jest.mock("../services/firebaseClient", () => ({
  firebaseAuth: {},
  toLoginEmail: (id) => `${id}@example.test`,
}));
jest.mock("../services/cloudSync", () => ({
  getSyncMode: () => "local",
  startCloudSync: jest.fn(),
  stopCloudSync: jest.fn(),
}));
jest.mock("../services/localStore", () => ({
  dataStore: { subscribe: () => () => {} },
}));

let auth;
function Probe() {
  auth = useAuth();
  return null;
}

async function loginFailingWith(code) {
  signInWithEmailAndPassword.mockRejectedValueOnce(Object.assign(new Error(code), { code }));
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>
  );
  let result;
  await act(async () => {
    result = await auth.login({ loginId: "juan", password: "test-only-pass" });
  });
  return result.error;
}

test.each([
  "auth/invalid-credential",
  "auth/wrong-password",
  "auth/user-not-found",
  "auth/invalid-email",
  "auth/user-disabled",
])("%s gives the same message, so usernames are not revealed", async (code) => {
  expect(await loginFailingWith(code)).toBe("Incorrect username or password.");
});

test("network failures ask the user to check their connection", async () => {
  expect(await loginFailingWith("auth/network-request-failed")).toBe(
    "Can't connect. Check your internet and try again."
  );
});

test("other failures are reported as a server problem", async () => {
  expect(await loginFailingWith("auth/internal-error")).toBe(
    "Something went wrong. Please try again."
  );
});
