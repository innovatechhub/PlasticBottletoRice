import { act, fireEvent, render, screen } from "@testing-library/react";
import { __listeners as listeners } from "firebase/database";
import {
  cancelBinCommand,
  flushWrites,
  isBinInUse,
  writeBinCommand,
} from "../../services/cloudSync";
import InsertBottleSession from "./InsertBottleSession";

// Nothing here talks to Firebase or a real bin: the database listeners and
// bin commands are replaced with in-memory fakes.
jest.mock("firebase/database", () => {
  const registry = {};
  return {
    __listeners: registry,
    ref: (_db, path) => path,
    onValue: (path, callback, onError) => {
      registry[path] = { callback, onError };
      return () => {
        if (registry[path]?.callback === callback) delete registry[path];
      };
    },
  };
});
jest.mock("../../services/firebaseClient", () => ({ realtimeDb: {} }));
jest.mock("../../services/cloudSync", () => ({
  cancelBinCommand: jest.fn(),
  flushWrites: jest.fn(),
  isBinInUse: jest.fn(),
  writeBinCommand: jest.fn(),
}));

const BIN = "bin_001";
const user = { id: "u1", name: "Juan Dela Cruz", weightKg: 0.2 };

// Lets pending promises (command writes, saves) settle.
const flushPromises = () => act(() => Promise.resolve());

// The value shown next to a label in a <dl>.
const valueOf = (term) => {
  const index = screen.getAllByRole("term").findIndex((dt) => dt.textContent === term);
  return screen.getAllByRole("definition")[index];
};

const emit = (path, value) =>
  act(() => {
    listeners[path].callback({ exists: () => value != null, val: () => value });
  });

const binUpdate = (fields) =>
  emit(`bin_commands/${BIN}`, { status: "active", ...fields });

const acceptBottle = (n, weightKg) =>
  binUpdate({ lastAcceptedAt: `t${n}`, lastWeightKg: weightKg });

async function renderSession(overrides = {}) {
  const props = {
    binId: BIN,
    user,
    onFinalize: jest.fn(() => ({ ok: true, kgEarned: 0.05, bottleCount: 2 })),
    onClose: jest.fn(),
    ...overrides,
  };
  const utils = render(<InsertBottleSession {...props} />);
  // Let the start-up checks and the command write resolve.
  await flushPromises();
  return { ...utils, props };
}

beforeEach(() => {
  jest.useFakeTimers();
  Object.keys(listeners).forEach((key) => delete listeners[key]);
  isBinInUse.mockResolvedValue(false);
  writeBinCommand.mockResolvedValue({ ok: true });
  cancelBinCommand.mockResolvedValue({ ok: true });
  flushWrites.mockResolvedValue({ ok: true });
});

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});

test("shows Connecting to bin, with Cancel, while the bin wakes up", async () => {
  const { props } = await renderSession();

  expect(screen.getByRole("heading", { name: "Connecting…" })).toBeInTheDocument();
  expect(writeBinCommand).toHaveBeenCalledWith(BIN, "u1", "Juan Dela Cruz");

  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(cancelBinCommand).toHaveBeenCalledWith(BIN);
  expect(props.onClose).toHaveBeenCalled();
});

test("marks how far along the three steps the session is", async () => {
  await renderSession();
  const current = () =>
    screen.getByRole("list", { name: "Progress" }).querySelector("[aria-current='step']");

  expect(current()).toHaveTextContent("Connect");
  binUpdate({});
  expect(current()).toHaveTextContent("Insert");
  acceptBottle(1, 0.02);
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  await flushPromises();
  expect(current()).toHaveTextContent("Save");
});

