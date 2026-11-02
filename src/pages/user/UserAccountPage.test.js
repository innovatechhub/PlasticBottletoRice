import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useAuth } from "../../app/AuthContext";
import { useData } from "../../app/DataContext";
import AppLayout from "../../components/Layout";
import UserAccountPage from "./UserAccountPage";

jest.mock("../../app/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../../app/DataContext", () => ({ useData: jest.fn() }));
// The admin shell's bell reads notifications; residents never see it.
jest.mock("../../components/NotificationBell", () => () => null);
// jsdom has no canvas; the QR's value is checked through this stand-in.
jest.mock("qrcode.react", () => ({
  QRCodeCanvas: ({ value, ...props }) => <canvas data-value={value} {...props} />,
}));

const logout = jest.fn();

function setup(user = {}, { syncErrors = [], currentUser } = {}) {
  useAuth.mockReturnValue({
    currentUser:
      currentUser === null
        ? null
        : {
            id: "u1",
            role: "user",
            name: "Juan Dela Cruz",
            username: "juan",
            barangay: "Poblacion",
            createdAt: "2026-03-14T08:00:00",
            ...user,
          },
    logout,
  });
  useData.mockReturnValue({ syncErrors });
  return render(
    <MemoryRouter initialEntries={["/user/account"]}>
      <AppLayout title="Account">
        <UserAccountPage />
      </AppLayout>
    </MemoryRouter>
  );
}

const valueOf = (term) => {
  const index = screen.getAllByRole("term").findIndex((dt) => dt.textContent === term);
  return screen.getAllByRole("definition")[index];
};

beforeEach(() => logout.mockResolvedValue());

test("shows a profile summary instead of a Name row", () => {
  setup();
  const profile = screen.getByRole("region", { name: "Profile" });
  expect(profile).toHaveTextContent("J");
  expect(profile).toHaveTextContent("Juan Dela Cruz");
  expect(profile).toHaveTextContent("Poblacion");
  expect(profile).toHaveTextContent("Member since March 2026");
  expect(screen.queryByRole("term", { name: "Name" })).not.toBeInTheDocument();
  expect(valueOf("Username")).toHaveTextContent("juan");
  expect(valueOf("Barangay")).toHaveTextContent("Poblacion");
  expect(screen.getByText("To change details, ask your barangay admin.")).toBeInTheDocument();
});

test("hides the barangay, member date and username when they are missing", () => {
  setup({ barangay: "", createdAt: undefined, username: "" });
  expect(screen.queryByText(/Member since/)).not.toBeInTheDocument();
  expect(screen.queryAllByRole("term")).toHaveLength(0);
  expect(screen.getByText("To change details, ask your barangay admin.")).toBeInTheDocument();
});

test("has no Change password row, because residents have no change or reset flow", () => {
  setup();
  expect(screen.queryByText(/password/i)).not.toBeInTheDocument();
});

test("shows the household QR full screen with the admin's QR value, and closes on Esc", () => {
  setup();
  const opener = screen.getByRole("button", { name: "My QR code" });
  opener.focus(); // a tap or Enter focuses the row in a browser
  fireEvent.click(opener);

  const dialog = screen.getByRole("dialog", { name: "Your QR code" });
  const qr = within(dialog).getByRole("img", { name: "QR code for Juan Dela Cruz" });
  expect(qr).toHaveAttribute("data-value", `${window.location.origin}/login?hid=u1`);
  expect(within(dialog).getByText("Juan Dela Cruz")).toBeInTheDocument();
  expect(within(dialog).getByRole("button", { name: "Save image" })).toBeInTheDocument();
  // Running on localhost without REACT_APP_PUBLIC_APP_URL, so developers are warned.
  expect(within(dialog).getByText(/REACT_APP_PUBLIC_APP_URL/)).toBeInTheDocument();
  expect(dialog).toHaveFocus();

  fireEvent.keyDown(dialog, { key: "Escape" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(opener).toHaveFocus();
});

test("shows the QR code and Help on the page on wide screens", () => {
  window.matchMedia = () => ({ matches: true, addEventListener: jest.fn(), removeEventListener: jest.fn() });
  setup();
  delete window.matchMedia;

  expect(screen.getByRole("img", { name: "QR code for Juan Dela Cruz" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Save image" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Help" })).toBeInTheDocument();
  expect(screen.getByText("How do I earn rice?")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "My QR code" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Help" })).not.toBeInTheDocument();
});

test("opens Help with the three questions and closes with Close", () => {
  setup();
  fireEvent.click(screen.getByRole("button", { name: "Help" }));
  const dialog = screen.getByRole("dialog", { name: "Help" });
  expect(within(dialog).getAllByRole("term").map((dt) => dt.textContent)).toEqual([
    "How do I earn rice?",
    "Why is rice out of stock?",
    "What if the bin isn't working?",
  ]);
  fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("asks before logging out; Cancel keeps the resident signed in", async () => {
  setup();
  fireEvent.click(screen.getByRole("button", { name: "Log out" }));
  const dialog = screen.getByRole("dialog", { name: "Log out?" });

  fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(logout).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "Log out" }));
  const confirm = within(screen.getByRole("dialog", { name: "Log out?" })).getByRole("button", {
    name: "Log out",
  });
  fireEvent.click(confirm);
  fireEvent.click(confirm);
  expect(await screen.findByRole("button", { name: "Logging out…" })).toBeDisabled();
  expect(logout).toHaveBeenCalledTimes(1);
});

test("shows an error when logging out fails", async () => {
  logout.mockRejectedValue(new Error("offline"));
  setup();
  fireEvent.click(screen.getByRole("button", { name: "Log out" }));
  const dialog = screen.getByRole("dialog", { name: "Log out?" });
  fireEvent.click(within(dialog).getByRole("button", { name: "Log out" }));
  expect(await within(dialog).findByRole("alert")).toHaveTextContent("Couldn't log out. Try again.");
});

test("shows loading and load-error states", () => {
  const { unmount } = setup({}, { currentUser: null });
  expect(screen.getByRole("status")).toHaveTextContent("Loading your account");
  unmount();

  setup({}, { syncErrors: ["users:self"] });
  expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load your latest details");
});

test("has Log out only on this page, and Account as a fourth navigation item", () => {
  setup();
  expect(screen.getByRole("banner")).not.toHaveTextContent("Log out");
  for (const nav of screen.getAllByRole("navigation", { name: "Resident navigation" })) {
    expect(within(nav).getAllByRole("link")).toHaveLength(4);
    expect(within(nav).getByRole("link", { name: "Account" })).toHaveAttribute("aria-current", "page");
  }
});
