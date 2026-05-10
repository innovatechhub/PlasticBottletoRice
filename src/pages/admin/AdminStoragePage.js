import { useMemo, useState } from "react";
import { useData } from "../../app/DataContext";

export default function AdminStoragePage() {
  const { system, actions } = useData();
  const [config, setConfig] = useState({
    pointsPerBottle: system.pointsPerBottle,
    ricePerPoint: system.ricePerPoint,
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
            <p>Points per Bottle</p>
            <h3>{system.pointsPerBottle}</h3>
          </div>
          <div className="sub-card">
            <p>Rice per Point</p>
            <h3>{system.ricePerPoint} kg</h3>
          </div>
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">System Configuration</h2>
        <form className="split-grid" onSubmit={handleConfigSubmit}>
          <label>
            Points per bottle
            <input
              className="input-field"
              type="number"
              min="1"
              value={config.pointsPerBottle}
              onChange={(event) =>
                setConfig((prev) => ({
                  ...prev,
                  pointsPerBottle: Number(event.target.value),
                }))
              }
              required
            />
          </label>
          <label>
            Rice per point (kg)
            <input
              className="input-field"
              type="number"
              min="0.01"
              step="0.01"
              value={config.ricePerPoint}
              onChange={(event) =>
                setConfig((prev) => ({
                  ...prev,
                  ricePerPoint: Number(event.target.value),
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
