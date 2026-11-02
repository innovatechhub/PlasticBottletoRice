import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useData } from "../../app/DataContext";
import { buildAlerts } from "../../admin/alerts";
import { getBinStatus } from "../../admin/binStatus";
import { counterCheck, ledgerByResident } from "../../admin/ledger";
import useNow from "../../admin/useNow";
import {
  AdminSection,
  EmptyRow,
  LoadErrorNotice,
  StatusBadge,
  TypeBadge,
} from "../../components/admin/AdminUI";
import DailyBarChart from "../../components/admin/DailyBarChart";
import { formatDate, formatDateTime, formatKg, formatKgChange, toDate } from "../../utils/format";

const CHART_DAYS = 14;
// Validated chart colours (green for bottles, rice amber for redemptions).
const CHART_COLORS = { bottles: "#236b35", rice: "#b7791f" };
const SEVERITY_TONE = { critical: "critical", warning: "warning", info: "info" };
const SEVERITY_LABEL = { critical: "Urgent", warning: "Check", info: "Info" };

const dayKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

function dailySeries(transactions, now) {
  const days = [];
  const index = new Map();
  for (let offset = CHART_DAYS - 1; offset >= 0; offset -= 1) {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - offset);
    const key = dayKey(date);
    index.set(key, days.length);
    days.push({
      key,
      label: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      longLabel: formatDate(date),
      bottles: 0,
      riceKg: 0,
    });
  }
  transactions.forEach((tx) => {
    const date = toDate(tx.timestamp);
    if (!date) return;
    const slot = index.get(dayKey(date));
    if (slot === undefined) return;
    if (tx.type === "bottle") days[slot].bottles += Number(tx.bottleDelta ?? tx.amount) || 0;
    if (tx.type === "redeem" && tx.status !== "declined") {
      days[slot].riceKg += Math.abs(Number(tx.riceDeltaKg) || 0);
    }
  });
  return days;
}

function MetricCard({ label, scope, value, sub, tone, children }) {
  return (
    <div className={`adm-metric${tone ? ` adm-metric--${tone}` : ""}`}>
      <p className="adm-metric__label">
        {label}
        <span className="adm-metric__scope">{scope}</span>
      </p>
      <p className="adm-metric__value">{value}</p>
      {sub ? <p className="adm-metric__sub">{sub}</p> : null}
      {children}
    </div>
  );
}

