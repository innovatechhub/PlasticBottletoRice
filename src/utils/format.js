// Shows a weight in grams below 1 kg and in kg from 1 kg up, e.g. "120 g", "1.25 kg".
export function formatKg(kg) {
  const value = Math.max(0, Number(kg) || 0);
  const grams = Math.round(value * 1000);
  if (grams < 1000) {
    return `${grams} g`;
  }
  return `${Number(value.toFixed(2))} kg`;
}

// Dates use one format everywhere, always with the year: "Oct 23, 2026".
const DATE_OPTIONS = { month: "short", day: "numeric", year: "numeric" };

export function toDate(value) {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value) {
  const date = toDate(value);
  return date ? date.toLocaleDateString("en-US", DATE_OPTIONS) : "—";
}

// "November 2026"; empty when there is no valid date.
export function formatMonthYear(value) {
  const date = toDate(value);
  return date ? date.toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "";
}

// "Oct 23, 2026, 3:22 PM"
export function formatDateTime(value) {
  const date = toDate(value);
  return date
    ? date.toLocaleString("en-US", { ...DATE_OPTIONS, hour: "numeric", minute: "2-digit" })
    : "—";
}

// "just now", "5 min ago", "3 h ago", "2 days ago", then the date.
export function formatRelative(value, now = Date.now()) {
  const date = toDate(value);
  if (!date) return "—";
  const seconds = Math.round((now - date.getTime()) / 1000);
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return formatDate(date);
}

// Same as formatKg, with a + or − sign for balance changes.
export function formatKgChange(kg) {
  const value = Number(kg) || 0;
  if (value === 0) return formatKg(0);
  return `${value > 0 ? "+" : "−"}${formatKg(Math.abs(value))}`;
}

// Short date for resident lists: "Nov 2", with the year only when it isn't this year.
export function formatShortDate(value, now = new Date()) {
  const date = toDate(value);
  if (!date) return "—";
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString(
    "en-US",
    sameYear ? { month: "short", day: "numeric" } : DATE_OPTIONS
  );
}

// Display name for a bin: its place name when one is recorded, otherwise
// "bin_001" reads as "Bin 001". The stored ID is never changed.
export function formatBinName(binId, bin) {
  const place = bin?.name || bin?.location;
  if (typeof place === "string" && place.trim()) return place.trim();
  const id = String(binId || "");
  const match = id.match(/^bin[_\s-]*(.+)$/i);
  return match ? `Bin ${match[1]}` : id ? `Bin ${id}` : "Bin";
}
