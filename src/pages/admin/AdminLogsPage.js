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
  const [form, setForm] = useState({
    title: "",
    message: "",
    targetRole: "all",
    userId: "",
  });
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const householdUsers = useMemo(
    () => users.filter((user) => user.role === "user"),
    [users]
  );

  const filteredTransactions = useMemo(() => {
    if (filterType === "all") {
      return transactions;
    }
    return transactions.filter((transaction) => transaction.type === filterType);
  }, [transactions, filterType]);

  const handleNotificationSubmit = (event) => {
    event.preventDefault();
    setStatus("");
    setError("");

    const result = actions.sendManualNotification(form);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setStatus("Notification sent successfully.");
    setForm({
      title: "",
      message: "",
      targetRole: "all",
      userId: "",
    });
  };

  return (
    <div className="stack">
      <section className="card">
        <h2 className="card-title">Manual Notifications</h2>
        <form className="stack" onSubmit={handleNotificationSubmit}>
          <div className="split-grid">
            <label>
              Title
              <input
                className="input-field"
                value={form.title}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, title: event.target.value }))
                }
                required
              />
            </label>
            <label>
              Target
              <select
                className="input-field"
                value={form.targetRole}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, targetRole: event.target.value }))
                }
              >
                <option value="all">All Users</option>
                <option value="admin">Admins</option>
                <option value="user">Specific Household User</option>
              </select>
            </label>
          </div>

          {form.targetRole === "user" ? (
            <label>
              Household User
              <select
                className="input-field"
                value={form.userId}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, userId: event.target.value }))
                }
                required
              >
                <option value="">Select user</option>
                {householdUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label>
            Message
            <textarea
              className="input-field textarea"
              value={form.message}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, message: event.target.value }))
              }
              required
            />
          </label>
          <button className="btn-primary" type="submit">
            Send Notification
          </button>
        </form>
        {status ? <p className="success-text">{status}</p> : null}
        {error ? <p className="error-text">{error}</p> : null}
      </section>

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
