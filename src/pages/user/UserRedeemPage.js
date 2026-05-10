import { useMemo, useState } from "react";
import { useAuth } from "../../app/AuthContext";
import { useData } from "../../app/DataContext";

export default function UserRedeemPage() {
  const { currentUser } = useAuth();
  const { system, actions } = useData();
  const [pointsToRedeem, setPointsToRedeem] = useState(10);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  const estimatedRice = useMemo(
    () => Number(pointsToRedeem || 0) * system.ricePerPoint,
    [pointsToRedeem, system.ricePerPoint]
  );

  const handleRedeem = (event) => {
    event.preventDefault();
    setFeedback("");
    setError("");

    if (!currentUser) {
      return;
    }

    const result = actions.redeemRice(currentUser.id, pointsToRedeem);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setFeedback(`Redemption completed. You received ${result.riceKg} kg rice.`);
  };

  return (
    <div className="stack">
      <section className="card">
        <h2 className="card-title">Redeem Points to Rice</h2>
        <p className="muted-text">
          Conversion rate: <strong>1 point = {system.ricePerPoint} kg rice</strong>
        </p>
        <div className="split-grid">
          <div className="sub-card">
            <p>Available points</p>
            <h3>{currentUser?.points ?? 0}</h3>
          </div>
          <div className="sub-card">
            <p>Available rice stock</p>
            <h3>{system.riceStock} kg</h3>
          </div>
          <div className="sub-card">
            <p>Estimated rice output</p>
            <h3>{estimatedRice.toFixed(2)} kg</h3>
          </div>
        </div>
      </section>

      <section className="card">
        <form className="stack" onSubmit={handleRedeem}>
          <label>
            Points to redeem
            <input
              className="input-field"
              type="number"
              min="1"
              value={pointsToRedeem}
              onChange={(event) =>
                setPointsToRedeem(Math.max(1, Number(event.target.value)))
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
