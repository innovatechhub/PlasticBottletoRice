import { useMemo, useState } from "react";
import { useData } from "../../app/DataContext";
import {
  AdminSection,
  EmptyRow,
  LastSeen,
  LoadErrorNotice,
  StatusBadge,
} from "../../components/admin/AdminUI";
import {
  BIN_STATES,
  BIN_STATUS_THRESHOLDS,
  binStatusSummary,
  describeComponents,
  getBinStatus,
  levelReading,
} from "../../admin/binStatus";
import useNow from "../../admin/useNow";

const COMPONENT_TONE = { ok: "good", warning: "warning", fault: "critical", nodata: "neutral" };
const COMPONENT_LABEL = { ok: "OK", warning: "Check", fault: "Fault", nodata: "No data" };

// From the hardware design. The current firmware (caspstone_project) only uses
// GPIO 4/5 (bottle scale), 13 (pusher) and 14 (rice gate).
const PIN_MAP = [
  ["Bottle pusher servo", "GPIO 13", "Pushes accepted bottles", true],
  ["Rice gate servo", "GPIO 14", "Dispenses rice", true],
  ["Bottle load cell DOUT / SCK", "GPIO 4 / 5", "HX711 bottle scale", true],
  ["Rice ultrasonic TRIG / ECHO", "GPIO 18 / 34", "Rice hopper level", false],
  ["Bottle ultrasonic TRIG / ECHO", "GPIO 19 / 35", "Bottle bin level", false],
  ["Rice load cell DOUT / SCK", "GPIO 32 / 33", "HX711 rice scale", false],
  ["Metal detector", "GPIO 25", "Inductive reject sensor", false],
];

function Level({ reading }) {
  if (!reading.available) return <span className="adm-muted">No data</span>;
  return (
    <span className="adm-level">
      <span className="adm-meter adm-meter--inline" aria-hidden="true">
        <span style={{ width: `${reading.percent}%` }} />
      </span>
      {reading.label}
      {!reading.live ? <span className="adm-muted adm-small"> last known</span> : null}
    </span>
  );
}

