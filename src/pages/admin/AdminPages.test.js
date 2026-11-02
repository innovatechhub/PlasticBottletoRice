import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { useAuth } from "../../app/AuthContext";
import { useData } from "../../app/DataContext";
import NotificationBell from "../../components/NotificationBell";
import AdminDashboardPage from "./AdminDashboardPage";
import AdminHardwarePage from "./AdminHardwarePage";
import AdminLogsPage from "./AdminLogsPage";
import AdminStoragePage from "./AdminStoragePage";
import AdminUsersPage from "./AdminUsersPage";
import AdminUserViewPage from "./AdminUserViewPage";

// Every action is a jest mock: nothing here writes data or talks to a bin.
jest.mock("../../app/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../../app/DataContext", () => ({ useData: jest.fn() }));
jest.mock("qrcode.react", () => ({ QRCodeCanvas: () => <canvas aria-label="QR code" /> }));

const now = Date.now();
const ago = (minutes) => new Date(now - minutes * 60 * 1000).toISOString();

const actions = {
  deleteUser: jest.fn(),
  updateUser: jest.fn(),
  addUser: jest.fn(),
  addBin: jest.fn(),
  declineRedemption: jest.fn(),
  markNotificationRead: jest.fn(),
  markAllNotificationsRead: jest.fn(),
  resetResidentPassword: jest.fn(),
};

// CRA resets mock implementations before each test, so set them here.
beforeEach(() => {
  actions.deleteUser.mockResolvedValue({ ok: true });
  actions.updateUser.mockResolvedValue({ ok: true, user: { name: "x" } });
  actions.addBin.mockReturnValue({ ok: true });
  actions.declineRedemption.mockReturnValue({ ok: true });
});

function makeData(overrides = {}) {
  return {
    users: [
      { id: "u1", role: "user", name: "Jake Reyes", username: "jake", email: "jake@plastictorice.firebaseapp.com", barangay: "Poblacion", weightKg: 0.203, recycledItemCount: 6, totalRecycledWeightKg: 0.183, createdAt: "2026-10-23T07:00:00.000Z" },
      { id: "u2", role: "user", name: "Ana Cruz", username: "ana", email: "ana@plastictorice.firebaseapp.com", barangay: "", weightKg: 0, recycledItemCount: 0, totalRecycledWeightKg: 0, createdAt: "2026-10-24T07:00:00.000Z" },
    ],
    transactions: [
      { id: "t3", userId: "u1", userName: "Jake Reyes", type: "redeem", status: "completed", kgDelta: -0.05, riceDeltaKg: -0.05, bottleDelta: 0, timestamp: ago(10), details: "0.05 kg plastic redeemed for 0.05 kg rice." },
      { id: "t2", userId: "u1", userName: "Jake Reyes", type: "bottle", status: "completed", kgDelta: 0.063, riceDeltaKg: 0, bottleDelta: 2, timestamp: ago(60 * 24 * 3), details: "2 bottle(s) via bin_001. +0.063 kg credited on session save." },
      { id: "t1", userId: "u1", userName: "Jake Reyes", type: "bottle", status: "completed", kgDelta: 0.12, riceDeltaKg: 0, bottleDelta: 4, timestamp: ago(60 * 24 * 40), details: "4 bottle(s) via bin_001. +0.12 kg credited on session save." },
    ],
    notifications: [],
    system: {
      riceStock: 12,
      bottleStorage: 164,
      maxBottleCapacity: 500,
      totalItemsRecycled: 158,
      totalWeightRecycledKg: 6.955,
      bins: { bin_001: { assignedUserName: "Unassigned" } },
      hardwareBins: {},
    },
    syncErrors: [],
    actions,
    ...overrides,
  };
}

function renderAt(element, { path = "/", route = "/", data = makeData() } = {}) {
  useData.mockReturnValue(data);
  useAuth.mockReturnValue({ currentUser: { id: "admin1", role: "admin", name: "Admin" } });
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path={path} element={element} />
        <Route path="*" element={<p>Navigated away</p>} />
      </Routes>
    </MemoryRouter>
  );
}



