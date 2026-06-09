import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import { useAuth } from "../../app/AuthContext";
import { useData } from "../../app/DataContext";
import { firestoreDb } from "../../services/firebaseClient";
import { cancelBinCommand, writeBinCommand } from "../../services/cloudSync";

const activeSessionSteps = ["waiting", "active"];

const formatWeight = (grams) => {
  if (grams >= 1000) {
    return `${(grams / 1000).toFixed(2)}kg`;
  }
  return `${grams.toFixed(2)}g`;
};

function BottleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10 2h4v3l1.5 1.8V20a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2V6.8L10 5V2Z" />
      <path d="M9 10h6" />
      <path d="M9 16h6" />
    </svg>
  );
}

function GiftIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 10h16v10H4V10Z" />
      <path d="M2.8 6h18.4v4H2.8V6Z" />
      <path d="M12 6v14" />
      <path d="M12 6C9 6 8 3 9.8 2.4 11 2 12 3.6 12 6Z" />
      <path d="M12 6c3 0 4-3 2.2-3.6C13 2 12 3.6 12 6Z" />
    </svg>
  );
}

function StatTile({ icon, label, value, note, accent }) {
  return (
    <div className="portal-stat-tile">
      <span className="portal-stat-icon">{icon}</span>
      <p className="portal-stat-label">{label}</p>
      <strong className={accent ? "portal-stat-value accent" : "portal-stat-value"}>
        {value}
      </strong>
      <span className="portal-stat-note">{note}</span>
    </div>
  );
}

