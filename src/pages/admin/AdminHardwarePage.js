import { useMemo } from "react";
import { useData } from "../../app/DataContext";

const formatSignedNumber = (value, digits = 1, suffix = "") => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return "No live data";
  }
  return `${parsed.toFixed(digits)}${suffix}`;
};

const formatPositiveNumber = (value, digits = 1, suffix = "") => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return "No live data";
  }
  return `${parsed.toFixed(digits)}${suffix}`;
};

function ReadingCard({ label, value, note }) {
  return (
    <div className="sub-card">
      <p>{label}</p>
      <h3>{value}</h3>
      <small>{note}</small>
    </div>
  );
}

function statusTextForDistance(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return "Timeout or invalid echo received.";
  }
  return "Sensor is responding.";
}

export default function AdminHardwarePage() {
  const { system } = useData();

  const hardwareBins = system.hardwareBins || {};
  const binIds = Object.keys(hardwareBins);
  const primaryBinId = binIds[0] || "bin_001";
  const liveBin = hardwareBins[primaryBinId] || null;

  const updatedAtLabel = useMemo(() => {
    const updatedAt = liveBin?.updatedAt;
    if (!updatedAt) return "Waiting for ESP32 updates.";
    const parsed = new Date(updatedAt);
    if (Number.isNaN(parsed.getTime())) return "Waiting for ESP32 updates.";
    return `Last update: ${parsed.toLocaleString()}`;
  }, [liveBin]);

  return (
    <div className="stack">
      <section className="card">
        <h2 className="card-title">All Hardware Components</h2>
        <p className="muted-text">
          Live values coming from <strong>{primaryBinId}</strong> through Firebase
          <code> bin_status</code>.
        </p>
        <p className="muted-text">{updatedAtLabel}</p>

        <div className="split-grid">
          <ReadingCard
            label="Bottle Pusher Servo"
            value={`${liveBin?.pusherServoState || "No live data"}${
              Number.isFinite(Number(liveBin?.pusherServoAngle))
                ? ` (${Number(liveBin.pusherServoAngle).toFixed(0)} deg)`
                : ""
            }`}
            note="Servo on GPIO 13"
          />
          <ReadingCard
            label="Rice Gate Servo"
            value={`${liveBin?.riceServoState || "No live data"}${
              Number.isFinite(Number(liveBin?.riceServoAngle))
                ? ` (${Number(liveBin.riceServoAngle).toFixed(0)} deg)`
                : ""
            }`}
            note="Servo on GPIO 14"
          />
          <ReadingCard
            label="Bottle Load Cell"
            value={formatSignedNumber(liveBin?.bottleScaleWeightG, 1, " g")}
            note="HX711 bottle weight on GPIO 4/5"
          />
          <ReadingCard
            label="Rice Reward Scale"
            value={formatSignedNumber(liveBin?.riceScaleWeightG, 1, " g")}
            note="HX711 rice tray weight on GPIO 32/33"
          />
          <ReadingCard
            label="Rice Ultrasonic Distance"
            value={formatPositiveNumber(liveBin?.riceDistanceCm, 1, " cm")}
            note="Ultrasonic distance from GPIO 18/34"
          />
          <ReadingCard
            label="Rice Ultrasonic Level"
            value={formatPositiveNumber(liveBin?.riceLevelPercent, 0, "%")}
            note="Computed rice hopper fill percentage"
          />
          <ReadingCard
            label="Bottle Ultrasonic Distance"
            value={formatPositiveNumber(liveBin?.bottleDistanceCm, 1, " cm")}
            note="Ultrasonic distance from GPIO 19/35"
          />
          <ReadingCard
            label="Bottle Ultrasonic Level"
            value={formatPositiveNumber(liveBin?.bottleLevelPercent, 0, "%")}
            note="Computed bottle bin fill percentage"
          />
          <ReadingCard
            label="Metal Detector"
            value={
              typeof liveBin?.inductiveMetalDetected === "boolean"
                ? liveBin.inductiveMetalDetected
                  ? "Metal detected"
                  : "Idle"
                : "No live data"
            }
            note="Inductive sensor on GPIO 25"
          />
          <ReadingCard
            label="Wi-Fi Link"
            value={
              typeof liveBin?.wifiConnected === "boolean"
                ? liveBin.wifiConnected
                  ? "Connected"
                  : "Disconnected"
                : "No live data"
            }
            note="ESP32 connectivity state"
          />
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">Hardware Status Summary</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Component</th>
                <th>Value</th>
                <th>Meaning</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Bottle pusher servo</td>
                <td>
                  {liveBin?.pusherServoState || "No live data"}
                  {Number.isFinite(Number(liveBin?.pusherServoAngle))
                    ? ` (${Number(liveBin.pusherServoAngle).toFixed(0)} deg)`
                    : ""}
                </td>
                <td>Pushes accepted bottles into storage.</td>
              </tr>
              <tr>
                <td>Rice gate servo</td>
                <td>
                  {liveBin?.riceServoState || "No live data"}
                  {Number.isFinite(Number(liveBin?.riceServoAngle))
                    ? ` (${Number(liveBin.riceServoAngle).toFixed(0)} deg)`
                    : ""}
                </td>
                <td>Opens and closes the rice dispensing gate.</td>
              </tr>
              <tr>
                <td>Bottle load cell</td>
                <td>{formatSignedNumber(liveBin?.bottleScaleWeightG, 1, " g")}</td>
                <td>Measures incoming bottle weight.</td>
              </tr>
              <tr>
                <td>Rice reward scale</td>
                <td>{formatSignedNumber(liveBin?.riceScaleWeightG, 1, " g")}</td>
                <td>Measures dispensed rice on the tray.</td>
              </tr>
              <tr>
                <td>Rice ultrasonic</td>
                <td>{formatPositiveNumber(liveBin?.riceDistanceCm, 1, " cm")}</td>
                <td>{statusTextForDistance(liveBin?.riceDistanceCm)}</td>
              </tr>
              <tr>
                <td>Bottle ultrasonic</td>
                <td>{formatPositiveNumber(liveBin?.bottleDistanceCm, 1, " cm")}</td>
                <td>{statusTextForDistance(liveBin?.bottleDistanceCm)}</td>
              </tr>
              <tr>
                <td>Metal detector</td>
                <td>
                  {typeof liveBin?.inductiveMetalDetected === "boolean"
                    ? liveBin.inductiveMetalDetected
                      ? "Triggered"
                      : "Idle"
                    : "No live data"}
                </td>
                <td>Rejects bottles when metal is detected.</td>
              </tr>
              <tr>
                <td>Wi-Fi</td>
                <td>
                  {typeof liveBin?.wifiConnected === "boolean"
                    ? liveBin.wifiConnected
                      ? "Connected"
                      : "Disconnected"
                    : "No live data"}
                </td>
                <td>Shows whether the ESP32 is online and publishing.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">Pin Map</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Component</th>
                <th>Pin</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Bottle pusher servo</td>
                <td>GPIO 13</td>
                <td>Pushes accepted bottles</td>
              </tr>
              <tr>
                <td>Rice gate servo</td>
                <td>GPIO 14</td>
                <td>Dispenses rice rewards</td>
              </tr>
              <tr>
                <td>Rice ultrasonic TRIG</td>
                <td>GPIO 18</td>
                <td>Rice hopper trigger</td>
              </tr>
              <tr>
                <td>Rice ultrasonic ECHO</td>
                <td>GPIO 34</td>
                <td>Rice hopper echo input</td>
              </tr>
              <tr>
                <td>Bottle ultrasonic TRIG</td>
                <td>GPIO 19</td>
                <td>Bottle bin trigger</td>
              </tr>
              <tr>
                <td>Bottle ultrasonic ECHO</td>
                <td>GPIO 35</td>
                <td>Bottle bin echo input</td>
              </tr>
              <tr>
                <td>Bottle load cell DOUT</td>
                <td>GPIO 4</td>
                <td>HX711 bottle scale data</td>
              </tr>
              <tr>
                <td>Bottle load cell SCK</td>
                <td>GPIO 5</td>
                <td>HX711 bottle scale clock</td>
              </tr>
              <tr>
                <td>Rice load cell DOUT</td>
                <td>GPIO 32</td>
                <td>HX711 rice scale data</td>
              </tr>
              <tr>
                <td>Rice load cell SCK</td>
                <td>GPIO 33</td>
                <td>HX711 rice scale clock</td>
              </tr>
              <tr>
                <td>Metal detector</td>
                <td>GPIO 25</td>
                <td>Inductive reject sensor input</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