describe("dashboard", () => {
  test("lists real problems with links, and no fixed 'All operational' text", () => {
    renderAt(<AdminDashboardPage />);
    const panel = screen.getByRole("region", { name: "Needs attention" });
    expect(within(panel).getByText("bin_001: no sensor data")).toBeInTheDocument();
    expect(within(panel).getByText("Rice stock is low")).toBeInTheDocument();
    expect(within(panel).getByText("Recycling totals don't match the transaction log")).toBeInTheDocument();
    expect(within(panel).getByText("1 resident has no barangay")).toBeInTheDocument();
    expect(within(panel).getAllByRole("link", { name: "Open Hardware" })[0]).toHaveAttribute("href", "/admin/hardware");
    expect(screen.queryByText(/All operational/)).not.toBeInTheDocument();
    expect(screen.queryByText("No issues found")).not.toBeInTheDocument();
  });

  test("shows rice at 0 kg as Out of stock with an urgent alert", () => {
    const data = makeData();
    data.system.riceStock = 0;
    renderAt(<AdminDashboardPage />, { data });
    expect(screen.getAllByText("Out of stock").length).toBeGreaterThan(0);
    expect(screen.getByText("Rice is out of stock")).toBeInTheDocument();
  });

  test("shows the data check with all three sources", () => {
    renderAt(<AdminDashboardPage />);
    const check = screen.getByRole("region", { name: "Data check" });
    const bottles = within(check).getByRole("row", { name: /Bottles/ });
    expect(bottles).toHaveTextContent("158");
    expect(bottles).toHaveTextContent("6");
  });

  test("says when data failed to load", () => {
    renderAt(<AdminDashboardPage />, { data: makeData({ syncErrors: ["transactions:all"] }) });
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load transactions.");
  });

  test("shows No issues found only when everything checks out", () => {
    const data = makeData({
      users: [
        { id: "u1", role: "user", name: "Jake", barangay: "Poblacion", weightKg: 0.183, recycledItemCount: 6, totalRecycledWeightKg: 0.183 },
      ],
    });
    data.transactions = data.transactions.filter((t) => t.type === "bottle");
    data.system = {
      ...data.system,
      riceStock: 50,
      bottleStorage: 6,
      totalItemsRecycled: 6,
      totalWeightRecycledKg: 0.183,
      hardwareBins: { bin_001: { updatedAt: ago(1), riceDistanceCm: 18, riceLevelPercent: 46, bottleDistanceCm: 31, bottleLevelPercent: 38, inductiveMetalDetected: false, riceScaleWeightG: 0, bottleScaleWeightG: 0, pusherServoState: "Rest", riceServoState: "Closed", wifiConnected: true } },
    };
    renderAt(<AdminDashboardPage />, { data });
    expect(screen.getByText("No issues found")).toBeInTheDocument();
  });
});

