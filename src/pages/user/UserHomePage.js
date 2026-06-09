import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../app/AuthContext";
import { useData } from "../../app/DataContext";
import { onValue, ref } from "firebase/database";
import { realtimeDb } from "../../services/firebaseClient";
import { cancelBinCommand, writeBinCommand } from "../../services/cloudSync";

const formatDateTime = (timestamp) =>
  new Date(timestamp).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

function StatHeroCard({ icon, label, value, subtle, color }) {
  return (
    <div className={`hero-stat-card hero-stat-card--${color}`}>
      <div className="hero-stat-icon">{icon}</div>
      <div className="hero-stat-body">
        <p className="hero-stat-label">{label}</p>
        <h3 className="hero-stat-value">{value}</h3>
        {subtle && <p className="hero-stat-subtle">{subtle}</p>}
      </div>
    </div>
  );
}

function StepBadge({ step, label, active, done }) {
  return (
    <div className={`step-badge ${active ? "step-badge--active" : ""} ${done ? "step-badge--done" : ""}`}>
      <div className="step-num">{done ? "✓" : step}</div>
      <span>{label}</span>
    </div>
  );
}

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

  const [insertStep, setInsertStep] = useState("idle");
  const [selectedBinId, setSelectedBinId] = useState("");
  const [commandWeightKg, setCommandWeightKg] = useState(0);
  const [insertError, setInsertError] = useState("");
  const unsubscribeRef = useRef(null);

  useEffect(() => {
    if (availableBins.length === 1 && !selectedBinId) {
      setSelectedBinId(availableBins[0]);
    }
  }, [availableBins, selectedBinId]);

  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) unsubscribeRef.current();
    };
  }, []);

  const subscribeToCommand = (binId) => {
    if (!realtimeDb || !binId) return;
    if (unsubscribeRef.current) unsubscribeRef.current();
    unsubscribeRef.current = onValue(
      ref(realtimeDb, `bin_commands/${binId}`),
      (snap) => {
        if (!snap.exists()) return;
        const { status, weightKg } = snap.val();
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
        setInsertError("Lost connection to Firebase.");
      }
    );
  };

  const handleInsertBottle = async () => {
    if (!currentUser || !selectedBinId) return;
    setInsertError("");
    setInsertStep("waiting");
    const result = await writeBinCommand(selectedBinId, currentUser.id, currentUser.name);
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

  const firstName = currentUser?.name?.split(" ")[0] || "there";
  const balanceKg = currentUser?.weightKg ?? 0;

  return (
    <div className="stack">

      <section className="home-hero">
        <div className="home-hero-bg-blob home-hero-bg-blob--1" />
        <div className="home-hero-bg-blob home-hero-bg-blob--2" />
        <div className="home-hero-content">
          <div className="home-hero-text">
            <p className="home-hero-eyebrow">♻ Plastic Bottle to Rice</p>
            <h1 className="home-hero-title">
              Welcome back,<br />
              <span className="home-hero-name">{firstName}!</span>
            </h1>
            <p className="home-hero-sub">
              Every bottle you drop earns rice for your household. Keep recycling and make an impact in your community.
            </p>
          </div>
          <div className="home-hero-pill">
            <span className="home-hero-pill-label">Your Balance</span>
            <span className="home-hero-pill-value">{balanceKg.toFixed(3)} kg</span>
            <span className="home-hero-pill-eq">≈ {balanceKg.toFixed(3)} kg rice</span>
          </div>
        </div>
      </section>

      <section className="hero-stat-grid">
        <StatHeroCard
          color="green"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/><path d="M8 12l2 2 4-4"/></svg>}
          label="Your Balance"
          value={`${balanceKg.toFixed(3)} kg`}
          subtle="Plastic kg collected"
        />
        <StatHeroCard
          color="amber"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7z"/><path d="M3 11h18"/></svg>}
          label="Rice Stock"
          value={`${system.riceStock} kg`}
          subtle="Shared community inventory"
        />
        <StatHeroCard
          color="blue"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>}
          label="Bin Capacity"
          value={`${storagePercent.toFixed(0)}%`}
          subtle={`${system.bottleStorage} / ${system.maxBottleCapacity} bottles`}
        />
      </section>

      <section className="card insert-card">
        <div className="insert-card-header">
          <div>
            <h2 className="card-title">Insert Bottle</h2>
            <p className="muted-text" style={{marginTop: 4, fontSize: "0.875rem"}}>
              Drop a plastic bottle into a smart bin to earn points
            </p>
          </div>
          <div className="insert-steps-row">
            <StepBadge step="1" label="Select Bin" done={insertStep !== "idle"} active={insertStep === "idle"} />
            <div className="step-connector" />
            <StepBadge step="2" label="Activate" done={insertStep === "active" || insertStep === "done"} active={insertStep === "waiting"} />
            <div className="step-connector" />
            <StepBadge step="3" label="Drop Bottle" done={insertStep === "done"} active={insertStep === "active"} />
          </div>
        </div>

        {insertStep === "idle" && (
          <div className="insert-idle-body">
            <div className="bin-select-wrap">
              <label className="bin-select-label" htmlFor="bin-select">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                </svg>
                Choose a Smart Bin
              </label>
              <select id="bin-select" className="input-field" value={selectedBinId} onChange={(e) => setSelectedBinId(e.target.value)}>
                {availableBins.length === 0 && <option value="">No bins registered</option>}
                {availableBins.length > 0 && !selectedBinId && <option value="">Select bin…</option>}
                {availableBins.map((id) => <option key={id} value={id}>{id}</option>)}
              </select>
            </div>
            <button type="button" className="btn-insert-main" onClick={handleInsertBottle} disabled={!selectedBinId || !realtimeDb}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                <line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>
              </svg>
              Insert Bottle
            </button>
            {!realtimeDb && <p className="error-text" style={{fontSize: "0.85rem"}}>Firebase not configured — hardware connection unavailable.</p>}
          </div>
        )}

        {insertStep === "waiting" && (
          <div className="insert-status-block insert-status-block--waiting">
            <div className="insert-spinner" />
            <div>
              <p style={{fontWeight: 700}}>Sending command…</p>
              <p className="muted-text" style={{fontSize: "0.85rem", marginTop: 4}}>Connecting to <strong>{selectedBinId}</strong></p>
            </div>
            <button type="button" className="outline-btn" onClick={handleCancel}>Cancel</button>
          </div>
        )}

        {insertStep === "active" && (
          <div className="insert-status-block insert-status-block--active">
            <div className="insert-pulse-ring">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="24" height="24">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
              </svg>
            </div>
            <div>
              <p className="success-text" style={{fontSize: "1rem"}}>Bin <strong>{selectedBinId}</strong> is ready!</p>
              <p className="muted-text" style={{fontSize: "0.85rem", marginTop: 4}}>Drop your bottle now. Session closes in 60 seconds.</p>
            </div>
            <button type="button" className="outline-btn" onClick={handleCancel}>Cancel</button>
          </div>
        )}

        {insertStep === "done" && (
          <div className="insert-status-block insert-status-block--done">
            <div className="insert-done-icon">✓</div>
            <div>
              <p className="success-text" style={{fontSize: "1rem"}}>Bottle accepted!</p>
              <p className="muted-text" style={{fontSize: "0.85rem", marginTop: 4}}><strong>{commandWeightKg.toFixed(3)} kg</strong> credited to your balance.</p>
            </div>
            <button type="button" className="btn-primary" onClick={handleReset}>Insert Another</button>
          </div>
        )}

        {insertStep === "expired" && (
          <div className="insert-status-block insert-status-block--error">
            <div className="insert-error-icon">!</div>
            <div>
              <p className="error-text" style={{fontSize: "1rem"}}>Session expired</p>
              <p className="muted-text" style={{fontSize: "0.85rem", marginTop: 4}}>No bottle detected within 60 seconds.</p>
            </div>
            <button type="button" className="btn-primary" onClick={handleReset}>Try Again</button>
          </div>
        )}

        {insertStep === "error" && (
          <div className="insert-status-block insert-status-block--error">
            <div className="insert-error-icon">!</div>
            <div>
              <p className="error-text" style={{fontSize: "1rem"}}>Connection error</p>
              <p className="muted-text" style={{fontSize: "0.85rem", marginTop: 4}}>{insertError || "An error occurred. Check your connection."}</p>
            </div>
            <button type="button" className="btn-primary" onClick={handleReset}>Try Again</button>
          </div>
        )}
      </section>

      <section className="how-it-works-grid">
        <div className="how-card">
          <div className="how-card-icon how-card-icon--teal">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
            </svg>
          </div>
          <h4>Drop Plastic</h4>
          <p>Insert your plastic bottles into any registered smart bin nearby.</p>
        </div>
        <div className="how-card">
          <div className="how-card-icon how-card-icon--amber">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <h4>Earn Points</h4>
          <p>The bin weighs your plastic and credits kilograms to your balance automatically.</p>
        </div>
        <div className="how-card">
          <div className="how-card-icon how-card-icon--green">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
              <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
            </svg>
          </div>
          <h4>Redeem Rice</h4>
          <p>Exchange your collected kg balance for rice from the shared community stock.</p>
        </div>
      </section>

      <section className="card">
        <div className="row-between">
          <h2 className="card-title">Recent Activity</h2>
          {userTransactions.length > 0 && (
            <span className="activity-count-badge">{userTransactions.length} records</span>
          )}
        </div>
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
                    <div className="empty-activity">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="32" height="32">
                        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
                        <rect x="9" y="3" width="6" height="4" rx="1"/>
                        <line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="12" y2="16"/>
                      </svg>
                      <p>No activity yet. Insert your first bottle to get started!</p>
                    </div>
                  </td>
                </tr>
              ) : (
                userTransactions.map((item) => (
                  <tr key={item.id}>
                    <td>{formatDateTime(item.timestamp)}</td>
                    <td><span className={`badge badge-${item.type}`}>{item.type}</span></td>
                    <td>{item.details}</td>
                    <td className={item.kgDelta > 0 ? "kg-positive" : "kg-negative"}>
                      {item.kgDelta > 0 ? `+${item.kgDelta} kg` : `${item.kgDelta} kg`}
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
