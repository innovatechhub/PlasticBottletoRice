import { formatDateTime, formatKg, formatKgChange, formatShortDate } from "../utils/format";

const ICONS = {
  bottle: "water_bottle",
  rice: "rice_bowl",
  other: "swap_vert",
};

// What one transaction reads as in the resident's list.
function describe(item) {
  if (item.type === "bottle") {
    const count = Number(item.amount || item.bottleDelta || 0);
    return {
      kind: "bottle",
      label: count > 0 ? `${count} bottle${count === 1 ? "" : "s"}` : "Bottle deposit",
      amount: formatKgChange(item.kgDelta),
      gained: Number(item.kgDelta) > 0,
    };
  }
  if (item.type === "redeem") {
    const kg = Math.abs(Number(item.riceDeltaKg) || Number(item.kgDelta) || 0);
    return item.status === "declined"
      ? { kind: "rice", label: "Redemption declined", amount: formatKg(kg), note: "Refunded" }
      : { kind: "rice", label: "Rice redeemed", amount: formatKgChange(-kg) };
  }
  return { kind: "other", label: "Balance change", amount: formatKgChange(item.kgDelta) };
}

// The resident's activity rows, shared by History and the Home summary.
export default function ActivityList({ items, label = "Activity" }) {
  return (
    <ul className="eco-activity" aria-label={label}>
      {items.map((item) => {
        const row = describe(item);
        return (
          <li key={item.id} className="eco-activity__row">
            <span className="eco-activity__icon material-symbols-outlined" aria-hidden="true">
              {ICONS[row.kind]}
            </span>
            <span className="eco-activity__main">
              <span className="eco-activity__label">{row.label}</span>
              <span className="eco-activity__meta">
                <time dateTime={item.timestamp} title={formatDateTime(item.timestamp)}>
                  {formatShortDate(item.timestamp)}
                </time>
                {row.note ? ` · ${row.note}` : null}
              </span>
            </span>
            <span className={`eco-activity__amount${row.gained ? " is-gain" : ""}`}>{row.amount}</span>
          </li>
        );
      })}
    </ul>
  );
}
