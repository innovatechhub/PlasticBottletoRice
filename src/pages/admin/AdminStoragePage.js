import { useMemo } from "react";
import { useData } from "../../app/DataContext";
import { AdminSection, EmptyRow, LastSeen, LoadErrorNotice, StatusBadge } from "../../components/admin/AdminUI";
import { LOW_RICE_KG, STORAGE_WARNING_RATIO } from "../../admin/alerts";
import { BIN_STATES, getBinStatus, levelReading } from "../../admin/binStatus";
import useNow from "../../admin/useNow";
import { formatKg } from "../../utils/format";

function SensorLevel({ reading }) {
  if (!reading.available) return <span className="adm-muted">No data</span>;
  return (
    <span className="adm-level">
      <span className="adm-meter adm-meter--inline" aria-hidden="true">
        <span style={{ width: `${reading.percent}%` }} />
      </span>
      {reading.label}{" "}
      {reading.live ? <StatusBadge tone="good">Live</StatusBadge> : <span className="adm-tag">Last known</span>}
    </span>
  );
}

export default function AdminStoragePage() {
  const { system, syncErrors } = useData();
  const now = useNow(15000);

  const rice = Number(system.riceStock) || 0;
  const capacity = Number(system.maxBottleCapacity) || 0;
  const stored = Number(system.bottleStorage) || 0;
  const ratio = capacity > 0 ? stored / capacity : 0;

  const riceState =
    rice <= 0
      ? { tone: "critical", label: "Out of stock", note: "Residents can't redeem until rice is restocked." }
      : rice <= LOW_RICE_KG
        ? { tone: "warning", label: "Low stock", note: `At or below ${formatKg(LOW_RICE_KG)}.` }
        : { tone: "good", label: "In stock", note: "Available for redemptions." };

  const storageState =
    ratio >= 1
      ? { tone: "critical", label: "Full" }
      : ratio >= STORAGE_WARNING_RATIO
        ? { tone: "warning", label: "Nearly full" }
        : { tone: "good", label: "Has room" };

  const readings = system.hardwareBins || {};
  const binIds = useMemo(
    () =>
      [...new Set([...Object.keys(system.bins || {}), ...Object.keys(system.hardwareBins || {})])].sort(),
    [system.bins, system.hardwareBins]
  );

  return (
    <div className="adm-page">
      <LoadErrorNotice errors={syncErrors} sources={["bin_status"]} />

      <div className="adm-two-col">
        <AdminSection title="Rice stock" description="Recorded amount for all bins. Goes down with each redemption.">
          <div className={`adm-big-stat adm-big-stat--${riceState.tone}`}>
            <p className="adm-big-stat__value">{rice <= 0 ? "Out of stock" : formatKg(rice)}</p>
            {rice > 0 ? <StatusBadge tone={riceState.tone}>{riceState.label}</StatusBadge> : null}
            <p className="adm-muted">{riceState.note}</p>
          </div>
          <p className="adm-muted adm-small">
            Not measured by a sensor. Restocks can't be recorded from the app yet.
          </p>
        </AdminSection>

        <AdminSection
          title="Bottle storage"
          description="Estimated: counted from saved bottles, not measured by a sensor."
        >
          <div className={`adm-big-stat adm-big-stat--${storageState.tone}`}>
            <p className="adm-big-stat__value">
              About {stored} <span className="adm-big-stat__unit">of {capacity} bottles</span>
            </p>
            <div className="adm-meter" aria-hidden="true">
              <span style={{ width: `${Math.min(100, ratio * 100)}%` }} />
            </div>
            <StatusBadge tone={storageState.tone}>{storageState.label}</StatusBadge>
          </div>
          <p className="adm-muted adm-small">
            Emptying the bottle bin can't be recorded from the app yet, so this count only goes up.
          </p>
        </AdminSection>
      </div>

      <AdminSection
        title="Sensor readings"
        description="Measured by each bin's level sensors. Shown as Live only while the bin is online."
      >
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th scope="col">Bin</th>
                <th scope="col">Status</th>
                <th scope="col">Rice hopper</th>
                <th scope="col">Bottle bin</th>
                <th scope="col">Last seen</th>
              </tr>
            </thead>
            <tbody>
              {binIds.length === 0 ? (
                <EmptyRow colSpan={5}>No bins yet.</EmptyRow>
              ) : (
                binIds.map((id) => {
                  const status = getBinStatus(readings[id], now);
                  const meta = BIN_STATES[status.state];
                  return (
                    <tr key={id}>
                      <td>
                        <strong>{id}</strong>
                      </td>
                      <td>
                        <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
                      </td>
                      <td>
                        <SensorLevel reading={levelReading(readings[id], "riceLevelPercent", status)} />
                      </td>
                      <td>
                        <SensorLevel reading={levelReading(readings[id], "bottleLevelPercent", status)} />
                      </td>
                      <td>
                        <LastSeen value={status.lastSeen} now={now} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </AdminSection>
    </div>
  );
}
