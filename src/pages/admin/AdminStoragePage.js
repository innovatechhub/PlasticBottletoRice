import { useMemo, useState } from "react";
import { useData } from "../../app/DataContext";

export default function AdminStoragePage() {
  const { system, users, actions } = useData();
  const householdUsers = useMemo(
    () => users.filter((u) => u.role === "user"),
    [users]
  );
  const [config, setConfig] = useState({
    kgPerBottle: system.kgPerBottle,
    maxBottleCapacity: system.maxBottleCapacity,
  });
  const [restockKg, setRestockKg] = useState(20);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const bottlePercent = Math.min(
    100,
    (system.bottleStorage / system.maxBottleCapacity) * 100
  );

  const riceStatusLabel = useMemo(() => {
    if (system.riceStock <= 0) {
      return "Out of stock";
    }
    if (system.riceStock <= 20) {
      return "Low stock";
    }
    return "Stock healthy";
  }, [system.riceStock]);

  const handleConfigSubmit = (event) => {
    event.preventDefault();
    setStatus("");
    setError("");

    const result = actions.updateSystemConfig(config);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setStatus("System configuration updated.");
  };

  const handleRestock = () => {
    setStatus("");
    setError("");

    const result = actions.restockRice(restockKg);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setStatus(`Rice restocked by ${restockKg} kg.`);
  };

  const handleClearStorage = () => {
    setStatus("");
    setError("");
    actions.clearBottleStorage();
    setStatus("Bottle storage has been cleared.");
  };

  return (
    <div className="stack">
      <section className="card">
        <h2 className="card-title">Real-time Storage Monitor</h2>

        <div className="progress-block">
          <div className="row-between">
            <p>Bottle Storage</p>
            <strong>
              {system.bottleStorage} / {system.maxBottleCapacity}
            </strong>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${bottlePercent}%` }} />
          </div>
        </div>

        <div className="split-grid">
          <div className="sub-card">
            <p>Rice Stock</p>
            <h3>{system.riceStock} kg</h3>
            <small>{riceStatusLabel}</small>
          </div>
          <div className="sub-card">
            <p>kg per Bottle</p>
            <h3>{system.kgPerBottle} kg</h3>
          </div>
          <div className="sub-card">
            <p>Exchange Rate</p>
            <h3>1 kg = 1 kg rice</h3>
          </div>
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">System Configuration</h2>
        <form className="split-grid" onSubmit={handleConfigSubmit}>
          <label>
            kg per bottle (avg bottle weight)
            <input
              className="input-field"
              type="number"
              min="0.001"
              step="0.001"
              value={config.kgPerBottle}
              onChange={(event) =>
                setConfig((prev) => ({
                  ...prev,
                  kgPerBottle: Number(event.target.value),
                }))
              }
              required
            />
          </label>
          <label>
            Max bottle capacity
            <input
              className="input-field"
              type="number"
              min="1"
              value={config.maxBottleCapacity}
              onChange={(event) =>
                setConfig((prev) => ({
                  ...prev,
                  maxBottleCapacity: Number(event.target.value),
                }))
              }
              required
            />
          </label>
          <button type="submit" className="btn-primary">
            Save Configuration
          </button>
        </form>
      </section>

      <section className="card">
        <h2 className="card-title">Hardware Bin Assignment</h2>
        <p className="muted-text">
          Assign a household user to each bin. Bottles dropped in that bin will
          credit the assigned user's kg balance automatically.
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Bin ID</th>
                <th>Assigned User</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(system.bins || {}).map(([binId, bin]) => (
                <tr key={binId}>
                  <td>
                    <code>{binId}</code>
                  </td>
                  <td>
                    <select
                      className="input-field"
                      value={bin.assignedUserId || ""}
                      onChange={(event) => {
                        const user = householdUsers.find(
                          (u) => u.id === event.target.value
                        );
                        actions.updateBinAssignment(
                          binId,
                          event.target.value,
                          user?.name || ""
                        );
                      }}
                    >
                      <option value="">— Unassigned —</option>
                      {householdUsers.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">Admin Actions</h2>
        <div className="action-row">
          <input
            className="input-field"
            type="number"
            min="1"
            value={restockKg}
            onChange={(event) => setRestockKg(Math.max(1, Number(event.target.value)))}
          />
          <button type="button" className="btn-primary" onClick={handleRestock}>
            Restock Rice
          </button>
          <button type="button" className="danger-btn" onClick={handleClearStorage}>
            Clear Bottle Storage
          </button>
        </div>
        {status ? <p className="success-text">{status}</p> : null}
        {error ? <p className="error-text">{error}</p> : null}
      </section>
    </div>
  );
}