export default function UserHomePage() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { transactions } = useData();
  const [binModalOpen, setBinModalOpen] = useState(false);
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [binInput, setBinInput] = useState("");
  const [selectedBinId, setSelectedBinId] = useState("");
  const [insertStep, setInsertStep] = useState("idle");
  const [insertError, setInsertError] = useState("");
  const [timerSeconds, setTimerSeconds] = useState(60);
  const [commandWeightKg, setCommandWeightKg] = useState(0);
  const unsubscribeRef = useRef(null);

  const userTransactions = useMemo(() => {
    if (!currentUser) {
      return [];
    }
    return transactions.filter((item) => item.userId === currentUser.id);
  }, [transactions, currentUser]);

  const monthlyBottleItems = useMemo(() => {
    const now = new Date();
    return userTransactions
      .filter((item) => {
        const date = new Date(item.timestamp);
        return (
          item.type === "bottle" &&
          date.getMonth() === now.getMonth() &&
          date.getFullYear() === now.getFullYear()
        );
      })
      .reduce((total, item) => total + Number(item.amount || 0), 0);
  }, [userTransactions]);

  const totalWeightGrams = useMemo(
    () =>
      userTransactions
        .filter((item) => item.type === "bottle")
        .reduce((total, item) => total + Number(item.kgDelta || 0), 0) * 1000,
    [userTransactions]
  );

  const firstName = currentUser?.name?.split(" ")[0] || "User";

  useEffect(() => {
    return () => {
      unsubscribeRef.current?.();
    };
  }, []);

  useEffect(() => {
    if (!sessionModalOpen || !activeSessionSteps.includes(insertStep)) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setTimerSeconds((value) => Math.max(0, value - 1));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [sessionModalOpen, insertStep]);

  useEffect(() => {
    if (
      !sessionModalOpen ||
      timerSeconds > 0 ||
      !activeSessionSteps.includes(insertStep)
    ) {
      return;
    }

    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    setInsertStep("expired");
    if (selectedBinId) {
      cancelBinCommand(selectedBinId).catch(() => {});
    }
  }, [insertStep, selectedBinId, sessionModalOpen, timerSeconds]);

  const subscribeToCommand = (binId) => {
    if (!firestoreDb || !binId) {
      return;
    }

    unsubscribeRef.current?.();
    unsubscribeRef.current = onSnapshot(
      doc(firestoreDb, "bin_commands", binId),
      (snapshot) => {
        if (!snapshot.exists()) {
          return;
        }

        const { status, weightKg } = snapshot.data();
        if (status === "active") {
          setInsertStep("active");
          return;
        }

        if (status === "done") {
          setCommandWeightKg(Number(weightKg || 0));
          setInsertStep("done");
          unsubscribeRef.current?.();
          unsubscribeRef.current = null;
          return;
        }

        if (status === "expired") {
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

  const resetInsertFlow = () => {
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    setBinInput("");
    setSelectedBinId("");
    setInsertStep("idle");
    setInsertError("");
    setTimerSeconds(60);
    setCommandWeightKg(0);
    setSessionModalOpen(false);
  };

  const handleStartInsert = async (event) => {
    event.preventDefault();
    const binId = binInput.trim();

    if (!binId) {
      setInsertError("Enter a bin ID to continue.");
      return;
    }

    if (!firestoreDb) {
      setInsertError("Firebase is not configured, so the bin cannot be activated.");
      return;
    }

    setInsertError("");
    setSelectedBinId(binId);
    setBinModalOpen(false);
    setSessionModalOpen(true);
    setInsertStep("waiting");
    setTimerSeconds(60);

    const result = await writeBinCommand(binId, currentUser.id, currentUser.name);
    if (!result.ok) {
      setInsertStep("error");
      setInsertError(result.error || "Failed to send command to the bin.");
      return;
    }

    subscribeToCommand(binId);
  };

  const handleCancelSession = async () => {
    if (selectedBinId && activeSessionSteps.includes(insertStep)) {
      await cancelBinCommand(selectedBinId);
    }
    resetInsertFlow();
  };

  const minutes = String(Math.floor(timerSeconds / 60)).padStart(2, "0");
  const seconds = String(timerSeconds % 60).padStart(2, "0");
  const latestBottleWeight = commandWeightKg * 1000;

  return (
    <div className="household-home">
      <section className="portal-hero">
        <div className="portal-hero-overlay" />
        <div className="portal-hero-content">
          <h1>
            Welcome Back,
            <span>{firstName}!</span>
          </h1>

          <div className="portal-stat-row">
            <StatTile
              icon={<BottleIcon />}
              label="Items Recycled"
              value={monthlyBottleItems}
              note="This month"
            />
            <StatTile
              icon={
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 7h12l-1 15H7L6 7Z" />
                  <path d="M9 7V4h6v3" />
                  <path d="M10 13h4" />
                </svg>
              }
              label="Total Weight"
              value={formatWeight(totalWeightGrams)}
              note="Combined weight"
              accent
            />
          </div>

          <div className="portal-actions">
            <button
              type="button"
              className="portal-btn portal-btn-rewards"
              onClick={() => navigate("/user/redeem")}
            >
              <GiftIcon />
              View Rewards
            </button>
            <button
              type="button"
              className="portal-btn portal-btn-insert"
              onClick={() => {
                setInsertError("");
                setBinModalOpen(true);
              }}
            >
              <BottleIcon />
              Insert Bottle
            </button>
          </div>
        </div>
      </section>

      <section id="about" className="portal-section">
        <div>
          <p className="portal-section-kicker">Household portal</p>
          <h2>Track bottles, activate bins, and redeem rice from one place.</h2>
        </div>
        <div className="portal-section-card">
          <strong>{(currentUser?.weightKg ?? 0).toFixed(3)} kg</strong>
          <span>Available reward balance</span>
        </div>
      </section>

      {binModalOpen ? (
        <div className="portal-modal-backdrop">
          <form className="portal-bin-modal" onSubmit={handleStartInsert}>
            <div className="portal-modal-title">
              <BottleIcon />
              <h2>Enter Bin ID</h2>
            </div>
            <p>Enter your bin ID to start the bottle insertion session</p>
            <input
              className="portal-bin-input"
              value={binInput}
              onChange={(event) => setBinInput(event.target.value)}
              placeholder="e.g. BIN-001"
              autoFocus
            />
            {insertError ? <span className="portal-modal-error">{insertError}</span> : null}
            <div className="portal-modal-actions">
              <button
                type="button"
                className="portal-modal-btn muted"
                onClick={() => {
                  setBinModalOpen(false);
                  setInsertError("");
                }}
              >
                Cancel
              </button>
              <button type="submit" className="portal-modal-btn primary">
                Proceed
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {sessionModalOpen ? (
        <div className="portal-modal-backdrop compact">
          <div className="portal-session-modal">
            <h2>Insert Bottle</h2>
            <strong className="portal-session-timer">
              {insertStep === "done" ? "Done" : `${minutes}:${seconds}`}
            </strong>
            <p>
              {insertStep === "waiting"
                ? `Activating bin ${selectedBinId}...`
                : null}
              {insertStep === "active"
                ? `Please insert your bottle into bin ${selectedBinId}`
                : null}
              {insertStep === "done"
                ? `Bottle accepted in bin ${selectedBinId}`
                : null}
              {insertStep === "expired"
                ? "Session expired before a bottle was detected."
                : null}
              {insertStep === "error" ? insertError || "The bin session failed." : null}
            </p>
            <dl className="portal-session-stats">
              <div>
                <dt>Total bottles inserted:</dt>
                <dd>{insertStep === "done" ? "1" : "0"}</dd>
              </div>
              <div>
                <dt>Total weight:</dt>
                <dd>{formatWeight(totalWeightGrams + latestBottleWeight)}</dd>
              </div>
              <div>
                <dt>Last bottle weight:</dt>
                <dd>{formatWeight(latestBottleWeight)}</dd>
              </div>
            </dl>
            <button
              type="button"
              className="portal-session-done"
              onClick={
                activeSessionSteps.includes(insertStep)
                  ? handleCancelSession
                  : resetInsertFlow
              }
            >
              {activeSessionSteps.includes(insertStep) ? "Cancel" : "Done"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
