import { act, fireEvent, render, screen } from "@testing-library/react";
import { __listeners as listeners } from "firebase/database";
import { useAuth } from "../../app/AuthContext";
import { useData } from "../../app/DataContext";
import { writeRiceCommand } from "../../services/cloudSync";
import UserRedeemPage from "./UserRedeemPage";

// The redemption and the rice command are fakes; no rice is dispensed.
jest.mock("firebase/database", () => {
  const registry = {};
  return {
    __listeners: registry,
    ref: (_db, path) => path,
    onValue: (path, callback, onError) => {
      registry[path] = { callback, onError };
      return () => delete registry[path];
    },
  };
});
jest.mock("../../services/firebaseClient", () => ({ realtimeDb: {} }));
jest.mock("../../services/cloudSync", () => ({ writeRiceCommand: jest.fn() }));
jest.mock("../../app/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../../app/DataContext", () => ({ useData: jest.fn() }));

const redeemRice = jest.fn();

function setup({ balanceKg = 1.2, riceStock = 20, bins = { bin_001: {} } } = {}) {
  useAuth.mockReturnValue({
    currentUser: { id: "u1", name: "Juan Dela Cruz", weightKg: balanceKg },
  });
  useData.mockReturnValue({ system: { riceStock, bins }, actions: { redeemRice } });
  return render(<UserRedeemPage />);
}

const option = (label) => screen.getByRole("radio", { name: new RegExp(`^${label}`) });

// Lets pending promises (the rice command write) settle.
const flushPromises = () => act(() => Promise.resolve());

// The value shown next to a label in a <dl>.
const valueOf = (term) => {
  const index = screen.getAllByRole("term").findIndex((dt) => dt.textContent === term);
  return screen.getAllByRole("definition")[index];
};

beforeEach(() => {
  jest.useFakeTimers();
  Object.keys(listeners).forEach((key) => delete listeners[key]);
  redeemRice.mockReturnValue({ ok: true, riceKg: 0.5 });
  writeRiceCommand.mockResolvedValue({ ok: true });
});

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});

test("is titled Redeem Rice and offers 500 g and 1 kg", () => {
  setup();
  expect(screen.getByRole("heading", { name: "Redeem Rice" })).toBeInTheDocument();
  expect(option("500 g")).toBeEnabled();
  expect(option("1 kg")).toBeEnabled();
  expect(screen.getByRole("button", { name: "Redeem" })).toBeDisabled();
  expect(screen.queryByText(/You will receive/)).not.toBeInTheDocument();
  // Nothing is unavailable, so there is no warning.
  expect(screen.queryByText(/Need|out of stock/)).not.toBeInTheDocument();
  expect(screen.getByText("700 g left")).toBeInTheDocument();
});

test("disables amounts the balance can't cover and says how much more is needed", () => {
  setup({ balanceKg: 0.12 });
  expect(option("500 g")).toBeDisabled();
  expect(option("1 kg")).toBeDisabled();
  expect(option("500 g")).toHaveAccessibleDescription("Need 380 g more");
  expect(screen.getAllByText(/Need .* more/)).toHaveLength(1);
  const redeem = screen.getByRole("button", { name: "Redeem" });
  expect(redeem).toBeDisabled();
  // The message sits directly above the Redeem button.
  const message = screen.getByText("Need 380 g more");
  expect(message.compareDocumentPosition(redeem) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

test("shows no warning when 500 g can be redeemed, and says on the card why 1 kg can't", () => {
  setup({ balanceKg: 0.6 });
  expect(option("500 g")).toBeEnabled();
  expect(option("1 kg")).toBeDisabled();
  expect(option("1 kg")).toHaveAccessibleDescription("Need 400 g more");
  // On the card only; no line above the Redeem button.
  expect(screen.getByText(/^Need/)).toHaveClass("eco-amount__hint");
});

test("puts out of stock before a short balance", () => {
  setup({ riceStock: 0, balanceKg: 0.12 });
  expect(option("500 g")).toBeDisabled();
  expect(option("1 kg")).toBeDisabled();
  expect(option("500 g")).toHaveAccessibleDescription("Rice is out of stock");
  expect(screen.getAllByText(/out of stock/i)).toHaveLength(1);
  expect(screen.queryByText(/Need/)).not.toBeInTheDocument();
});

test("shows the rate in one line", () => {
  setup();
  expect(screen.getByText("1 kg plastic = 1 kg rice")).toBeInTheDocument();
});

test("shows the bin, amount and remaining balance before dispensing", () => {
  setup({ balanceKg: 1.2 });
  fireEvent.click(option("500 g"));
  fireEvent.click(screen.getByRole("button", { name: "Redeem" }));

  expect(screen.getByRole("dialog", { name: "Get 500 g of rice?" })).toBeInTheDocument();
  expect(valueOf("Bin")).toHaveTextContent("Bin 001");
  expect(valueOf("Rice")).toHaveTextContent("500 g");
  expect(valueOf("Balance after")).toHaveTextContent("700 g");
  expect(redeemRice).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "Back" }));
  expect(screen.getByRole("button", { name: "Redeem" })).toBeInTheDocument();
});

test("dispenses once, even on a double tap, and shows success when the bin finishes", async () => {
  setup();
  fireEvent.click(option("500 g"));
  fireEvent.click(screen.getByRole("button", { name: "Redeem" }));
  const dispense = screen.getByRole("button", { name: "Dispense 500 g" });
  fireEvent.click(dispense);
  fireEvent.click(dispense);
  await flushPromises();

  expect(redeemRice).toHaveBeenCalledTimes(1);
  expect(writeRiceCommand).toHaveBeenCalledTimes(1);
  expect(writeRiceCommand).toHaveBeenCalledWith("bin_001", "u1", "Juan Dela Cruz", 0.5);
  expect(screen.getByRole("heading", { name: "Dispensing 500 g" })).toBeInTheDocument();

  act(() =>
    listeners["rice_commands/bin_001"].callback({
      exists: () => true,
      val: () => ({ status: "done" }),
    })
  );
  expect(screen.getByRole("heading", { name: "Rice dispensed" })).toBeInTheDocument();
});

test("reports a failure when the bin never confirms", async () => {
  setup();
  fireEvent.click(option("500 g"));
  fireEvent.click(screen.getByRole("button", { name: "Redeem" }));
  fireEvent.click(screen.getByRole("button", { name: "Dispense 500 g" }));
  await flushPromises();
  act(() => jest.advanceTimersByTime(60000));

  expect(screen.getByRole("heading", { name: "Rice not confirmed" })).toBeInTheDocument();
  expect(screen.getByText(/ask your barangay admin/)).toBeInTheDocument();
});

test("reports a failure when the command can't reach the bin", async () => {
  writeRiceCommand.mockResolvedValue({ ok: false, error: "The bin could not be reached." });
  setup();
  fireEvent.click(option("1 kg"));
  fireEvent.click(screen.getByRole("button", { name: "Redeem" }));
  fireEvent.click(screen.getByRole("button", { name: "Dispense 1 kg" }));
  await flushPromises();

  expect(screen.getByRole("heading", { name: "Rice not confirmed" })).toBeInTheDocument();
});

test("shows the pickup bin as Bin 001 without changing the ID sent to the bin", () => {
  setup();
  expect(valueOf("Pickup bin")).toHaveTextContent("Bin 001");
  expect(screen.queryByText(/bin_001/)).not.toBeInTheDocument();
});

test("shows the bin's place name when one is stored", () => {
  setup({ bins: { bin_001: { name: "Poblacion Hall" } } });
  expect(valueOf("Pickup bin")).toHaveTextContent("Poblacion Hall");
});
