import { useEffect, useMemo, useState } from "react";
import { useData } from "../../app/DataContext";

const emptyNewUser = {
  name: "",
  email: "",
  password: "",
};

export default function AdminUsersPage() {
  const { users, transactions, actions } = useData();
  const [newUser, setNewUser] = useState(emptyNewUser);
  const [editingId, setEditingId] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingForm, setEditingForm] = useState({
    name: "",
    email: "",
    weightKg: 0,
    password: "",
  });
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const modalOpen = Boolean(selectedUserId);

  const householdUsers = useMemo(
    () => users.filter((user) => user.role === "user"),
    [users]
  );

  const selectedHousehold = useMemo(
    () => householdUsers.find((user) => user.id === selectedUserId) || null,
    [householdUsers, selectedUserId]
  );

  const selectedUserLogs = useMemo(() => {
    if (!selectedUserId) {
      return [];
    }

    return transactions
      .filter(
        (item) =>
          item.userId === selectedUserId &&
          (item.type === "bottle" || item.type === "redeem")
      )
      .slice(0, 20);
  }, [transactions, selectedUserId]);

  const formatDateTime = (timestamp) =>
    new Date(timestamp).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const toCreditLog = (log) => {
    if (log.type === "bottle") {
      return `Inserted ${log.amount} bottle(s), +${log.kgDelta} kg earned.`;
    }

    return `Redeemed ${Math.abs(log.riceDeltaKg)} kg of rice, -${Math.abs(
      log.kgDelta
    )} kg used.`;
  };

  const startEdit = (user) => {
    setEditingId(user.id);
    setEditingForm({
      name: user.name,
      email: user.email,
      weightKg: user.weightKg,
      password: "",
    });
  };

  const handleCreateUser = (event) => {
    event.preventDefault();
    setError("");
    setStatus("");

    const result = actions.addUser({ ...newUser });
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setStatus(`Created account for ${result.user.name}.`);
    setNewUser(emptyNewUser);
    setShowCreateForm(false);
  };

  const handleSaveUser = (userId) => {
    setError("");
    setStatus("");

    const result = actions.updateUser(userId, editingForm);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setStatus(`Updated ${result.user.name} successfully.`);
    setEditingId("");
  };

  const handleDeleteUser = (userId, name) => {
    setError("");
    setStatus("");

    if (!window.confirm(`Delete household account for ${name}?`)) {
      return;
    }

    const result = actions.deleteUser(userId);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setStatus(`Deleted account for ${name}.`);
  };

  const closeLogsModal = () => {
    setSelectedUserId("");
  };

  useEffect(() => {
    if (!modalOpen) {
      document.body.style.overflow = "";
      return undefined;
    }

    document.body.style.overflow = "hidden";
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        closeLogsModal();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [modalOpen]);

  return (
    <div className="stack">
      <section className="card">
        <div className="row-between">
          <h2 className="card-title">Create Household Account</h2>
          <button
            type="button"
            className="btn-primary"
            onClick={() => setShowCreateForm((value) => !value)}
          >
            {showCreateForm ? "Hide Form" : "Add Household User"}
          </button>
        </div>

        {showCreateForm ? (
          <form className="split-grid" onSubmit={handleCreateUser}>
            <label>
              Name
              <input
                className="input-field"
                value={newUser.name}
                onChange={(event) =>
                  setNewUser((prev) => ({ ...prev, name: event.target.value }))
                }
                required
              />
            </label>
            <label>
              Email
              <input
                className="input-field"
                type="email"
                value={newUser.email}
                onChange={(event) =>
                  setNewUser((prev) => ({ ...prev, email: event.target.value }))
                }
                required
              />
            </label>
            <label>
              Password
              <input
                className="input-field"
                type="text"
                value={newUser.password}
                onChange={(event) =>
                  setNewUser((prev) => ({ ...prev, password: event.target.value }))
                }
                required
              />
            </label>
            <button className="btn-primary" type="submit">
              Save Household User
            </button>
          </form>
        ) : null}

        {status ? <p className="success-text">{status}</p> : null}
        {error ? <p className="error-text">{error}</p> : null}
      </section>

      <section className="card">
        <h2 className="card-title">Manage Users</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Balance (kg)</th>
                <th>View</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {householdUsers.map((user) => {
                const isEditing = editingId === user.id;
                return (
                  <tr key={user.id}>
                    <td>
                      {isEditing ? (
                        <input
                          className="input-field"
                          value={editingForm.name}
                          onChange={(event) =>
                            setEditingForm((prev) => ({
                              ...prev,
                              name: event.target.value,
                            }))
                          }
                        />
                      ) : (
                        user.name
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          className="input-field"
                          value={editingForm.email}
                          onChange={(event) =>
                            setEditingForm((prev) => ({
                              ...prev,
                              email: event.target.value,
                            }))
                          }
                        />
                      ) : (
                        user.email
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          className="input-field"
                          type="number"
                          min="0"
                          step="0.001"
                          value={editingForm.weightKg}
                          onChange={(event) =>
                            setEditingForm((prev) => ({
                              ...prev,
                              weightKg: Math.max(0, Number(event.target.value)),
                            }))
                          }
                        />
                      ) : (
                        `${(user.weightKg ?? 0).toFixed(3)} kg`
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="outline-btn"
                        onClick={() => setSelectedUserId(user.id)}
                      >
                        View
                      </button>
                    </td>
                    <td className="actions-cell">
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            className="btn-primary"
                            onClick={() => handleSaveUser(user.id)}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="outline-btn"
                            onClick={() => setEditingId("")}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="outline-btn"
                            onClick={() => startEdit(user)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="danger-btn"
                            onClick={() => handleDeleteUser(user.id, user.name)}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {modalOpen && selectedHousehold ? (
        <div className="modal-overlay" onClick={closeLogsModal}>
          <section className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 className="card-title">Household Activity Logs</h2>
                <p className="muted-text">{selectedHousehold.name}</p>
              </div>
              <button type="button" className="outline-btn" onClick={closeLogsModal}>
                Close
              </button>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Activity</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedUserLogs.length === 0 ? (
                    <tr>
                      <td colSpan="2" className="muted-cell">
                        No bottle insert/redeem logs for {selectedHousehold.name}.
                      </td>
                    </tr>
                  ) : (
                    selectedUserLogs.map((log) => (
                      <tr key={log.id}>
                        <td>{formatDateTime(log.timestamp)}</td>
                        <td>{toCreditLog(log)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
