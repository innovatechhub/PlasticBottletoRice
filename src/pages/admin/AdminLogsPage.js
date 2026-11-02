import { useMemo, useState } from "react";
import { useData } from "../../app/DataContext";
import Pagination from "../../components/Pagination";
import { AdminSection, EmptyRow, LoadErrorNotice, StatusBadge, TypeBadge } from "../../components/admin/AdminUI";
import { downloadCsv, toCsv } from "../../admin/csv";
import { formatDateTime, formatKg, formatKgChange, toDate } from "../../utils/format";

const PAGE_SIZE = 15;

const TYPES = [
  { value: "all", label: "All" },
  { value: "bottle", label: "Bottles" },
  { value: "redeem", label: "Redemptions" },
  { value: "system", label: "System" },
];

// Bottle entries name the bin in their text ("… via bin_001 …"); transactions have no bin field.
const binFromDetails = (details) => {
  const match = /via ([A-Za-z0-9_-]+)/.exec(details || "");
  return match ? match[1] : "";
};

// Details without what other columns already show.
function shortDetails(tx) {
  if (tx.type === "bottle") {
    const count = Number(tx.bottleDelta ?? tx.amount) || 0;
    const bin = binFromDetails(tx.details);
    return `${count} bottle${count === 1 ? "" : "s"}${bin ? ` at ${bin}` : ""}`;
  }
  if (tx.type === "redeem") return "";
  return tx.details || "";
}

const startOfDay = (value) => (value ? new Date(`${value}T00:00:00`).getTime() : null);
const endOfDay = (value) => (value ? new Date(`${value}T23:59:59.999`).getTime() : null);

