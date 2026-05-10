import { useMemo } from "react";
import { useData } from "../../app/DataContext";
import StatCard from "../../components/StatCard";

const formatDateTime = (timestamp) =>
  new Date(timestamp).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function AdminDashboardPage() {
  const { users, transactions, system } = useData();

  const households = useMemo(
    () => users.filter((user) => user.role === "user"),
    [users]
  );
  const recentTransactions = transactions.slice(0, 10);
  const storagePercent = Math.min(
    100,
    (system.bottleStorage / system.maxBottleCapacity) * 100
  );

  return (
    <div className="stack">
      <section className="stat-grid">
        <StatCard
          label="Total Rice Available"
          value={`${system.riceStock} kg`}
          subtle="Current shared stock"
        />
        <StatCard
          label="Total Bottles Collected"
          value={system.bottleStorage}
          subtle={`${storagePercent.toFixed(0)}% of capacity`}
        />
        <StatCard
          label="Active Household Users"
          value={households.length}
          subtle="Accounts managed by admin"
        />
        <StatCard
          label="Transactions Logged"
          value={transactions.length}
          subtle="Bottle inserts and redemptions"
        />
      </section>

      {system.riceStock <= 0 ? (
        <section className="alert-box alert-danger">
          Rice stock is out. Restock immediately to continue redemptions.
        </section>
      ) : null}

      {system.bottleStorage >= system.maxBottleCapacity ? (
        <section className="alert-box alert-warning">
          Bottle storage reached max capacity. Schedule collection.
        </section>
      ) : null}

      <section className="card">
        <h2 className="card-title">Recent System Logs</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Type</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {recentTransactions.length === 0 ? (
                <tr>
                  <td colSpan="4" className="muted-cell">
                    No logs yet.
                  </td>
                </tr>
              ) : (
                recentTransactions.map((item) => (
                  <tr key={item.id}>
                    <td>{formatDateTime(item.timestamp)}</td>
                    <td>{item.userName}</td>
                    <td>
                      <span className={`badge badge-${item.type}`}>{item.type}</span>
                    </td>
                    <td>{item.details}</td>
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
