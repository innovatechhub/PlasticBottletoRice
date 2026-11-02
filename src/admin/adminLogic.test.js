import { buildAlerts } from "./alerts";
import { BIN_STATUS_THRESHOLDS, describeComponents, getBinStatus } from "./binStatus";
import { toCsv } from "./csv";
import { balanceDiffers, counterCheck, ledgerByResident, ledgerTotals } from "./ledger";

const NOW = new Date("2026-11-02T12:00:00Z").getTime();
const ago = (ms) => new Date(NOW - ms).toISOString();
const MIN = 60 * 1000;

const tx = (overrides) => ({
  id: Math.random().toString(16).slice(2),
  userId: "u1",
  userName: "Jake",
  type: "bottle",
  status: "completed",
  kgDelta: 0,
  riceDeltaKg: 0,
  bottleDelta: 0,
  timestamp: ago(MIN),
  details: "",
  ...overrides,
});

describe("bin status", () => {
  test("uses the thresholds for Online, Delayed and Offline", () => {
    expect(BIN_STATUS_THRESHOLDS).toEqual({ onlineWithinMs: 2 * MIN, delayedWithinMs: 10 * MIN });
    expect(getBinStatus({ updatedAt: ago(1 * MIN) }, NOW).state).toBe("online");
    expect(getBinStatus({ updatedAt: ago(5 * MIN) }, NOW).state).toBe("delayed");
    expect(getBinStatus({ updatedAt: ago(30 * MIN) }, NOW).state).toBe("offline");
    expect(getBinStatus(undefined, NOW).state).toBe("nodata");
    expect(getBinStatus({ updatedAt: "not a date" }, NOW).state).toBe("nodata");
  });

  test("marks stale readings as last known and never reports stale Wi-Fi as plainly connected", () => {
    const status = getBinStatus({ updatedAt: ago(30 * MIN) }, NOW);
    const items = describeComponents({ riceLevelPercent: 40, riceDistanceCm: 12, wifiConnected: true }, status);
    const rice = items.find((item) => item.key === "riceLevel");
    const wifi = items.find((item) => item.key === "wifi");
    expect(rice).toMatchObject({ state: "ok", summary: "40% full", lastKnown: true });
    expect(wifi).toMatchObject({ state: "warning", lastKnown: true });
  });

  test("names a sensor fault in plain language with a next step", () => {
    const status = getBinStatus({ updatedAt: ago(MIN) }, NOW);
    const rice = describeComponents({ riceDistanceCm: -1 }, status).find((item) => item.key === "riceLevel");
    expect(rice.summary).toBe("Rice level sensor not responding");
    expect(rice.nextStep).toMatch(/Check the sensor wiring/);
  });

  test("uses one word pair for the metal detector", () => {
    const status = getBinStatus({ updatedAt: ago(MIN) }, NOW);
    const summary = (value) =>
      describeComponents({ inductiveMetalDetected: value }, status).find((item) => item.key === "metal").summary;
    expect(summary(true)).toBe("Metal detected");
    expect(summary(false)).toBe("Clear");
  });
});

describe("ledger check", () => {
  const transactions = [
    tx({ kgDelta: 0.12, bottleDelta: 4 }),
    tx({ kgDelta: 0.063, bottleDelta: 2 }),
    tx({ type: "redeem", kgDelta: -0.05, riceDeltaKg: -0.05 }),
    tx({ type: "redeem", kgDelta: -0.5, riceDeltaKg: -0.5, status: "declined" }),
  ];

  test("adds up bottles, plastic and balance, ignoring declined redemptions", () => {
    expect(ledgerTotals(transactions)).toEqual({ bottles: 6, weightKg: 0.183 });
    const jake = ledgerByResident(transactions).get("u1");
    expect(jake).toMatchObject({ bottles: 6, earnedKg: 0.183, redeemedKg: 0.05, balanceKg: 0.133 });
  });

  test("flags a balance above what the log adds up to (the jake case)", () => {
    const jake = ledgerByResident(transactions).get("u1");
    expect(balanceDiffers({ weightKg: 0.203 }, jake)).toBe(true);
    expect(balanceDiffers({ weightKg: 0.133 }, jake)).toBe(false);
  });

  test("compares the system counter, the residents' counters and the log", () => {
    const check = counterCheck({
      system: { totalItemsRecycled: 158, totalWeightRecycledKg: 6.955 },
      residents: [{ recycledItemCount: 190, totalRecycledWeightKg: 8.646 }],
      transactions,
    });
    expect(check.bottles).toEqual({ system: 158, residents: 190, ledger: 6 });
    expect(check.matches).toBe(false);
  });
});