export default function AdminHardwarePage() {
  const { system, users, actions, syncErrors } = useData();
  const now = useNow(15000);
  const readings = system.hardwareBins || {};

  const binIds = useMemo(
    () =>
      [...new Set([...Object.keys(system.bins || {}), ...Object.keys(system.hardwareBins || {})])].sort(),
    [system.bins, system.hardwareBins]
  );
  const [selectedId, setSelectedId] = useState("");
  const binId = binIds.includes(selectedId) ? selectedId : binIds[0] || "";
  const reading = readings[binId];
  const status = getBinStatus(reading, now);
  const summary = binStatusSummary(status, binId, now);
  const components = describeComponents(reading, status);

  const residents = useMemo(() => users.filter((u) => u.role === "user"), [users]);
  const [newBinId, setNewBinId] = useState("");
  const [newBinUserId, setNewBinUserId] = useState("");
  const [binNotice, setBinNotice] = useState("");
  const [binError, setBinError] = useState("");

  const handleAddBin = (event) => {
    event.preventDefault();
    setBinNotice("");
    setBinError("");
    const assignedUser = residents.find((user) => user.id === newBinUserId);
    const result = actions.addBin(newBinId, assignedUser?.id || "", assignedUser?.name || "");
    if (!result.ok) {
      setBinError(result.error);
      return;
    }
    setBinNotice(`Bin ${newBinId.trim()} added.`);
    setNewBinId("");
    setNewBinUserId("");
  };

  return (
    <div className="adm-page">
      <LoadErrorNotice errors={syncErrors} sources={["bin_status"]} />

      <AdminSection
        title="Bins"
        description={`Status comes from each bin's latest status update: Online within ${
          BIN_STATUS_THRESHOLDS.onlineWithinMs / 60000
        } min, Delayed within ${BIN_STATUS_THRESHOLDS.delayedWithinMs / 60000} min, otherwise Offline.`}
      >
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th scope="col">Bin</th>
                <th scope="col">Location</th>
                <th scope="col">Status</th>
                <th scope="col">Last seen</th>
                <th scope="col">Rice level</th>
                <th scope="col">Bottle level</th>
                <th scope="col">Assigned to</th>
                <th scope="col">
                  <span className="adm-sr-only">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {binIds.length === 0 ? (
                <EmptyRow colSpan={8}>No bins yet. Add one below.</EmptyRow>
              ) : (
                binIds.map((id) => {
                  const binStatus = getBinStatus(readings[id], now);
                  const meta = BIN_STATES[binStatus.state];
                  return (
                    <tr key={id} className={id === binId ? "is-selected" : undefined}>
                      <td>
                        <strong>{id}</strong>
                      </td>
                      <td className="adm-muted">Not recorded</td>
                      <td>
                        <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
                      </td>
                      <td>
                        <LastSeen value={binStatus.lastSeen} now={now} />
                      </td>
                      <td>
                        <Level reading={levelReading(readings[id], "riceLevelPercent", binStatus)} />
                      </td>
                      <td>
                        <Level reading={levelReading(readings[id], "bottleLevelPercent", binStatus)} />
                      </td>
                      <td>{system.bins?.[id]?.assignedUserName || "Unassigned"}</td>
                      <td>
                        <button
                          type="button"
                          className="adm-btn adm-btn--secondary adm-btn--small"
                          aria-pressed={id === binId}
                          onClick={() => setSelectedId(id)}
                        >
                          {id === binId ? "Showing" : "Diagnose"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </AdminSection>

      {binId ? (
        <AdminSection title={`Diagnostics: ${binId}`}>
          <div className={`adm-notice adm-notice--${BIN_STATES[status.state].tone}`}>
            <StatusBadge tone={BIN_STATES[status.state].tone}>{BIN_STATES[status.state].label}</StatusBadge>{" "}
            {summary.text}
            {summary.nextStep ? <span className="adm-block adm-next-step">Next step: {summary.nextStep}</span> : null}
          </div>
          {!status.isLive && status.state !== "nodata" ? (
            <p className="adm-muted">Readings below are the last known values, not live.</p>
          ) : null}

          <ul className="adm-components">
            {components.map((item) => (
              <li key={item.key} className="adm-component">
                <div className="adm-component__head">
                  <span className="adm-component__name">{item.name}</span>
                  <StatusBadge tone={COMPONENT_TONE[item.state]}>{COMPONENT_LABEL[item.state]}</StatusBadge>
                </div>
                <p className="adm-component__summary">
                  {item.lastKnown ? <span className="adm-tag">Last known</span> : null}
                  {item.summary}
                </p>
                {item.value ? <p className="adm-muted adm-small">{item.value}</p> : null}
                {item.nextStep ? <p className="adm-next-step">Next step: {item.nextStep}</p> : null}
              </li>
            ))}
          </ul>

          <details className="adm-details">
            <summary>Technical details</summary>
            <h3 className="adm-subhead">Latest raw status ({binId})</h3>
            <pre className="adm-raw">{reading ? JSON.stringify(reading, null, 2) : "Nothing received yet."}</pre>
            <h3 className="adm-subhead">Pin map</h3>
            <p className="adm-muted adm-small">
              From the hardware design. Rows marked "Not in firmware" are not used by the current bin
              firmware.
            </p>
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th scope="col">Component</th>
                    <th scope="col">Pins</th>
                    <th scope="col">Role</th>
                    <th scope="col">Firmware</th>
                  </tr>
                </thead>
                <tbody>
                  {PIN_MAP.map(([name, pins, role, inFirmware]) => (
                    <tr key={name}>
                      <td>{name}</td>
                      <td>
                        <code>{pins}</code>
                      </td>
                      <td>{role}</td>
                      <td>{inFirmware ? "Used" : <span className="adm-muted">Not in firmware</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </AdminSection>
      ) : null}

      <AdminSection title="Add a bin" description="Registers a bin ID so residents can use it. The bin also needs its own device login.">
        <form className="adm-form adm-form--row" onSubmit={handleAddBin}>
          <label className="adm-field">
            <span>Bin ID</span>
            <input
              className="adm-input"
              value={newBinId}
              onChange={(event) => setNewBinId(event.target.value)}
              placeholder="e.g. bin_002"
              required
            />
          </label>
          <label className="adm-field">
            <span>Assign to resident (optional)</span>
            <select className="adm-input" value={newBinUserId} onChange={(event) => setNewBinUserId(event.target.value)}>
              <option value="">Unassigned</option>
              {residents.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="adm-btn adm-btn--primary">
            Add bin
          </button>
        </form>
        {binNotice ? (
          <p className="adm-notice adm-notice--good" role="status">
            {binNotice}
          </p>
        ) : null}
        {binError ? (
          <p className="adm-error" role="alert">
            {binError}
          </p>
        ) : null}
      </AdminSection>
    </div>
  );
}