export default function AdminDashboardPage() {
  const { users, transactions, system, syncErrors } = useData();
  const now = useNow();

  const residents = useMemo(() => users.filter((u) => u.role === "user"), [users]);
  const alerts = useMemo(
    () => buildAlerts({ system, users, transactions, now }),
    [system, users, transactions, now]
  );
  const check = useMemo(
    () => counterCheck({ system, residents, transactions }),
    [system, residents, transactions]
  );
  const ledger = useMemo(() => ledgerByResident(transactions), [transactions]);
  const series = useMemo(() => dailySeries(transactions, now), [transactions, now]);

  const binIds = Object.keys(system.bins || {});
  const binCounts = binIds.reduce((counts, binId) => {
    const { state } = getBinStatus(system.hardwareBins?.[binId], now);
    counts[state] = (counts[state] || 0) + 1;
    return counts;
  }, {});

  const riceStock = Number(system.riceStock) || 0;
  const capacity = Number(system.maxBottleCapacity) || 0;
  const stored = Number(system.bottleStorage) || 0;
  const storagePercent = capacity > 0 ? Math.min(100, (stored / capacity) * 100) : 0;

  const redemptions = transactions.filter((tx) => tx.type === "redeem" && tx.status !== "declined");
  const riceRedeemed = redemptions.reduce((sum, tx) => sum + Math.abs(Number(tx.riceDeltaKg) || 0), 0);

  const barangays = useMemo(() => {
    const groups = new Map();
    residents.forEach((user) => {
      const name = user.barangay || "No barangay";
      const group = groups.get(name) || { name, residents: 0, bottles: 0, earnedKg: 0, balanceKg: 0 };
      const entry = ledger.get(user.id);
      group.residents += 1;
      group.bottles += entry?.bottles || 0;
      group.earnedKg += entry?.earnedKg || 0;
      group.balanceKg += Number(user.weightKg) || 0;
      groups.set(name, group);
    });
    return [...groups.values()].sort((a, b) => b.earnedKg - a.earnedKg);
  }, [residents, ledger]);

  const recent = transactions.slice(0, 8);

  return (
    <div className="adm-page">
      <LoadErrorNotice errors={syncErrors} sources={["users", "transactions", "bin_status"]} />

      <AdminSection title="Needs attention" className="adm-attention">
        {alerts.length === 0 ? (
          <p className="adm-all-clear">
            <StatusBadge tone="good">No issues found</StatusBadge>
            Rice is in stock, every bin reports in, and the totals match the transaction log.
          </p>
        ) : (
          <ul className="adm-alert-list">
            {alerts.map((alert) => (
              <li key={alert.id} className={`adm-alert-item adm-alert-item--${alert.severity}`}>
                <StatusBadge tone={SEVERITY_TONE[alert.severity]}>{SEVERITY_LABEL[alert.severity]}</StatusBadge>
                <div className="adm-alert-item__text">
                  <strong>{alert.title}</strong>
                  <span>{alert.detail}</span>
                </div>
                {alert.to.startsWith("#") ? (
                  <a className="adm-link" href={alert.to}>
                    {alert.linkLabel}
                  </a>
                ) : (
                  <Link className="adm-link" to={alert.to}>
                    {alert.linkLabel}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </AdminSection>

      <div className="adm-metrics">
        <MetricCard
          label="Rice stock"
          scope="Current, all bins"
          value={riceStock <= 0 ? "Out of stock" : formatKg(riceStock)}
          tone={riceStock <= 0 ? "critical" : undefined}
          sub={riceStock <= 0 ? "Residents can't redeem until rice is restocked." : "Available for redemptions"}
        />
        <MetricCard label="Bins" scope="Registered" value={binIds.length}>
          <p className="adm-metric__badges">
            {["online", "delayed", "offline", "nodata"]
              .filter((state) => binCounts[state])
              .map((state) => (
                <StatusBadge
                  key={state}
                  tone={{ online: "good", delayed: "warning", offline: "critical", nodata: "neutral" }[state]}
                >
                  {binCounts[state]} {{ online: "online", delayed: "delayed", offline: "offline", nodata: "no data" }[state]}
                </StatusBadge>
              ))}
          </p>
        </MetricCard>
        <MetricCard
          label="Bottle storage"
          scope="Estimated"
          value={`${stored} / ${capacity}`}
          tone={storagePercent >= 90 ? "warning" : undefined}
          sub="Counted from saved bottles, not measured by a sensor"
        >
          <div className="adm-meter" aria-hidden="true">
            <span style={{ width: `${storagePercent}%` }} />
          </div>
        </MetricCard>
        <MetricCard
          label="Residents"
          scope="Registered now"
          value={residents.length.toLocaleString()}
          sub={`${residents.filter((u) => !u.barangay).length} without a barangay`}
        />
        <MetricCard
          label="Bottles recycled"
          scope="Lifetime, stored counter"
          value={(Number(system.totalItemsRecycled) || 0).toLocaleString()}
          sub={`${formatKg(system.totalWeightRecycledKg)} of plastic`}
        />
        <MetricCard
          label="Rice redeemed"
          scope="Lifetime, from log"
          value={formatKg(riceRedeemed)}
          sub={`${redemptions.length} redemption${redemptions.length === 1 ? "" : "s"}, declined ones excluded`}
        />
      </div>

      <AdminSection
        title="Activity, last 14 days"
        description="From the transaction log. Hover a bar for the exact value."
      >
        <div className="adm-chart-grid">
          <DailyBarChart
            title="Bottles saved per day"
            days={series.map((day) => ({ ...day, value: day.bottles }))}
            color={CHART_COLORS.bottles}
            formatValue={(value, axis) => (axis ? String(Math.round(value)) : `${value} bottle${value === 1 ? "" : "s"}`)}
          />
          <DailyBarChart
            title="Rice redeemed per day"
            days={series.map((day) => ({ ...day, value: day.riceKg }))}
            color={CHART_COLORS.rice}
            formatValue={(value) => formatKg(value)}
          />
        </div>
        <details className="adm-details">
          <summary>Show as table</summary>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th scope="col">Day</th>
                  <th scope="col" className="adm-num">Bottles saved</th>
                  <th scope="col" className="adm-num">Rice redeemed</th>
                </tr>
              </thead>
              <tbody>
                {series.map((day) => (
                  <tr key={day.key}>
                    <td>{day.longLabel}</td>
                    <td className="adm-num">{day.bottles}</td>
                    <td className="adm-num">{formatKg(day.riceKg)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </AdminSection>

      <AdminSection title="Barangays" description="Lifetime figures from the transaction log; balance is current.">
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th scope="col">Barangay</th>
                <th scope="col" className="adm-num">Residents</th>
                <th scope="col" className="adm-num">Bottles</th>
                <th scope="col" className="adm-num">Plastic</th>
                <th scope="col" className="adm-num">Balance</th>
              </tr>
            </thead>
            <tbody>
              {barangays.length === 0 ? (
                <EmptyRow colSpan={5}>No residents yet.</EmptyRow>
              ) : (
                barangays.map((group) => (
                  <tr key={group.name}>
                    <td>
                      {group.name === "No barangay" ? (
                        <StatusBadge tone="warning">No barangay</StatusBadge>
                      ) : (
                        group.name
                      )}
                    </td>
                    <td className="adm-num">{group.residents}</td>
                    <td className="adm-num">{group.bottles}</td>
                    <td className="adm-num">{formatKg(group.earnedKg)}</td>
                    <td className="adm-num">{formatKg(group.balanceKg)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </AdminSection>

      <AdminSection
        id="data-check"
        title="Data check"
        description="Read-only. Compares the stored counters with what the transaction log adds up to."
      >
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th scope="col">Lifetime total</th>
                <th scope="col" className="adm-num">System counter</th>
                <th scope="col" className="adm-num">Residents' counters</th>
                <th scope="col" className="adm-num">Transaction log</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Bottles</th>
                <td className="adm-num">{check.bottles.system}</td>
                <td className="adm-num">{check.bottles.residents}</td>
                <td className="adm-num">{check.bottles.ledger}</td>
              </tr>
              <tr>
                <th scope="row">Plastic weight</th>
                <td className="adm-num">{formatKg(check.weightKg.system)}</td>
                <td className="adm-num">{formatKg(check.weightKg.residents)}</td>
                <td className="adm-num">{formatKg(check.weightKg.ledger)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="adm-section__foot">
          {check.matches ? (
            <StatusBadge tone="good">All three agree</StatusBadge>
          ) : (
            <StatusBadge tone="warning">They differ. Nothing has been changed.</StatusBadge>
          )}
        </p>
      </AdminSection>

      <AdminSection
        title="Recent activity"
        actions={
          <Link className="adm-link" to="/admin/logs">
            All logs
          </Link>
        }
      >
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Resident</th>
                <th scope="col">Type</th>
                <th scope="col" className="adm-num">Balance change</th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 ? (
                <EmptyRow colSpan={4}>No activity yet. Bottle saves and redemptions appear here.</EmptyRow>
              ) : (
                recent.map((tx) => (
                  <tr key={tx.id}>
                    <td>{formatDateTime(tx.timestamp)}</td>
                    <td>{tx.userName}</td>
                    <td>
                      <TypeBadge tx={tx} />
                    </td>
                    <td className="adm-num">{tx.type === "system" ? "—" : formatKgChange(tx.kgDelta)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </AdminSection>
    </div>
  );
}
