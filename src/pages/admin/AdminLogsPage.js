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
  const { transactions } = useData();
  const [filterType, setFilterType] = useState("all");

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

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Type</th>
                <th>Details</th>
                <th>kg Delta</th>
                <th>Rice</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan="6" className="muted-cell">
                    No logs available for this filter.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((item) => (
                  <tr key={item.id}>
                    <td>{formatDateTime(item.timestamp)}</td>
                    <td>{item.userName}</td>
                    <td>
                      <span className={`badge badge-${item.type}`}>{item.type}</span>
                    </td>
                    <td>{item.details}</td>
                    <td>{item.kgDelta > 0 ? `+${item.kgDelta}` : item.kgDelta} kg</td>
                    <td>{item.riceDeltaKg} kg</td>
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
