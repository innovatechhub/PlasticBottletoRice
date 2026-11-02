import { fireEvent, render, screen, within } from "@testing-library/react";
import { useAuth } from "../../app/AuthContext";
import { useData } from "../../app/DataContext";
import UserHistoryPage from "./UserHistoryPage";

jest.mock("../../app/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../../app/DataContext", () => ({ useData: jest.fn() }));

const thisYear = new Date().getFullYear();

function setup(transactions = []) {
  useAuth.mockReturnValue({ currentUser: { id: "u1", name: "Juan" } });
  useData.mockReturnValue({ transactions });
  return render(<UserHistoryPage />);
}

// A row's text without its icon, which is drawn from an icon font's name.
const rowText = () =>
  within(screen.getByRole("list", { name: "Activity" }))
    .getAllByRole("listitem")
    .map((row) => row.textContent.replace(/^(water_bottle|rice_bowl|swap_vert)/, ""));

test("shows a short empty state without a table", () => {
  setup();
  expect(screen.getByRole("heading", { name: "History" })).toBeInTheDocument();
  expect(screen.getByText("No activity yet.")).toBeInTheDocument();
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
});

test("lists activity, amount and date for the resident only", () => {
  setup([
    { id: "1", userId: "u1", type: "bottle", kgDelta: 0.12, timestamp: `${thisYear}-11-02T08:00:00` },
    { id: "2", userId: "u1", type: "redeem", kgDelta: -0.5, riceDeltaKg: -0.5, timestamp: `${thisYear}-11-02T09:00:00` },
    { id: "3", userId: "u1", type: "redeem", kgDelta: -1, riceDeltaKg: -1, status: "declined", timestamp: `${thisYear}-10-30T09:00:00` },
    { id: "4", userId: "u2", type: "bottle", kgDelta: 0.3, timestamp: `${thisYear}-11-01T08:00:00` },
  ]);
  expect(rowText()).toEqual([
    "Bottle depositNov 2+120 g",
    "Rice redeemedNov 2−500 g",
    "Redemption declinedOct 30 · Refunded1 kg",
  ]);
});

test("names the bottles when the count is known", () => {
  setup([
    { id: "1", userId: "u1", type: "bottle", amount: 4, kgDelta: 0.12, timestamp: `${thisYear}-11-02T08:00:00` },
    { id: "2", userId: "u1", type: "bottle", bottleDelta: 1, kgDelta: 0.03, timestamp: `${thisYear}-11-01T08:00:00` },
  ]);
  expect(rowText()).toEqual(["4 bottlesNov 2+120 g", "1 bottleNov 1+30 g"]);
});

test("filters by bottles and rice", () => {
  setup([
    { id: "1", userId: "u1", type: "bottle", kgDelta: 0.12, timestamp: `${thisYear}-11-02T08:00:00` },
    { id: "2", userId: "u1", type: "redeem", kgDelta: -0.5, riceDeltaKg: -0.5, timestamp: `${thisYear}-11-02T09:00:00` },
  ]);
  fireEvent.click(screen.getByRole("button", { name: "Rice" }));
  expect(screen.getByRole("button", { name: "Rice" })).toHaveAttribute("aria-pressed", "true");
  expect(rowText()).toEqual(["Rice redeemedNov 2−500 g"]);

  fireEvent.click(screen.getByRole("button", { name: "Bottles" }));
  expect(rowText()).toEqual(["Bottle depositNov 2+120 g"]);
});
