import { formatBinName, formatKg, formatKgChange, formatShortDate } from "./format";

test("shows grams below 1 kg", () => {
  expect(formatKg(0)).toBe("0 g");
  expect(formatKg(0.12)).toBe("120 g");
  expect(formatKg(0.0052)).toBe("5 g");
  expect(formatKg(0.9996)).toBe("1 kg");
});

test("shows kg from 1 kg up", () => {
  expect(formatKg(1)).toBe("1 kg");
  expect(formatKg(1.256)).toBe("1.26 kg");
  expect(formatKg(12.5)).toBe("12.5 kg");
});

test("treats missing or negative values as zero", () => {
  expect(formatKg(undefined)).toBe("0 g");
  expect(formatKg(-2)).toBe("0 g");
});

test("signs balance changes", () => {
  expect(formatKgChange(0.5)).toBe("+500 g");
  expect(formatKgChange(-1)).toBe("−1 kg");
  expect(formatKgChange(0)).toBe("0 g");
});

test("shows bin IDs as names without changing them", () => {
  expect(formatBinName("bin_001")).toBe("Bin 001");
  expect(formatBinName("bin_001", { assignedUserId: "u1" })).toBe("Bin 001");
  expect(formatBinName("bin_001", { name: "Poblacion Hall" })).toBe("Poblacion Hall");
  expect(formatBinName("kiosk7")).toBe("Bin kiosk7");
});

test("drops the year from short dates in the current year", () => {
  const now = new Date("2026-11-02T12:00:00");
  expect(formatShortDate("2026-11-02T08:00:00", now)).toBe("Nov 2");
  expect(formatShortDate("2025-12-30T08:00:00", now)).toBe("Dec 30, 2025");
  expect(formatShortDate("", now)).toBe("—");
});