export default function AdminLogsPage() {
  const { transactions, users, actions, syncErrors } = useData();
  const [filters, setFilters] = useState({ type: "all", search: "", from: "", to: "", barangay: "" });
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);

  const barangayByUserId = useMemo(() => {
    const map = new Map();
    users.forEach((user) => map.set(user.id, user.barangay || ""));
    return map;
  }, [users]);

  const barangayOptions = useMemo(
    () => [...new Set(users.map((u) => u.barangay).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [users]
  );

  // Unchanged: same action and confirmation as before, pending the owner's decision.
  const handleDecline = (transactionId) => {
    setError("");
    if (!window.confirm("Decline this redemption and refund the household?")) {
      return;
    }
    const result = actions.declineRedemption(transactionId);
    if (!result.ok) {
      setError(result.error);
    }
  };

  const matchesNonType = useMemo(() => {
    const query = filters.search.trim().toLowerCase();
    const from = startOfDay(filters.from);
    const to = endOfDay(filters.to);
    return (tx) => {
      if (query && !`${tx.userName} ${tx.details}`.toLowerCase().includes(query)) return false;
      const time = toDate(tx.timestamp)?.getTime();
      if (from !== null && !(time >= from)) return false;
      if (to !== null && !(time <= to)) return false;
      if (filters.barangay === "__missing" && (tx.type === "system" || barangayByUserId.get(tx.userId))) {
        return false;
      }
      if (filters.barangay && filters.barangay !== "__missing" && barangayByUserId.get(tx.userId) !== filters.barangay) {
        return false;
      }
      return true;
    };
  }, [filters.search, filters.from, filters.to, filters.barangay, barangayByUserId]);

  const counts = useMemo(() => {
    const result = { all: 0, bottle: 0, redeem: 0, system: 0 };
    transactions.forEach((tx) => {
      if (!matchesNonType(tx)) return;
      result.all += 1;
      if (result[tx.type] !== undefined) result[tx.type] += 1;
    });
    return result;
  }, [transactions, matchesNonType]);

  const filtered = useMemo(
    () => transactions.filter((tx) => (filters.type === "all" || tx.type === filters.type) && matchesNonType(tx)),
    [transactions, filters.type, matchesNonType]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const setFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };
  const filtersActive = filters.search || filters.from || filters.to || filters.barangay || filters.type !== "all";

  const exportCsv = () => {
    const csv = toCsv(
      [
        { label: "Date", value: (tx) => tx.timestamp },
        { label: "Resident", value: (tx) => tx.userName },
        { label: "Barangay", value: (tx) => barangayByUserId.get(tx.userId) || "" },
        { label: "Type", value: (tx) => tx.type },
        { label: "Status", value: (tx) => tx.status },
        { label: "Bottles", value: (tx) => (tx.type === "bottle" ? tx.bottleDelta ?? tx.amount : "") },
        { label: "Balance change (kg)", value: (tx) => (tx.type === "system" ? "" : Number(tx.kgDelta).toFixed(3)) },
        { label: "Rice (kg)", value: (tx) => (tx.type === "redeem" ? Math.abs(Number(tx.riceDeltaKg)).toFixed(3) : "") },
        { label: "Details", value: (tx) => tx.details },
      ],
      filtered
    );
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`ecorice-logs-${stamp}.csv`, csv);
  };

  return (
    <div className="adm-page">
      <LoadErrorNotice errors={syncErrors} sources={["transactions", "users"]} />
      {error ? (
        <div className="adm-notice adm-notice--critical" role="alert">
          {error}
        </div>
      ) : null}

      <AdminSection
        title="Transaction log"
        description="Every bottle save, redemption and system change."
        actions={
          <button
            type="button"
            className="adm-btn adm-btn--secondary"
            onClick={exportCsv}
            disabled={filtered.length === 0}
          >
            Export CSV ({filtered.length})
          </button>
        }
      >
        <div className="adm-chips" role="group" aria-label="Type">
          {TYPES.map((type) => (
            <button
              key={type.value}
              type="button"
              className={`adm-chip${filters.type === type.value ? " is-active" : ""}`}
              aria-pressed={filters.type === type.value}
              onClick={() => setFilter("type", type.value)}
            >
              {type.label}
              <span className="adm-chip__count">{counts[type.value]}</span>
            </button>
          ))}
        </div>

        <div className="adm-filters" role="search" aria-label="Filter logs">
          <label className="adm-field adm-field--grow">
            <span>Search</span>
            <input
              type="search"
              className="adm-input"
              value={filters.search}
              onChange={(e) => setFilter("search", e.target.value)}
              placeholder="Resident or details"
            />
          </label>
          <label className="adm-field">
            <span>From</span>
            <input type="date" className="adm-input" value={filters.from} max={filters.to || undefined} onChange={(e) => setFilter("from", e.target.value)} />
          </label>
          <label className="adm-field">
            <span>To</span>
            <input type="date" className="adm-input" value={filters.to} min={filters.from || undefined} onChange={(e) => setFilter("to", e.target.value)} />
          </label>
          <label className="adm-field">
            <span>Barangay</span>
            <select className="adm-input" value={filters.barangay} onChange={(e) => setFilter("barangay", e.target.value)}>
              <option value="">All barangays</option>
              <option value="__missing">Missing barangay</option>
              {barangayOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          {filtersActive ? (
            <button
              type="button"
              className="adm-btn adm-btn--link adm-filters__clear"
              onClick={() => {
                setFilters({ type: "all", search: "", from: "", to: "", barangay: "" });
                setPage(1);
              }}
            >
              Clear filters
            </button>
          ) : null}
        </div>

        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Resident</th>
                <th scope="col">Barangay</th>
                <th scope="col">Type</th>
                <th scope="col">Details</th>
                <th scope="col" className="adm-num">Balance change</th>
                <th scope="col" className="adm-num">Rice</th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="adm-sr-only">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <EmptyRow colSpan={9}>
                  {transactions.length === 0 ? "No activity yet." : "No logs match these filters."}
                </EmptyRow>
              ) : (
                paged.map((tx) => {
                  const barangay = barangayByUserId.get(tx.userId);
                  return (
                    <tr key={tx.id}>
                      <td className="adm-nowrap">{formatDateTime(tx.timestamp)}</td>
                      <td>{tx.userName}</td>
                      <td>{tx.type === "system" ? "—" : barangay || <span className="adm-muted">Missing</span>}</td>
                      <td>
                        <TypeBadge tx={tx} />
                      </td>
                      <td className="adm-details-cell">{shortDetails(tx) || "—"}</td>
                      <td className="adm-num">{tx.type === "system" ? "—" : formatKgChange(tx.kgDelta)}</td>
                      <td className="adm-num">{tx.type === "redeem" ? formatKg(Math.abs(tx.riceDeltaKg)) : "—"}</td>
                      <td>
                        {tx.type === "redeem" ? (
                          <StatusBadge tone={tx.status === "declined" ? "neutral" : "good"}>
                            {tx.status === "declined" ? "Declined" : "Completed"}
                          </StatusBadge>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        {tx.type === "redeem" && tx.status !== "declined" ? (
                          <button
                            type="button"
                            className="adm-btn adm-btn--danger-outline adm-btn--small"
                            aria-label={`Decline redemption by ${tx.userName} on ${formatDateTime(tx.timestamp)}`}
                            onClick={() => handleDecline(tx.id)}
                          >
                            Decline
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && filtersActive ? null : (
          <Pagination
            page={currentPage}
            totalPages={totalPages}
            totalCount={filtered.length}
            onPageChange={setPage}
            label="log"
          />
        )}
      </AdminSection>
    </div>
  );
}
