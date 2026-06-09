import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../app/AuthContext";
import { useData } from "../../app/DataContext";
import StatCard from "../../components/StatCard";
import { doc, onSnapshot } from "firebase/firestore";
import { firestoreDb } from "../../services/firebaseClient";
import { cancelBinCommand, writeBinCommand } from "../../services/cloudSync";

const formatDateTime = (timestamp) =>
  new Date(timestamp).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function UserHomePage() {
  const { currentUser } = useAuth();
  const { system, transactions } = useData();

  const userTransactions = useMemo(() => {
    if (!currentUser) return [];
    return transactions
      .filter((item) => item.userId === currentUser.id)
      .slice(0, 8);
  }, [transactions, currentUser]);

  const storagePercent = Math.min(
    100,
    (system.bottleStorage / system.maxBottleCapacity) * 100
  );

  const availableBins = useMemo(
    () => Object.keys(system.bins || {}),
    [system.bins]
  );

  // ── Hardware insert state ──────────────────────────────────────────────────
  // step: idle | waiting | active | done | expired | error
  const [insertStep, setInsertStep] = useState("idle");
  const [selectedBinId, setSelectedBinId] = useState("");
  const [commandWeightKg, setCommandWeightKg] = useState(0);
  const [insertError, setInsertError] = useState("");
  const unsubscribeRef = useRef(null);

  // Auto-select the only bin if there's just one
  useEffect(() => {
    if (availableBins.length === 1 && !selectedBinId) {
      setSelectedBinId(availableBins[0]);
    }
  }, [availableBins, selectedBinId]);

  // Cleanup Firestore listener on unmount
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) unsubscribeRef.current();
    };
  }, []);

  const subscribeToCommand = (binId) => {
    if (!firestoreDb || !binId) return;
    if (unsubscribeRef.current) unsubscribeRef.current();

    unsubscribeRef.current = onSnapshot(
      doc(firestoreDb, "bin_commands", binId),
      (snap) => {
        if (!snap.exists()) return;
        const { status, weightKg } = snap.data();

        if (status === "active") {
          setInsertStep("active");
        } else if (status === "done") {
          setCommandWeightKg(weightKg ?? 0);
          setInsertStep("done");
          unsubscribeRef.current?.();
          unsubscribeRef.current = null;
        } else if (status === "expired") {
          setInsertStep("expired");
          unsubscribeRef.current?.();
          unsubscribeRef.current = null;
        }
      },
      () => {
        setInsertStep("error");
        setInsertError("Lost connection to Firestore.");
      }
    );
  };

  const handleInsertBottle = async () => {
    if (!currentUser || !selectedBinId) return;
    setInsertError("");
    setInsertStep("waiting");

    const result = await writeBinCommand(
      selectedBinId,
      currentUser.id,
      currentUser.name
    );

    if (!result.ok) {
      setInsertStep("error");
      setInsertError(result.error || "Failed to send command to hardware.");
      return;
    }

    subscribeToCommand(selectedBinId);
  };

  const handleCancel = async () => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    if (selectedBinId) await cancelBinCommand(selectedBinId);
    setInsertStep("idle");
    setCommandWeightKg(0);
    setInsertError("");
  };

  const handleReset = () => {
    setInsertStep("idle");
    setCommandWeightKg(0);
    setInsertError("");
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="stack">
      <section className="stat-grid">
        <StatCard
          label="Your Balance"
          value={`${(currentUser?.weightKg ?? 0).toFixed(3)} kg`}
          subtle="Plastic kg collected — redeemable for rice"
        />
        <StatCard
          label="Rice Stock"
          value={`${system.riceStock} kg`}
          subtle="Shared inventory across all users"
        />
        <StatCard
          label="Bottle Storage"
          value={`${system.bottleStorage} / ${system.maxBottleCapacity}`}
          subtle={`${storagePercent.toFixed(0)}% full`}
        />
      </section>

      {/* ── Insert Bottle ───────────────────────────────────────────────── */}
      <section className="card">
        <h2 className="card-title">Insert Bottle</h2>

        {insertStep === "idle" && (
          <>
            <p className="muted-text">
              Select a bin and press <strong>Insert Bottle</strong>. The
              hardware will activate and wait for you to drop a bottle in.
              (1&nbsp;kg plastic&nbsp;=&nbsp;1&nbsp;kg rice)
            </p>
            <div className="action-row">
              <select
                className="input-field"
                value={selectedBinId}
                onChange={(e) => setSelectedBinId(e.target.value)}
              >
                {availableBins.length === 0 && (
                  <option value="">No bins registered</option>
                )}
                {availableBins.length > 0 && !selectedBinId && (
                  <option value="">Select bin…</option>
                )}
                {availableBins.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn-primary"
                onClick={handleInsertBottle}
                disabled={!selectedBinId || !firestoreDb}
              >
                Insert Bottle
              </button>
            </div>
            {!firestoreDb && (
              <p className="error-text">
                Firebase not configured — hardware connection unavailable.
              </p>
            )}
          </>
        )}

        {insertStep === "waiting" && (
          <div className="stack">
            <p className="muted-text">
              Sending command to <strong>{selectedBinId}</strong>…
            </p>
            <button type="button" className="outline-btn" onClick={handleCancel}>
              Cancel
            </button>
          </div>
        )}

        {insertStep === "active" && (
          <div className="stack">
            <p className="success-text">
              Hardware ready! Drop your bottle into{" "}
              <strong>{selectedBinId}</strong> now.{" "}
              <span className="muted-text">(60 seconds)</span>
            </p>
            <button type="button" className="outline-btn" onClick={handleCancel}>
              Cancel
            </button>
          </div>
        )}

        {insertStep === "done" && (
          <div className="stack">
            <p className="success-text">
              Bottle accepted!{" "}
              <strong>{commandWeightKg.toFixed(3)} kg</strong> has been
              credited to your balance.
            </p>
            <button
              type="button"
              className="btn-primary"
              onClick={handleReset}
            >
              Insert Another
            </button>
          </div>
        )}

        {insertStep === "expired" && (
          <div className="stack">
            <p className="error-text">
              Session expired — no bottle was detected within 60 seconds.
            </p>
            <button type="button" className="btn-primary" onClick={handleReset}>
              Try Again
            </button>
          </div>
        )}

        {insertStep === "error" && (
          <div className="stack">
            <p className="error-text">
              {insertError || "An error occurred. Check your connection."}
            </p>
            <button type="button" className="btn-primary" onClick={handleReset}>
              Try Again
            </button>
          </div>
        )}
      </section>

      {/* ── Recent Activity ─────────────────────────────────────────────── */}
      <section className="card">
        <h2 className="card-title">Recent Activity</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Type</th>
                <th>Details</th>
                <th>kg Delta</th>
              </tr>
            </thead>
            <tbody>
              {userTransactions.length === 0 ? (
                <tr>
                  <td colSpan="4" className="muted-cell">
                    No activity yet.
                  </td>
                </tr>
              ) : (
                userTransactions.map((item) => (
                  <tr key={item.id}>
                    <td>{formatDateTime(item.timestamp)}</td>
                    <td>
                      <span className={`badge badge-${item.type}`}>
                        {item.type}
                      </span>
                    </td>
                    <td>{item.details}</td>
                    <td>
                      {item.kgDelta > 0
                        ? `+${item.kgDelta} kg`
                        : `${item.kgDelta} kg`}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
