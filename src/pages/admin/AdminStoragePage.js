import { useMemo } from "react";
import { useData } from "../../app/DataContext";

export default function AdminStoragePage() {
  const { system } = useData();

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
    </div>
  );
}
