import { formatRelative, toDate } from "../utils/format";

// How old the latest bin_status update may be before a bin counts as Delayed or Offline.
export const BIN_STATUS_THRESHOLDS = {
  onlineWithinMs: 2 * 60 * 1000,
  delayedWithinMs: 10 * 60 * 1000,
};

export const BIN_STATES = {
  online: { label: "Online", tone: "good" },
  delayed: { label: "Delayed", tone: "warning" },
  offline: { label: "Offline", tone: "critical" },
  nodata: { label: "No data", tone: "neutral" },
};

// Status of one bin from its latest Realtime Database bin_status entry.
export function getBinStatus(reading, now = Date.now()) {
  const lastSeen = toDate(reading?.updatedAt);
  if (!lastSeen) {
    return { state: "nodata", lastSeen: null, isLive: false };
  }
  const ageMs = now - lastSeen.getTime();
  let state = "offline";
  if (ageMs <= BIN_STATUS_THRESHOLDS.onlineWithinMs) state = "online";
  else if (ageMs <= BIN_STATUS_THRESHOLDS.delayedWithinMs) state = "delayed";
  return { state, lastSeen, ageMs, isLive: state === "online" };
}

export function binStatusSummary(status, binId, now = Date.now()) {
  switch (status.state) {
    case "online":
      return { text: `${binId} is online.`, nextStep: "" };
    case "delayed":
      return {
        text: `${binId} has not sent an update for ${formatRelative(status.lastSeen, now).replace(" ago", "")}.`,
        nextStep: "Wait a few minutes. If it stays delayed, check the Wi-Fi signal at the bin.",
      };
    case "offline":
      return {
        text: `${binId} is offline. Last seen ${formatRelative(status.lastSeen, now)}.`,
        nextStep: "Check that the bin has power and that its Wi-Fi network is working.",
      };
    default:
      return {
        text: `No status received from ${binId}.`,
        nextStep:
          "The current bin firmware does not send status updates (bin_status) yet. Readings appear here once it does.",
      };
  }
}

// A reading counts only when the field is present and numeric.
export function readNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

// Fill level reading for the bin overview: value plus whether it is live.
export function levelReading(reading, field, status) {
  const value = readNumber(reading?.[field]);
  if (value === null || value < 0) return { available: false, label: "No data" };
  return {
    available: true,
    percent: Math.max(0, Math.min(100, value)),
    label: `${Math.round(value)}%`,
    live: status.isLive,
  };
}

const servoValue = (state, angle) => {
  const parsedAngle = readNumber(angle);
  if (!state && parsedAngle === null) return null;
  return `${state || "Unknown position"}${parsedAngle === null ? "" : ` (${Math.round(parsedAngle)}°)`}`;
};

// Plain-language state for every component the bin can report.
// state: ok | warning | fault | nodata
export function describeComponents(reading, status) {
  const lastKnown = !status.isLive;
  const items = [];

  const distanceSensor = (key, name, distanceField, levelField, place) => {
    const distance = readNumber(reading?.[distanceField]);
    const level = readNumber(reading?.[levelField]);
    if (distance === null && level === null) {
      items.push({ key, name, state: "nodata", summary: `No reading from the ${name.toLowerCase()}` });
      return;
    }
    if ((distance !== null && distance < 0) || (level !== null && level < 0)) {
      items.push({
        key,
        name,
        state: "fault",
        summary: `${name} not responding`,
        nextStep: `Check the sensor wiring and that nothing blocks the sensor above the ${place}, then restart the bin.`,
        lastKnown,
      });
      return;
    }
    items.push({
      key,
      name,
      state: "ok",
      summary: level !== null ? `${Math.round(level)}% full` : "Responding",
      value: distance !== null ? `${distance.toFixed(1)} cm to the surface` : undefined,
      lastKnown,
    });
  };

  distanceSensor("riceLevel", "Rice level sensor", "riceDistanceCm", "riceLevelPercent", "rice hopper");
  distanceSensor("bottleLevel", "Bottle level sensor", "bottleDistanceCm", "bottleLevelPercent", "bottle bin");

  const metal = reading?.inductiveMetalDetected;
  if (typeof metal !== "boolean") {
    items.push({ key: "metal", name: "Metal detector", state: "nodata", summary: "No reading from the metal detector" });
  } else {
    items.push({
      key: "metal",
      name: "Metal detector",
      state: metal ? "warning" : "ok",
      summary: metal ? "Metal detected" : "Clear",
      nextStep: metal ? "Remove the metal object from the bottle slot." : undefined,
      lastKnown,
    });
  }

  const scale = (key, name, field, purpose) => {
    const grams = readNumber(reading?.[field]);
    items.push(
      grams === null
        ? { key, name, state: "nodata", summary: `No reading from the ${name.toLowerCase()}` }
        : { key, name, state: "ok", summary: `${grams.toFixed(1)} g on the ${purpose}`, lastKnown }
    );
  };
  scale("bottleScale", "Bottle scale", "bottleScaleWeightG", "bottle tray");
  scale("riceScale", "Rice scale", "riceScaleWeightG", "rice tray");

  const servo = (key, name, stateField, angleField) => {
    const value = servoValue(reading?.[stateField], reading?.[angleField]);
    items.push(
      value === null
        ? { key, name, state: "nodata", summary: `No reading from the ${name.toLowerCase()}` }
        : { key, name, state: "ok", summary: value, lastKnown }
    );
  };
  servo("pusher", "Bottle pusher", "pusherServoState", "pusherServoAngle");
  servo("riceGate", "Rice gate", "riceServoState", "riceServoAngle");

  const wifi = reading?.wifiConnected;
  if (typeof wifi !== "boolean") {
    items.push({ key: "wifi", name: "Wi-Fi", state: "nodata", summary: "No Wi-Fi report" });
  } else if (!wifi) {
    items.push({
      key: "wifi",
      name: "Wi-Fi",
      state: "fault",
      summary: "Wi-Fi disconnected",
      nextStep: "Check the router and the Wi-Fi name and password on the bin.",
      lastKnown,
    });
  } else {
    // A stale "connected" is not proof the bin is connected now.
    items.push({ key: "wifi", name: "Wi-Fi", state: lastKnown ? "warning" : "ok", summary: "Connected", lastKnown });
  }

  return items;
}
