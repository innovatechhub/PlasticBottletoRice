import { useMemo, useState } from "react";
import { useData } from "../../app/DataContext";

const formatDateTime = (timestamp) =>
  new Date(timestamp).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function AdminLogsPage() {
  const { transactions, users, actions } = useData();
  const [filterType, setFilterType] = useState("all");
  const [error, setError] = useState("");

  const barangayByUserId = useMemo(() => {
    const map = new Map();
    users.forEach((user) => map.set(user.id, user.barangay || "—"));
    return map;
  }, [users]);

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

  const filteredTransactions = useMemo(() => {
    if (filterType === "all") {
      return transactions;
    }
    return transactions.filter((transaction) => transaction.type === filterType);
  }, [transactions, filterType]);

  return (
    <div className="stack">
      <section className="card">
        <div className="row-between">
          <h2 className="card-title">System Transaction Logs</h2>
          <select
            className="input-field compact"
            value={filterType}
            onChange={(event) => setFilterType(event.target.value)}
          >
            <option value="all">All</option>
            <option value="bottle">Bottle Inserts</option>
            <option value="redeem">Rice Redemptions</option>
            <option value="system">System Events</option>
          </select>
        </div>

        {error ? <p className="error-text">{error}</p> : null}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Barangay</th>
                <th>Type</th>
                <th>Details</th>
                <th>Deposit</th>
                <th>Redeem</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan="9" className="muted-cell">
                    No logs available for this filter.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((item) => (
                  <tr key={item.id}>
                    <td>{formatDateTime(item.timestamp)}</td>
                    <td>{item.userName}</td>
                    <td>{barangayByUserId.get(item.userId) || "—"}</td>
                    <td>
                      <span className={`badge badge-${item.type}`}>{item.type}</span>
                    </td>
                    <td>{item.details}</td>
                    <td>{item.type === "bottle" ? `+${item.kgDelta} kg` : "—"}</td>
                    <td>{item.type === "redeem" ? `${Math.abs(item.riceDeltaKg)} kg` : "—"}</td>
                    <td>
                      {item.type === "redeem" ? (
                        <span
                          className={`adm-badge ${
                            item.status === "declined"
                              ? "adm-badge--red"
                              : "adm-badge--green"
                          }`}
                        >
                          {item.status === "declined" ? "Declined" : "Completed"}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      {item.type === "redeem" && item.status !== "declined" ? (
                        <button
                          type="button"
                          className="danger-btn"
                          onClick={() => handleDecline(item.id)}
                        >
                          Decline
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
