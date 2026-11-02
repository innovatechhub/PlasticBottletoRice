import { formatKg } from "../utils/format";
import { BIN_STATES, binStatusSummary, describeComponents, getBinStatus } from "./binStatus";
import { balanceDiffers, counterCheck, ledgerByResident } from "./ledger";

// Rice at or below this is "low" (the threshold the Storage page already used).
export const LOW_RICE_KG = 20;
// Share of bottle capacity that counts as nearly full / full.
export const STORAGE_WARNING_RATIO = 0.9;

// Problems the dashboard's "Needs attention" panel lists, most severe first.
// severity: critical | warning | info
export function buildAlerts({ system, users, transactions, now = Date.now() }) {
  const alerts = [];
  const residents = users.filter((u) => u.role === "user");

  const rice = Number(system.riceStock) || 0;
  if (rice <= 0) {
    alerts.push({
      id: "rice-out",
      severity: "critical",
      title: "Rice is out of stock",
      detail: "Residents cannot redeem until rice is restocked.",
      to: "/admin/storage",
      linkLabel: "Open Storage",
    });
  } else if (rice <= LOW_RICE_KG) {
    alerts.push({
      id: "rice-low",
      severity: "warning",
      title: "Rice stock is low",
      detail: `${formatKg(rice)} left.`,
      to: "/admin/storage",
      linkLabel: "Open Storage",
    });
  }

  const readings = system.hardwareBins || {};
  Object.keys(system.bins || {}).forEach((binId) => {
    const status = getBinStatus(readings[binId], now);
    if (status.state === "online") {
      const components = describeComponents(readings[binId], status);
      components
        .filter((item) => item.state === "fault")
        .forEach((item) => {
          alerts.push({
            id: `fault-${binId}-${item.key}`,
            severity: "warning",
            title: `${binId}: ${item.summary.charAt(0).toLowerCase()}${item.summary.slice(1)}`,
            detail: item.nextStep,
            to: "/admin/hardware",
            linkLabel: "Open Hardware",
          });
        });
      const missing = components.filter((item) => item.state === "nodata");
      if (missing.length > 0) {
        alerts.push({
          id: `missing-${binId}`,
          severity: "info",
          title: `${binId} sends no ${missing.map((item) => item.name.toLowerCase()).join(", ")} reading`,
          detail: "The bin is online but does not report these parts.",
          to: "/admin/hardware",
          linkLabel: "Open Hardware",
        });
      }
      return;
    }
    const summary = binStatusSummary(status, binId, now);
    alerts.push({
      id: `bin-${binId}`,
      severity: status.state === "offline" ? "critical" : "warning",
      title:
        status.state === "nodata"
          ? `${binId}: no sensor data`
          : `${binId} is ${BIN_STATES[status.state].label.toLowerCase()}`,
      detail: summary.text,
      to: "/admin/hardware",
      linkLabel: "Open Hardware",
    });
  });

  const capacity = Number(system.maxBottleCapacity) || 0;
  const stored = Number(system.bottleStorage) || 0;
  if (capacity > 0 && stored / capacity >= STORAGE_WARNING_RATIO) {
    alerts.push({
      id: "storage-full",
      severity: stored >= capacity ? "critical" : "warning",
      title: stored >= capacity ? "Bottle storage is full" : "Bottle storage is nearly full",
      detail: `About ${stored} of ${capacity} bottles (estimated from saved bottles).`,
      to: "/admin/storage",
      linkLabel: "Open Storage",
    });
  }

  const check = counterCheck({ system, residents, transactions });
  if (!check.matches) {
    alerts.push({
      id: "counters",
      severity: "warning",
      title: "Recycling totals don't match the transaction log",
      detail: "The stored counters differ from what the log adds up to. See Data check below.",
      to: "#data-check",
      linkLabel: "View data check",
    });
  }

  const ledger = ledgerByResident(transactions);
  const mismatched = residents.filter((u) => balanceDiffers(u, ledger.get(u.id)));
  if (mismatched.length > 0) {
    alerts.push({
      id: "balances",
      severity: "warning",
      title: `${mismatched.length} resident balance${mismatched.length === 1 ? "" : "s"} differ from the log`,
      detail: "Their balance is not what their bottles and redemptions add up to.",
      to: "/admin/users?check=balance",
      linkLabel: "Show residents",
    });
  }

  const missingBarangay = residents.filter((u) => !u.barangay);
  if (missingBarangay.length > 0) {
    alerts.push({
      id: "barangay",
      severity: "info",
      title: `${missingBarangay.length} resident${missingBarangay.length === 1 ? " has" : "s have"} no barangay`,
      detail: "Barangay reports leave them out until it is added.",
      to: "/admin/users?barangay=missing",
      linkLabel: "Show residents",
    });
  }

  const order = { critical: 0, warning: 1, info: 2 };
  return alerts.sort((a, b) => order[a.severity] - order[b.severity]);
}
