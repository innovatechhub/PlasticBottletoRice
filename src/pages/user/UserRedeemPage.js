import { useMemo, useState } from "react";
import { useAuth } from "../../app/AuthContext";
import { useData } from "../../app/DataContext";

export default function UserRedeemPage() {
  const { currentUser } = useAuth();
  const { system, actions } = useData();
  const [kgToRedeem, setKgToRedeem] = useState(0.5);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  // 1 kg plastic = 1 kg rice
  const estimatedRice = useMemo(
    () => Number(kgToRedeem || 0),
    [kgToRedeem]
  );

  const handleRedeem = (event) => {
    event.preventDefault();
    setFeedback("");
    setError("");

    if (!currentUser) {
      return;
    }

    const result = actions.redeemRice(currentUser.id, kgToRedeem);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setFeedback(`Redemption completed. You received ${result.riceKg} kg rice.`);
  };

  return (
    <div className="stack">
      <section className="card">
        <h2 className="card-title">Redeem kg for Rice</h2>
        <p className="muted-text">
          Conversion rate: <strong>1 kg plastic = 1 kg rice</strong>
        </p>
        <div className="split-grid">
          <div className="sub-card">
            <p>Your balance</p>
            <h3>{(currentUser?.weightKg ?? 0).toFixed(3)} kg</h3>
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

      <section className="card">
        <form className="stack" onSubmit={handleRedeem}>
          <label>
            kg to redeem
            <input
              className="input-field"
              type="number"
              min="0.001"
              step="0.001"
              value={kgToRedeem}
              onChange={(event) =>
                setKgToRedeem(Math.max(0.001, Number(event.target.value)))
              }
            />
          </label>
          <button type="submit" className="btn-primary">
            Redeem Now
          </button>
          {feedback ? <p className="success-text">{feedback}</p> : null}
          {error ? <p className="error-text">{error}</p> : null}
        </form>
      </section>
    </div>
  );
}
