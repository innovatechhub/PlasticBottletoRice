import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useData } from "../../app/DataContext";
import { tibiaoBarangays } from "../../constants/tibiaoBarangays";

const emptyNewUser = {
  name: "",
  email: "",
  barangay: "",
  password: "",
};

export default function AdminUsersPage() {
  const { users, actions } = useData();
  const [newUser, setNewUser] = useState(emptyNewUser);
  const [editingId, setEditingId] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingForm, setEditingForm] = useState({
    name: "",
    email: "",
    weightKg: 0,
    password: "",
  });
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const householdUsers = useMemo(
    () => users.filter((user) => user.role === "user"),
    [users]
  );

  const filteredHouseholdUsers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) {
      return householdUsers;
    }

    return householdUsers.filter((user) => {
      const haystack = [
        user.name,
        user.email,
        user.barangay,
        user.id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [householdUsers, searchTerm]);

  const startEdit = (user) => {
    setEditingId(user.id);
    setEditingForm({
      name: user.name,
      email: user.email,
      barangay: user.barangay || "",
      weightKg: user.weightKg,
      password: "",
    });
  };

  const handleCreateUser = async (event) => {
    event.preventDefault();
    setError("");
    setStatus("");

    const result = await actions.addUser({ ...newUser });
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setStatus(`Created account for ${result.user.name}.`);
    setNewUser(emptyNewUser);
    setShowCreateForm(false);
  };

  const handleSaveUser = async (userId) => {
    setError("");
    setStatus("");

    const result = await actions.updateUser(userId, editingForm);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setStatus(`Updated ${result.user.name} successfully.`);
    setEditingId("");
  };

  const handleDeleteUser = async (userId, name) => {
    setError("");
    setStatus("");

    if (!window.confirm(`Delete household account for ${name}?`)) {
      return;
    }

    const result = await actions.deleteUser(userId);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setStatus(`Deleted account for ${name}.`);
  };

  return (
    <div className="stack">
      <section className="card">
        <div className="row-between">
          <h2 className="card-title">Household Management</h2>
          <button
            type="button"
            className="btn-primary"
            onClick={() => setShowCreateForm(true)}
          >
            Add Household
          </button>
        </div>

        {status ? <p className="success-text">{status}</p> : null}
        {error ? <p className="error-text">{error}</p> : null}
      </section>

      <section className="card">
        <div className="row-between">
          <h2 className="card-title">Household Accounts</h2>
          <input
            className="input-field"
            style={{ maxWidth: "320px" }}
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search households"
            aria-label="Search households"
          />
        </div>
        <p className="muted-text" style={{ marginTop: "8px" }}>
          Showing {filteredHouseholdUsers.length} of {householdUsers.length} household
          {householdUsers.length === 1 ? "" : "s"}.
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Barangay</th>
                <th>Balance (kg)</th>
                <th>View</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredHouseholdUsers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="muted-cell">
                    No households match your search.
                  </td>
                </tr>
              ) : (
                filteredHouseholdUsers.map((user) => {
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
                        <select
                          className="input-field"
                          value={editingForm.barangay}
                          onChange={(event) =>
                            setEditingForm((prev) => ({
                              ...prev,
                              barangay: event.target.value,
                            }))
                          }
                          required
                        >
                          <option value="">Select barangay</option>
                          {tibiaoBarangays.map((barangay) => (
                            <option key={barangay} value={barangay}>
                              {barangay}
                            </option>
                          ))}
                        </select>
                      ) : (
                        user.barangay || "—"
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
                      <Link
                        to={`/admin/users/${user.id}`}
                        className="outline-btn"
                        style={{ display: "inline-block", textDecoration: "none" }}
                      >
                        View
                      </Link>
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
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showCreateForm ? (
        <div
          className="modal-overlay"
          role="presentation"
          onClick={() => setShowCreateForm(false)}
        >
          <div
            className="modal-card household-create-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="household-create-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h2 className="card-title" id="household-create-title">
                Create Household Account
              </h2>
              <button
                type="button"
                className="outline-btn"
                onClick={() => setShowCreateForm(false)}
              >
                Close
              </button>
            </div>

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
              <label className="split-grid__full">
                Barangay
                <select
                  className="input-field"
                  value={newUser.barangay}
                  onChange={(event) =>
                    setNewUser((prev) => ({ ...prev, barangay: event.target.value }))
                  }
                  required
                >
                  <option value="">Select barangay</option>
                  {tibiaoBarangays.map((barangay) => (
                    <option key={barangay} value={barangay}>
                      {barangay}
                    </option>
                  ))}
                </select>
              </label>
              <label className="split-grid__full">
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
              <button className="btn-primary split-grid__full" type="submit">
                Save Household
              </button>
            </form>
          </div>
        </div>
      ) : null}

    </div>
  );
}
