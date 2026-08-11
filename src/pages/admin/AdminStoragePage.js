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
  const hardwareBins = system.hardwareBins || {};
  const primaryBinId = Object.keys(hardwareBins)[0] || "bin_001";
  const liveBin = hardwareBins[primaryBinId] || null;
  const liveRicePercent = Number(liveBin?.riceLevelPercent);
  const liveBottlePercent = Number(liveBin?.bottleLevelPercent);
  const liveRiceScaleWeightG = Number(liveBin?.riceScaleWeightG);
  const liveMetalDetected = liveBin?.inductiveMetalDetected;
  const hasLiveRice = Number.isFinite(liveRicePercent) && liveRicePercent >= 0;
  const hasLiveBottle = Number.isFinite(liveBottlePercent) && liveBottlePercent >= 0;
  const hasLiveRiceScale =
    Number.isFinite(liveRiceScaleWeightG) && liveRiceScaleWeightG >= 0;

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
            <p>Rice Hopper Level {liveBin ? `(${primaryBinId})` : ""}</p>
            <strong>
              {hasLiveRice ? `${liveRicePercent.toFixed(0)}%` : "No live sensor data"}
            </strong>
          </div>
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${hasLiveRice ? Math.min(100, Math.max(0, liveRicePercent)) : 0}%` }}
            />
          </div>
          <small>
            {Number.isFinite(Number(liveBin?.riceDistanceCm)) &&
            Number(liveBin?.riceDistanceCm) >= 0
              ? `Measured distance: ${Number(liveBin.riceDistanceCm).toFixed(1)} cm`
              : "Waiting for ESP32 ultrasonic updates."}
          </small>
        </div>

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
          <small>
            {hasLiveBottle
              ? `Ultrasonic fill level: ${liveBottlePercent.toFixed(0)}% (${Number(
                  liveBin?.bottleDistanceCm ?? 0
                ).toFixed(1)} cm)`
              : "Logical bottle count from app transactions."}
          </small>
        </div>

        <div className="progress-block">
          <div className="row-between">
            <p>Bottle Bin Fill Level {liveBin ? `(${primaryBinId})` : ""}</p>
            <strong>
              {hasLiveBottle ? `${liveBottlePercent.toFixed(0)}%` : "No live sensor data"}
            </strong>
          </div>
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${hasLiveBottle ? Math.min(100, Math.max(0, liveBottlePercent)) : 0}%` }}
            />
          </div>
          <small>
            {Number.isFinite(Number(liveBin?.bottleDistanceCm)) &&
            Number(liveBin?.bottleDistanceCm) >= 0
              ? `Measured distance: ${Number(liveBin.bottleDistanceCm).toFixed(1)} cm`
              : "Waiting for ESP32 ultrasonic updates."}
          </small>
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
          <div className="sub-card">
            <p>Metal Detector</p>
            <h3>
              {typeof liveMetalDetected === "boolean"
                ? liveMetalDetected
                  ? "Metal detected"
                  : "Clear"
                : "No live data"}
            </h3>
            <small>Input reject sensor on {primaryBinId}</small>
          </div>
          <div className="sub-card">
            <p>Rice Reward Scale</p>
            <h3>{hasLiveRiceScale ? `${liveRiceScaleWeightG.toFixed(1)} g` : "No live data"}</h3>
            <small>Live weight on the rice dispensing tray</small>
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
