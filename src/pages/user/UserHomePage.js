import { useMemo, useState } from "react";
import { useAuth } from "../../app/AuthContext";
import { useData } from "../../app/DataContext";
import StatCard from "../../components/StatCard";

const formatDateTime = (timestamp) =>
  new Date(timestamp).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function UserHomePage() {
  const { currentUser } = useAuth();
  const { system, transactions, actions } = useData();
  const [bottleCount, setBottleCount] = useState(1);
  const [status, setStatus] = useState("");

  const userTransactions = useMemo(() => {
    if (!currentUser) {
      return [];
    }
    return transactions.filter((item) => item.userId === currentUser.id).slice(0, 8);
  }, [transactions, currentUser]);

  const storagePercent = Math.min(
    100,
    (system.bottleStorage / system.maxBottleCapacity) * 100
  );

  const handleInsertBottle = () => {
    if (!currentUser) {
      return;
    }

    const result = actions.insertBottle(currentUser.id, bottleCount);
    if (!result.ok) {
      setStatus(result.error);
      return;
    }

    setStatus(
      `Inserted ${bottleCount} bottle(s). You earned ${result.pointsEarned} points.`
    );
  };

  return (
    <div className="stack">
      <section className="stat-grid">
        <StatCard
          label="Your Points"
          value={currentUser?.points ?? 0}
          subtle="Wallet balance available for redemption"
        />
        <StatCard
          label="Rice Stock"
          value={`${system.riceStock} kg`}
          subtle="Shared inventory across all users"
        />
        <StatCard
          label="Bottle Storage"
          value={`${system.bottleStorage} / ${system.maxBottleCapacity}`}
          subtle={`${storagePercent.toFixed(0)}% full`}
        />
      </section>

      <section className="card">
        <h2 className="card-title">Insert Bottles</h2>
        <p className="muted-text">
          Every bottle gives <strong>{system.pointsPerBottle} point(s)</strong>.
        </p>
        <div className="action-row">
          <input
            className="input-field"
            type="number"
            min="1"
            value={bottleCount}
            onChange={(event) => setBottleCount(Math.max(1, Number(event.target.value)))}
          />
          <button type="button" className="btn-primary" onClick={handleInsertBottle}>
            Simulate Bottle Insert
          </button>
        </div>
        {status ? <p className="info-text">{status}</p> : null}
      </section>

      <section className="card">
        <h2 className="card-title">Recent Activity</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Type</th>
                <th>Details</th>
                <th>Points</th>
              </tr>
            </thead>
            <tbody>
              {userTransactions.length === 0 ? (
                <tr>
                  <td colSpan="4" className="muted-cell">
                    No activity yet.
                  </td>
                </tr>
              ) : (
                userTransactions.map((item) => (
                  <tr key={item.id}>
                    <td>{formatDateTime(item.timestamp)}</td>
                    <td>
                      <span className={`badge badge-${item.type}`}>{item.type}</span>
                    </td>
                    <td>{item.details}</td>
                    <td>{item.pointsDelta > 0 ? `+${item.pointsDelta}` : item.pointsDelta}</td>
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
