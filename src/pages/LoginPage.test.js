import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { useAuth } from "../app/AuthContext";
import LoginPage from "./LoginPage";

// Sign-in is a fake; no account or Firebase project is used.
jest.mock("../app/AuthContext", () => ({ useAuth: jest.fn() }));

const login = jest.fn();

function setup({ authError = "", mobile = false } = {}) {
  window.matchMedia = jest.fn().mockImplementation((query) => ({
    matches: mobile && query.includes("max-width"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  useAuth.mockReturnValue({ login, authError });
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>
  );
}

const username = () => screen.getByLabelText("Username");
const password = () => screen.getByLabelText("Password");
const signIn = () => screen.getByRole("button", { name: /Sign in|Signing in/ });

function fillAndSubmit(user = "juan", pass = "test-only-pass") {
  fireEvent.change(username(), { target: { value: user } });
  fireEvent.change(password(), { target: { value: pass } });
  fireEvent.click(signIn());
}

beforeEach(() => {
  login.mockReset();
});

test("shows the heading, subheading and tab title", () => {
  setup();
  expect(screen.getByRole("heading", { level: 1, name: "Welcome back" })).toBeInTheDocument();
  expect(screen.getByText("Sign in to your EcoRice account")).toBeInTheDocument();
  expect(document.title).toBe("Sign in | EcoRice");
  expect(screen.getByText("No account? Ask your barangay admin.")).toBeInTheDocument();
});

test("keeps the field names and password-manager attributes", () => {
  setup();
  expect(username()).toHaveAttribute("name", "loginId");
  expect(username()).toHaveAttribute("autocomplete", "username");
  expect(username()).toHaveAttribute("autocapitalize", "none");
  expect(username()).toBeRequired();
  expect(password()).toHaveAttribute("name", "password");
  expect(password()).toHaveAttribute("autocomplete", "current-password");
  expect(password()).toBeRequired();
});

test("does not submit with empty fields", () => {
  setup();
  fireEvent.click(signIn());
  expect(login).not.toHaveBeenCalled();
  expect(screen.getByRole("alert")).toHaveTextContent("Enter your username and password.");
});

test("shows Signing in..., disables the button and submits only once", async () => {
  let finish;
  login.mockReturnValue(new Promise((resolve) => (finish = resolve)));
  setup();
  fillAndSubmit();
  fireEvent.submit(screen.getByRole("form", { name: "Sign in" }));

  expect(signIn()).toBeDisabled();
  expect(signIn()).toHaveTextContent("Signing in...");
  expect(login).toHaveBeenCalledTimes(1);
  expect(login).toHaveBeenCalledWith({ loginId: "juan", password: "test-only-pass" });

  await act(async () => finish({ ok: true }));
  // Stays busy until the login route redirects away.
  expect(signIn()).toBeDisabled();
});

test("on a failed sign-in, shows the error, keeps the username and clears the password", async () => {
  login.mockResolvedValue({ ok: false, error: "Incorrect username or password." });
  setup();
  fillAndSubmit();
  await act(() => Promise.resolve());

  expect(screen.getByRole("alert")).toHaveTextContent("Incorrect username or password.");
  expect(username()).toHaveValue("juan");
  expect(password()).toHaveValue("");
  expect(password()).toHaveFocus();
  expect(signIn()).toBeEnabled();
  expect(signIn()).toHaveTextContent("Sign in");
});

test.each([
  "Can't connect. Check your internet and try again.",
  "Something went wrong. Please try again.",
])("announces %s", async (message) => {
  login.mockResolvedValue({ ok: false, error: message });
  setup();
  fillAndSubmit();
  await act(() => Promise.resolve());
  expect(screen.getByRole("alert")).toHaveTextContent(message);
});

test("shows errors raised after sign-in (e.g. a removed profile)", () => {
  setup({ authError: "Your resident profile was removed. Contact the admin." });
  expect(screen.getByRole("alert")).toHaveTextContent("profile was removed");
});

test("shows and hides the password", () => {
  setup();
  const toggle = screen.getByRole("button", { name: "Show password" });
  expect(password()).toHaveAttribute("type", "password");

  fireEvent.click(toggle);
  expect(password()).toHaveAttribute("type", "text");
  expect(screen.getByRole("button", { name: "Hide password" })).toHaveAttribute("aria-pressed", "true");

  fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
  expect(password()).toHaveAttribute("type", "password");
});

test("Forgot password? is a keyboard button that reveals help", () => {
  setup();
  const forgot = screen.getByRole("button", { name: "Forgot password?" });
  expect(forgot).toHaveAttribute("aria-expanded", "false");

  forgot.focus();
  fireEvent.click(forgot);
  expect(forgot).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByText(/Ask your barangay admin to reset your password/)).toBeInTheDocument();
});

test("tab order follows the form", () => {
  setup();
  const order = [
    username(),
    password(),
    screen.getByRole("button", { name: "Show password" }),
    screen.getByRole("checkbox", { name: "Remember me" }),
    screen.getByRole("button", { name: "Forgot password?" }),
    signIn(),
  ];
  username().focus();
  order.slice(1).forEach((element) => {
    userEvent.tab();
    expect(element).toHaveFocus();
  });
});

test("on phones, hides the bottom navigation while a field is focused", () => {
  const { container } = setup({ mobile: true });
  const shell = container.querySelector(".sb-login-shell"); // eslint-disable-line testing-library/no-container, testing-library/no-node-access

  fireEvent.focus(username());
  expect(shell).toHaveClass("sb-login-shell--typing");

  fireEvent.blur(username(), { relatedTarget: password() });
  expect(shell).toHaveClass("sb-login-shell--typing");

  fireEvent.blur(password(), { relatedTarget: null });
  expect(shell).not.toHaveClass("sb-login-shell--typing");
});