describe("residents", () => {
  test("asks before deleting, names the resident, and keeps the delete logic", async () => {
    renderAt(<AdminUsersPage />);
    fireEvent.click(screen.getByRole("button", { name: "More actions for Jake Reyes" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));

    const dialog = screen.getByRole("alertdialog", { name: "Delete Jake Reyes?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(actions.deleteUser).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "More actions for Jake Reyes" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete Jake Reyes" }));
    expect(actions.deleteUser).toHaveBeenCalledWith("u1");
    expect(await screen.findByRole("status")).toHaveTextContent("Deleted Jake Reyes.");
  });

  test("filters residents with a missing barangay from the dashboard link", () => {
    renderAt(<AdminUsersPage />, { path: "/admin/users", route: "/admin/users?barangay=missing" });
    expect(screen.getByText("Showing 1 of 2")).toBeInTheDocument();
    expect(screen.getByText("Ana Cruz")).toBeInTheDocument();
    expect(screen.queryByText("Jake Reyes")).not.toBeInTheDocument();
  });

  test("flags balances that differ from the log", () => {
    renderAt(<AdminUsersPage />, { path: "/admin/users", route: "/admin/users?check=balance" });
    expect(screen.getByText("Jake Reyes")).toBeInTheDocument();
    expect(screen.getByText("Balance differs from log")).toBeInTheDocument();
  });

  test("shows an empty state with a way to clear filters", () => {
    renderAt(<AdminUsersPage />);
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "nobody" } });
    expect(screen.getByText("No residents match these filters.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByText("Showing 2 of 2")).toBeInTheDocument();
  });

  test("the More menu works from the keyboard", () => {
    renderAt(<AdminUsersPage />);
    fireEvent.click(screen.getByRole("button", { name: "More actions for Ana Cruz" }));
    const edit = screen.getByRole("menuitem", { name: "Edit" });
    expect(edit).toHaveFocus();
    fireEvent.keyDown(edit, { key: "ArrowDown" });
    expect(screen.getByRole("menuitem", { name: "Delete" })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});

describe("resident profile", () => {
  test("shows the summary, a readable join date and tucks the ID into technical details", () => {
    renderAt(<AdminUserViewPage />, { path: "/admin/users/:userId", route: "/admin/users/u1" });
    expect(screen.getByRole("heading", { name: "Jake Reyes" })).toBeInTheDocument();
    expect(screen.getAllByText(/Oct 23, 2026/).length).toBeGreaterThan(0);
    expect(screen.getByText("Rice redeemed")).toBeInTheDocument();
    expect(screen.getByText("Technical details")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download PNG" })).toBeInTheDocument();
    expect(screen.getByText(/\/login\?hid=u1$/)).toBeInTheDocument();
  });

  test("says when a resident doesn't exist", () => {
    renderAt(<AdminUserViewPage />, { path: "/admin/users/:userId", route: "/admin/users/missing" });
    expect(screen.getByText("Resident not found")).toBeInTheDocument();
  });
});

describe("logs", () => {
  test("filters by type chips, search and date range, with shorter details", () => {
    renderAt(<AdminLogsPage />);
    expect(screen.getByText("2 bottles at bin_001")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Redemptions/ }));
    expect(screen.getByRole("button", { name: /Redemptions/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText("2 bottles at bin_001")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^All/ }));
    const from = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    fireEvent.change(screen.getByLabelText("From"), { target: { value: from } });
    expect(screen.queryByText("4 bottles at bin_001")).not.toBeInTheDocument();
    expect(screen.getByText("2 bottles at bin_001")).toBeInTheDocument();
  });

  test("Decline is unchanged: it asks first and does nothing if cancelled", () => {
    const confirm = jest.spyOn(window, "confirm").mockReturnValue(false);
    renderAt(<AdminLogsPage />);
    fireEvent.click(screen.getByRole("button", { name: /Decline redemption by Jake Reyes/ }));
    expect(confirm).toHaveBeenCalledWith("Decline this redemption and refund the household?");
    expect(actions.declineRedemption).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  test("shows an empty state", () => {
    renderAt(<AdminLogsPage />, { data: makeData({ transactions: [] }) });
    expect(screen.getByText("No activity yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Export CSV/ })).toBeDisabled();
  });
});

describe("hardware and storage", () => {
  test("a bin with no status update says so, with a next step", () => {
    renderAt(<AdminHardwarePage />);
    expect(screen.getAllByText("No data").length).toBeGreaterThan(0);
    expect(screen.getByText("No status received from bin_001.")).toBeInTheDocument();
    expect(screen.getByText(/does not send status updates/)).toBeInTheDocument();
  });

  test("an old update shows Offline and last known readings, not live ones", () => {
    const data = makeData();
    data.system.hardwareBins = {
      bin_001: { binId: "bin_001", updatedAt: ago(45), riceLevelPercent: 40, riceDistanceCm: 12, wifiConnected: true },
    };
    renderAt(<AdminHardwarePage />, { data });
    expect(screen.getAllByText("Offline").length).toBeGreaterThan(0);
    expect(screen.getByText(/bin_001 is offline. Last seen 45 min ago./)).toBeInTheDocument();
    expect(screen.getAllByText("Last known").length).toBeGreaterThan(0);
  });

  test("storage separates the estimated count from sensor readings and flags out of stock", () => {
    const data = makeData();
    data.system.riceStock = 0;
    data.system.hardwareBins = { bin_001: { updatedAt: ago(1), bottleLevelPercent: 30 } };
    renderAt(<AdminStoragePage />, { data });
    expect(screen.getAllByText("Out of stock").length).toBeGreaterThan(0);
    expect(screen.getByText(/Estimated: counted from saved bottles/)).toBeInTheDocument();
    expect(screen.getByText("Live")).toBeInTheDocument();
  });
});

describe("notification bell", () => {
  const notifications = [
    { id: "n1", title: "Bottle Storage Full", message: "Bottle storage reached max capacity.", targetRole: "admin", userId: null, createdAt: ago(5), readBy: [] },
    { id: "n2", title: "Something else", message: "No link here.", targetRole: "admin", userId: null, createdAt: ago(50), readBy: ["admin1"] },
  ];

  test("has an accessible name with the unread count and opens a panel", () => {
    renderAt(<NotificationBell />, { data: makeData({ notifications }) });
    const bell = screen.getByRole("button", { name: "Notifications, 1 unread" });
    fireEvent.click(bell);
    expect(bell).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("dialog", { name: "Notifications" })).toBeInTheDocument();
    expect(screen.getByText("(unread)")).toBeInTheDocument();
  });

  test("opening an item marks it read and follows its link", () => {
    renderAt(<NotificationBell />, { data: makeData({ notifications }) });
    fireEvent.click(screen.getByRole("button", { name: /Notifications/ }));
    fireEvent.click(screen.getByRole("button", { name: /Bottle Storage Full/ }));
    expect(actions.markNotificationRead).toHaveBeenCalledWith("n1", "admin1");
    expect(screen.getByText("Navigated away")).toBeInTheDocument();
  });

  test("Esc closes the panel", () => {
    renderAt(<NotificationBell />, { data: makeData({ notifications }) });
    fireEvent.click(screen.getByRole("button", { name: /Notifications/ }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
