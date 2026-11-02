import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useAuth } from "../../app/AuthContext";
import { useData } from "../../app/DataContext";
import UserHomePage from "./UserHomePage";

jest.mock("../../app/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../../app/DataContext", () => ({ useData: jest.fn() }));
// The session itself is covered in InsertBottleSession.test.js.
jest.mock("./InsertBottleSession", () => ({ binId }) => (
  <div role="dialog">Session for {binId}</div>
));

function setup({ balanceKg = 0, transactions = [], bins = { bin_001: {} } } = {}) {
  useAuth.mockReturnValue({
    currentUser: { id: "u1", name: "Juan Dela Cruz", weightKg: balanceKg },
  });
  useData.mockReturnValue({
    transactions,
    system: { bins },
    actions: { finalizeBottleSession: jest.fn() },
  });
  return render(
    <MemoryRouter>
      <UserHomePage />
    </MemoryRouter>
  );
}

const bottleTx = { id: "t1", userId: "u1", type: "bottle", amount: 3, kgDelta: 0.12, timestamp: "2026-11-02T08:00:00" };
const redeemTx = { id: "t0", userId: "u1", type: "redeem", kgDelta: -0.5, riceDeltaKg: -0.5, timestamp: "2026-11-01T08:00:00" };

test("greets the resident and shows one balance", () => {
  setup({ balanceKg: 0.12, transactions: [bottleTx] });
  expect(screen.getByRole("heading", { name: /^Hi,/ })).toBeInTheDocument();
  expect(screen.getByText("Your balance")).toBeInTheDocument();
  expect(screen.getByText("Your balance").nextElementSibling).toHaveTextContent("120 g");
  expect(screen.queryByText(/Worth/)).not.toBeInTheDocument();
});

test("adds up bottles, plastic and rice from the resident's own activity", () => {
  const declined = { ...redeemTx, id: "t2", status: "declined", riceDeltaKg: -1, kgDelta: -1 };
  const other = { ...bottleTx, id: "t3", userId: "u2", amount: 9, kgDelta: 1 };
  setup({ balanceKg: 0.12, transactions: [bottleTx, redeemTx, declined, other] });
  const value = (term) => screen.getByText(term).nextElementSibling;
  expect(value("Bottles")).toHaveTextContent("3");
  expect(value("Recycled")).toHaveTextContent("120 g");
  expect(value("Rice earned")).toHaveTextContent("500 g");
});

test("measures progress to the smallest redeem amount, 500 g, for a first rice", () => {
  setup({ balanceKg: 0.12, transactions: [bottleTx] });
  expect(screen.getByText("380 g to your first rice")).toBeInTheDocument();
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "24");
});

test("says next rice once the resident has redeemed before", () => {
  setup({ balanceKg: 0.38, transactions: [bottleTx, redeemTx] });
  expect(screen.getByText("120 g to your next rice")).toBeInTheDocument();
});

test("fills the bowl and links to Redeem once 500 g is reached", () => {
  setup({ balanceKg: 0.6, transactions: [bottleTx] });
  expect(screen.getByRole("link", { name: "Redeem rice" })).toHaveAttribute("href", "/user/redeem");
  const bowl = screen.getByRole("progressbar");
  expect(bowl).toHaveAttribute("aria-valuenow", "100");
  expect(bowl).toHaveAttribute("aria-valuetext", "Ready to redeem");
});

test("shows a new resident an empty bowl and the three steps", () => {
  setup();
  expect(screen.getByText("500 g to your first rice")).toBeInTheDocument();
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  const steps = screen.getByRole("list", { name: "How it works" });
  expect(within(steps).getAllByRole("listitem").map((step) => step.textContent)).toEqual([
    "Collect",
    "Insert",
    "Get rice",
  ]);
  expect(screen.queryByRole("heading", { name: "Recent" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /See all/ })).not.toBeInTheDocument();
});

test("lists the latest four activities with a link to History", () => {
  const older = [1, 2, 3].map((n) => ({ ...bottleTx, id: `old${n}`, timestamp: "2026-10-2" + n + "T08:00:00" }));
  setup({ balanceKg: 0.12, transactions: [bottleTx, redeemTx, ...older] });
  const list = screen.getByRole("list", { name: "Recent activity" });
  expect(within(list).getAllByRole("listitem")).toHaveLength(4);
  expect(within(list).getAllByRole("listitem")[0]).toHaveTextContent("3 bottles");
  expect(screen.getByRole("link", { name: "See all activity" })).toHaveAttribute("href", "/user/history");
});

test("starts no session on its own", () => {
  setup({ balanceKg: 0.6, transactions: [bottleTx] });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("opens a session from the Insert Bottle button on the page", () => {
  setup({ balanceKg: 0.6, transactions: [bottleTx] });
  fireEvent.click(screen.getByRole("button", { name: "Insert Bottle" }));
  expect(screen.getByRole("dialog")).toHaveTextContent("Session for bin_001");
  expect(screen.getByRole("button", { name: "Insert Bottle" })).toBeDisabled();
});

test("explains when no bin is set up", () => {
  setup({ bins: {} });
  fireEvent.click(screen.getByRole("button", { name: "Insert Bottle" }));
  expect(screen.getByRole("alert")).toHaveTextContent("No bins are set up yet");
});

test("asks which bin when there are several, and rejects unknown IDs", () => {
  setup({ bins: { bin_001: {}, bin_002: {} } });
  fireEvent.click(screen.getByRole("button", { name: "Insert Bottle" }));
  fireEvent.change(screen.getByLabelText(/Bin ID/), { target: { value: "bin_009" } });
  fireEvent.click(screen.getByRole("button", { name: "Connect to bin" }));
  expect(screen.getByRole("alert")).toHaveTextContent("There is no bin called bin_009");
});
