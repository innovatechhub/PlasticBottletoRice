import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../app/AuthContext";
import { useData } from "../../app/DataContext";
import { onValue, ref } from "firebase/database";
import { realtimeDb } from "../../services/firebaseClient";
import { writeRiceCommand } from "../../services/cloudSync";

const formatWeight = (grams) => {
  if (grams >= 1000) return `${(grams / 1000).toFixed(2)} kg`;
  return `${grams.toFixed(2)} g`;
};

export default function UserRedeemPage() {
  const { currentUser } = useAuth();
  const { system, actions } = useData();

  const [kgToRedeem, setKgToRedeem] = useState(0.5);
  const [selectedBinId, setSelectedBinId] = useState("");
  const [error, setError] = useState("");

  // dispenseStep: idle | dispensing | done | error
  const [dispenseStep, setDispenseStep] = useState("idle");
  const [dispensedKg, setDispensedKg] = useState(0);

  const unsubscribeRef = useRef(null);

  const estimatedRice = useMemo(() => Number(kgToRedeem || 0), [kgToRedeem]);
  const redeemOptions = [
    { value: 0.5, label: "500 grams" },
    { value: 1, label: "1000 grams" },
  ];

  const availableBins = useMemo(
    () => Object.keys(system.bins || {}),
    [system.bins]
  );

  // Auto-select the only bin
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

  const subscribeToRiceCommand = (binId) => {
    if (!realtimeDb || !binId) return;
    if (unsubscribeRef.current) unsubscribeRef.current();

    unsubscribeRef.current = onValue(
      ref(realtimeDb, `rice_commands/${binId}`),
      (snap) => {
        if (!snap.exists()) return;
        if (snap.val().status === "done") {
          setDispenseStep("done");
          unsubscribeRef.current?.();
          unsubscribeRef.current = null;
        }
      },
      () => setDispenseStep("error")
    );
  };

  const handleRedeem = async (event) => {
    event.preventDefault();
    setError("");

    if (!currentUser) return;

    const result = actions.redeemRice(currentUser.id, kgToRedeem);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setDispensedKg(result.riceKg);

    // Trigger the hardware rice dispenser
    if (selectedBinId && realtimeDb) {
      setDispenseStep("dispensing");
      const cmdResult = await writeRiceCommand(
        selectedBinId,
        currentUser.id,
        currentUser.name,
        result.riceKg
      );
      if (cmdResult.ok) {
        subscribeToRiceCommand(selectedBinId);
      } else {
        setDispenseStep("error");
      }
    } else {
      // No bin / no Firebase — still record redemption, just no hardware trigger
      setDispenseStep("done");
    }
  };

  const handleReset = () => {
    setDispenseStep("idle");
    setDispensedKg(0);
    setError("");
  };

  return (
    <div className="stack">
      {/* ── Balance summary ─────────────────────────────────────────────── */}
      <section className="card">
        <h2 className="card-title">Redeem kg for Rice</h2>
        <p className="muted-text">
          Conversion rate: <strong>1 kg plastic = 1 kg rice</strong>
        </p>
        <div className="split-grid">
          <div className="sub-card">
            <p>Your balance</p>
            <h3>{formatWeight(Number(currentUser?.weightKg || 0) * 1000)}</h3>
          </div>
          <div className="sub-card">
            <p>Available rice stock</p>
            <h3>{system.riceStock} kg</h3>
          </div>
          <div className="sub-card">
            <p>Rice you will receive</p>
            <h3>{estimatedRice.toFixed(3)} kg</h3>
          </div>
        </div>
      </section>

      {/* ── Redeem form / status ─────────────────────────────────────────── */}
      <section className="card">
        {dispenseStep === "idle" && (
          <form className="stack" onSubmit={handleRedeem}>
            <label>
              Dispenser bin
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
            </label>

            <label>
              Amount to redeem
              <select
                className="input-field"
                value={kgToRedeem}
                onChange={(e) =>
                  setKgToRedeem(Number(e.target.value))
                }
              >
                {redeemOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <button type="submit" className="btn-primary">
              Redeem Now
            </button>

            {error ? <p className="error-text">{error}</p> : null}
          </form>
        )}

        {dispenseStep === "dispensing" && (
          <div className="stack">
            <p className="success-text">
              Redemption recorded!{" "}
              <strong>{dispensedKg.toFixed(3)} kg</strong> of rice is being
              dispensed by <strong>{selectedBinId}</strong>.
            </p>
            <p className="muted-text">
              Please wait — the dispenser is opening now…
            </p>
          </div>
        )}

        {dispenseStep === "done" && (
          <div className="stack">
            <p className="success-text">
              Done! You received{" "}
              <strong>{dispensedKg.toFixed(3)} kg</strong> of rice.
            </p>
            <button type="button" className="btn-primary" onClick={handleReset}>
              Redeem More
            </button>
          </div>
        )}

        {dispenseStep === "error" && (
          <div className="stack">
            <p className="success-text">
              Redemption recorded — <strong>{dispensedKg.toFixed(3)} kg</strong>{" "}
              deducted from your balance.
            </p>
            <p className="error-text">
              Could not reach the rice dispenser. Please collect your rice
              manually from the bin.
            </p>
            <button type="button" className="btn-primary" onClick={handleReset}>
              Done
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
