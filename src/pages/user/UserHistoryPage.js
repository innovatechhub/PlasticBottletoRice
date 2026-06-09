import { useMemo } from "react";
import { useAuth } from "../../app/AuthContext";
import { useData } from "../../app/DataContext";

const formatDateTime = (timestamp) =>
  new Date(timestamp).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const formatSigned = (value, suffix = "") => {
  if (!value) {
    return `0${suffix}`;
  }
  return `${value > 0 ? "+" : ""}${value}${suffix}`;
};

export default function UserHistoryPage() {
  const { currentUser } = useAuth();
  const { transactions } = useData();

  const rows = useMemo(() => {
    if (!currentUser) {
      return [];
    }
    return transactions.filter((item) => item.userId === currentUser.id);
  }, [transactions, currentUser]);

  return (
    <section className="card">
      <h2 className="card-title">Your Transaction Logs</h2>
      <p className="muted-text">Every bottle insert and rice redemption is tracked.</p>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Details</th>
              <th>kg Delta</th>
              <th>Rice Delta</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan="5" className="muted-cell">
                  No transactions for this account.
                </td>
              </tr>
            ) : (
              rows.map((item) => (
                <tr key={item.id}>
                  <td>{formatDateTime(item.timestamp)}</td>
                  <td>
                    <span className={`badge badge-${item.type}`}>{item.type}</span>
                  </td>
                  <td>{item.details}</td>
                  <td>{formatSigned(item.kgDelta, " kg")}</td>
                  <td>{formatSigned(item.riceDeltaKg, " kg")}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