test("shows Ready once the bin is active; Done and save stays disabled with no bottles", async () => {
  await renderSession();
  binUpdate({});

  expect(screen.getByRole("heading", { name: "Ready. Insert your bottles." })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Done" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
});

test("counts bottles and weight live, then saves once and shows the amount added", async () => {
  const { props } = await renderSession();
  binUpdate({});
  acceptBottle(1, 0.02);
  acceptBottle(2, 0.03);
  acceptBottle(2, 0.03); // the same update again must not count twice

  expect(screen.getByRole("heading", { name: "Ready. Insert your bottles." })).toBeInTheDocument();
  expect(valueOf("Bottles")).toHaveTextContent("2");
  expect(valueOf("Weight")).toHaveTextContent("50 g");
  expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();

  const done = screen.getByRole("button", { name: "Done" });
  fireEvent.click(done);
  fireEvent.click(done);
  await flushPromises();

  expect(props.onFinalize).toHaveBeenCalledTimes(1);
  expect(props.onFinalize).toHaveBeenCalledWith([0.02, 0.03]);
  expect(cancelBinCommand).toHaveBeenCalledWith(BIN);
  expect(screen.getByRole("heading", { name: "Saved" })).toBeInTheDocument();
  expect(screen.getByText("+50 g")).toBeInTheDocument();
});

test("shows Saving until the server confirms", async () => {
  let confirm;
  flushWrites.mockReturnValue(new Promise((resolve) => (confirm = resolve)));
  await renderSession();
  binUpdate({});
  acceptBottle(1, 0.02);

  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  await flushPromises();
  expect(screen.getByRole("heading", { name: "Saving…" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();

  await act(async () => confirm({ ok: true }));
  expect(screen.getByRole("heading", { name: "Saved" })).toBeInTheDocument();
});

test("never claims a save the server did not confirm", async () => {
  flushWrites.mockReturnValue(new Promise(() => {}));
  await renderSession();
  binUpdate({});
  acceptBottle(1, 0.02);

  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  await flushPromises();
  await act(async () => {
    jest.advanceTimersByTime(15000);
  });

  expect(screen.getByRole("heading", { name: "Not saved yet" })).toBeInTheDocument();
  expect(screen.queryByText(/^Saved$/)).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Check again" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Close" })).toBeEnabled();
});

test("shows Bin not responding after the timeout, with Try again and Cancel", async () => {
  const { props } = await renderSession();

  await act(async () => {
    jest.advanceTimersByTime(25000);
  });

  expect(screen.getByRole("heading", { name: "Bin not responding" })).toBeInTheDocument();
  expect(cancelBinCommand).toHaveBeenCalledWith(BIN);

  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await flushPromises();
  expect(screen.getByRole("heading", { name: "Connecting…" })).toBeInTheDocument();
  expect(writeBinCommand).toHaveBeenCalledTimes(2);

  await act(async () => {
    jest.advanceTimersByTime(25000);
  });
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(props.onClose).toHaveBeenCalled();
});

test("a late answer from the bin does not override the timeout", async () => {
  await renderSession();
  await act(async () => {
    jest.advanceTimersByTime(25000);
  });
  expect(listeners[`bin_commands/${BIN}`]).toBeUndefined();
  expect(screen.getByRole("heading", { name: "Bin not responding" })).toBeInTheDocument();
});

test("explains why the bin could not start", async () => {
  isBinInUse.mockResolvedValue(true);
  await renderSession();

  expect(screen.getByRole("heading", { name: "Couldn't start" })).toBeInTheDocument();
  expect(screen.getByText(/Another resident is using this bin/)).toBeInTheDocument();
  expect(writeBinCommand).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
});

test("warns when the connection drops during a session", async () => {
  await renderSession();
  binUpdate({});
  emit(".info/connected", true);
  emit(".info/connected", false);

  expect(screen.getByText(/Offline/)).toBeInTheDocument();
});

test("keeps counted bottles when contact with the bin is lost", async () => {
  const { props } = await renderSession();
  binUpdate({});
  acceptBottle(1, 0.02);

  act(() => listeners[`bin_commands/${BIN}`].onError(new Error("permission")));

  expect(screen.getByRole("heading", { name: "Connection lost" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Save 1 bottle" }));
  await flushPromises();
  expect(props.onFinalize).toHaveBeenCalledWith([0.02]);
});

test("saves automatically when the session times out with bottles", async () => {
  const { props } = await renderSession();
  binUpdate({});
  acceptBottle(1, 0.02);

  emit(`bin_commands/${BIN}`, { status: "expired" });
  await flushPromises();

  expect(props.onFinalize).toHaveBeenCalledWith([0.02]);
  expect(screen.getByRole("heading", { name: "Saved" })).toBeInTheDocument();
});

test("ends without saving when no bottle was inserted", async () => {
  const { props } = await renderSession();
  binUpdate({});
  emit(`bin_commands/${BIN}`, { status: "expired" });

  expect(screen.getByRole("heading", { name: "Session ended" })).toBeInTheDocument();
  expect(props.onFinalize).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Start again" })).toBeInTheDocument();
});

test("pauses the countdown and shows the bin's message when an object is rejected", async () => {
  await renderSession();
  binUpdate({});
  binUpdate({
    lastValidationStatus: "rejected",
    lastValidationAt: "v1",
    lastValidationMessage: "Bottle not accepted. Weight must be between 5.20 g and 100.00 g.",
  });

  expect(screen.getByRole("alert")).toHaveTextContent("Weight must be between");
});
