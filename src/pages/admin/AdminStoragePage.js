import { useMemo, useState } from "react";
import { useData } from "../../app/DataContext";

export default function AdminStoragePage() {
  const { system } = useData();
  const [config, setConfig] = useState({
    kgPerBottle: system.kgPerBottle,
    maxBottleCapacity: system.maxBottleCapacity,
  });
  const [status, setStatus] = useState("");

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
    setStatus("System configuration updated.");
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
        {status ? <p className="success-text">{status}</p> : null}
      </section>
    </div>
  );
}