describe("needs attention", () => {
  const healthy = {
    system: {
      riceStock: 50,
      bottleStorage: 10,
      maxBottleCapacity: 500,
      totalItemsRecycled: 4,
      totalWeightRecycledKg: 0.12,
      bins: { bin_001: {} },
      hardwareBins: { bin_001: { binId: "bin_001", updatedAt: ago(MIN), riceDistanceCm: 18, riceLevelPercent: 46, bottleDistanceCm: 31, bottleLevelPercent: 38, inductiveMetalDetected: false, riceScaleWeightG: 0, bottleScaleWeightG: 0, pusherServoState: "Rest", riceServoState: "Closed", wifiConnected: true } },
    },
    users: [
      { id: "u1", role: "user", barangay: "Poblacion", weightKg: 0.12, recycledItemCount: 4, totalRecycledWeightKg: 0.12 },
    ],
    transactions: [tx({ kgDelta: 0.12, bottleDelta: 4 })],
    now: NOW,
  };

  test("is empty only when the data confirms there is nothing to fix", () => {
    expect(buildAlerts(healthy)).toEqual([]);
  });

  test("lists out of stock first, then an offline bin, with links", () => {
    const alerts = buildAlerts({
      ...healthy,
      system: {
        ...healthy.system,
        riceStock: 0,
        hardwareBins: { bin_001: { updatedAt: ago(60 * MIN) } },
      },
    });
    expect(alerts.map((a) => a.id)).toEqual(["rice-out", "bin-bin_001"]);
    expect(alerts[0]).toMatchObject({ severity: "critical", to: "/admin/storage" });
    expect(alerts[1]).toMatchObject({ severity: "critical", title: "bin_001 is offline", to: "/admin/hardware" });
  });

  test("reports bins without sensor data, nearly full storage and missing barangays", () => {
    const alerts = buildAlerts({
      ...healthy,
      system: { ...healthy.system, hardwareBins: {}, bottleStorage: 460 },
      users: [{ ...healthy.users[0], barangay: "" }],
    });
    const ids = alerts.map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining(["bin-bin_001", "storage-full", "barangay"]));
    expect(alerts.find((a) => a.id === "bin-bin_001").title).toBe("bin_001: no sensor data");
  });

  test("reports a faulty sensor and missing readings on an online bin", () => {
    const alerts = buildAlerts({
      ...healthy,
      system: { ...healthy.system, hardwareBins: { bin_001: { updatedAt: ago(MIN), riceDistanceCm: -1 } } },
    });
    expect(alerts.find((a) => a.id === "fault-bin_001-riceLevel").title).toBe("bin_001: rice level sensor not responding");
    expect(alerts.map((a) => a.id)).toContain("missing-bin_001");
  });

  test("reports counters that disagree with the log", () => {
    const alerts = buildAlerts({ ...healthy, system: { ...healthy.system, totalItemsRecycled: 158 } });
    expect(alerts.map((a) => a.id)).toContain("counters");
  });
});

describe("CSV export", () => {
  test("quotes cells and neutralises spreadsheet formulas", () => {
    const csv = toCsv(
      [
        { label: "Resident", value: (row) => row.name },
        { label: "Details", value: (row) => row.details },
      ],
      [{ name: "Cruz, Ana", details: '=HYPERLINK("x")' }]
    );
    expect(csv).toBe('Resident,Details\r\n"Cruz, Ana","\'=HYPERLINK(""x"")"');
  });
});
