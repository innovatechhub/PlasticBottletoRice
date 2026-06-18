import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onValue, ref } from "firebase/database";
import { useAuth } from "../../app/AuthContext";
import { useData } from "../../app/DataContext";
import { realtimeDb } from "../../services/firebaseClient";
import { cancelBinCommand, isBinInUse, writeBinCommand } from "../../services/cloudSync";

const SESSION_SECONDS = 60;

const formatWeight = (grams) => {
  if (grams >= 1000) return `${(grams / 1000).toFixed(2)} kg`;
  return `${grams.toFixed(2)} g`;
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

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
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
  const { transactions, actions } = useData();

  const [binModalOpen, setBinModalOpen] = useState(false);
  const [binInput, setBinInput] = useState("");
  const [binError, setBinError] = useState("");

  const [sessionOpen, setSessionOpen] = useState(false);
  const [selectedBinId, setSelectedBinId] = useState("");
  const [insertStep, setInsertStep] = useState("idle");
  const [insertError, setInsertError] = useState("");
  const [insertNotice, setInsertNotice] = useState("");
  const [timerSeconds, setTimerSeconds] = useState(SESSION_SECONDS);
  const [sessionBottles, setSessionBottles] = useState([]);
  const [sessionSaved, setSessionSaved] = useState(false);

  const unsubRef = useRef(null);
  const lastAcceptedAtRef = useRef("");
  const lastValidationAtRef = useRef("");
  const sessionInfoRef = useRef({ binId: "", userId: "", userName: "" });

  useEffect(() => {
    sessionInfoRef.current = {
      binId: selectedBinId,
      userId: currentUser?.id || "",
      userName: currentUser?.name || "",
    };
  }, [selectedBinId, currentUser]);

  useEffect(
    () => () => {
      unsubRef.current?.();
    },
    []
  );

  useEffect(() => {
    const isModalOpen = binModalOpen || sessionOpen;
    document.body.classList.toggle("portal-modal-lock", isModalOpen);
    return () => {
      document.body.classList.remove("portal-modal-lock");
    };
  }, [binModalOpen, sessionOpen]);

  useEffect(() => {
    if (!sessionOpen || insertStep !== "active") return undefined;
    const id = setInterval(() => {
      setTimerSeconds((t) => Math.max(0, t - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [sessionOpen, insertStep]);

  useEffect(() => {
    if (!sessionOpen || timerSeconds > 0 || insertStep !== "active") return;
    unsubRef.current?.();
    unsubRef.current = null;
    cancelBinCommand(sessionInfoRef.current.binId).catch(() => {});
    setInsertStep("summary");
  }, [sessionOpen, timerSeconds, insertStep]);

  const subscribeToCommand = useCallback((binId) => {
    if (!realtimeDb || !binId) return;
    unsubRef.current?.();
    unsubRef.current = onValue(
      ref(realtimeDb, `bin_commands/${binId}`),
      (snapshot) => {
        if (!snapshot.exists()) return;
        const {
          status,
          lastWeightKg,
          lastAcceptedAt,
          lastValidationStatus,
          lastValidationMessage,
          lastValidationAt,
        } = snapshot.val();

        if (status === "active") {
          setInsertStep("active");
          if (lastValidationStatus === "rejected" && lastValidationAt && lastValidationAt !== lastValidationAtRef.current) {
            setInsertNotice(lastValidationMessage || "Bottle not accepted. Please try again.");
            lastValidationAtRef.current = lastValidationAt;
          } else if (lastValidationStatus && lastValidationStatus !== "rejected") {
            setInsertNotice("");
          }

          if (lastAcceptedAt && lastAcceptedAt !== lastAcceptedAtRef.current) {
            const kg = Number(lastWeightKg || 0);
            if (kg > 0) {
              setSessionBottles((prev) => [...prev, { weightKg: kg }]);
              setTimerSeconds(SESSION_SECONDS);
            }
            lastAcceptedAtRef.current = lastAcceptedAt;
            setInsertNotice("");
          }
          return;
        }

        if (status === "waiting") {
          setInsertStep("waiting");
          return;
        }

        if (status === "expired" || status === "idle") {
          setInsertStep("summary");
          unsubRef.current?.();
          unsubRef.current = null;
        }
      },
      () => {
        setInsertStep("error");
        setInsertError("Lost connection to Firebase.");
      }
    );
  }, []);

  const handleStartInsert = async (event) => {
    event.preventDefault();
    const binId = binInput.trim();

    if (!binId) {
      setBinError("Enter a bin ID to continue.");
      return;
    }

    if (!realtimeDb) {
      setBinError("Firebase is not configured.");
      return;
    }

    setBinError("");

    const inUse = await isBinInUse(binId, currentUser.id);
    if (inUse) {
      setBinError("This bin is currently in use by another user. Please wait.");
      return;
    }

    setSelectedBinId(binId);
    setSessionBottles([]);
    lastAcceptedAtRef.current = "";
    lastValidationAtRef.current = "";
    setSessionSaved(false);
    setInsertError("");
    setInsertNotice("");
    setBinModalOpen(false);
    setSessionOpen(true);
    setInsertStep("waiting");
    setTimerSeconds(SESSION_SECONDS);

    const result = await writeBinCommand(binId, currentUser.id, currentUser.name);
    if (!result.ok) {
      setInsertStep("error");
      setInsertError(result.error || "Failed to send command to the bin.");
      return;
    }

    subscribeToCommand(binId);
  };

  const handleDone = async () => {
    unsubRef.current?.();
    unsubRef.current = null;

    if (!sessionSaved && sessionBottles.length > 0) {
      const result = actions.finalizeBottleSession(
        currentUser.id,
        sessionBottles.map((bottle) => bottle.weightKg),
        selectedBinId
      );
      if (!result.ok) {
        setInsertStep("error");
        setInsertError(result.error || "Failed to save this bottle session.");
        return;
      }
      setSessionSaved(true);
    }

    if (insertStep === "waiting" || insertStep === "active") {
      await cancelBinCommand(selectedBinId);
    }
    setInsertStep("summary");
  };

  const handleCloseSession = () => {
    if (!sessionSaved && sessionBottles.length > 0) {
      const result = actions.finalizeBottleSession(
        currentUser.id,
        sessionBottles.map((bottle) => bottle.weightKg),
        selectedBinId
      );
      if (!result.ok) {
        setInsertStep("error");
        setInsertError(result.error || "Failed to save this bottle session.");
        return;
      }
    }

    unsubRef.current?.();
    unsubRef.current = null;
    setBinInput("");
    setSelectedBinId("");
    setInsertStep("idle");
    setInsertError("");
    setBinError("");
    setTimerSeconds(SESSION_SECONDS);
    setSessionBottles([]);
    lastAcceptedAtRef.current = "";
    lastValidationAtRef.current = "";
    setSessionSaved(false);
    setSessionOpen(false);
    setInsertNotice("");
  };

  const sessionBottleCount = sessionBottles.length;
  const sessionTotalKg = sessionBottles.reduce((sum, bottle) => sum + bottle.weightKg, 0);
  const totalItemsRecycled = useMemo(() => {
    if (!currentUser) return 0;
    return transactions
      .filter((item) => item.userId === currentUser.id && item.type === "bottle")
      .reduce((sum, item) => sum + Number(item.amount || item.bottleDelta || 0), 0);
  }, [transactions, currentUser]);
  const totalWeightGrams = Number(currentUser?.weightKg || 0) * 1000;

  const firstName = currentUser?.name?.split(" ")[0] || "User";
  const minutes = String(Math.floor(timerSeconds / 60)).padStart(2, "0");
  const seconds = String(timerSeconds % 60).padStart(2, "0");

  return (
    <div className="household-home">
      <section
        className="portal-hero"
        style={{
          backgroundImage: `url(${process.env.PUBLIC_URL}/PageUI.png)`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
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
              value={totalItemsRecycled}
              note="Stored total"
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
              note="Same as your balance"
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
                setBinError("");
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
          <strong>{formatWeight(Number(currentUser?.weightKg || 0) * 1000)}</strong>
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
              onChange={(e) => setBinInput(e.target.value)}
              placeholder="e.g. bin_001"
              autoFocus
            />
            {binError ? <span className="portal-modal-error">{binError}</span> : null}
            <div className="portal-modal-actions">
              <button
                type="button"
                className="portal-modal-btn muted"
                onClick={() => {
                  setBinModalOpen(false);
                  setBinError("");
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

      {sessionOpen ? (
        <div className="portal-modal-backdrop compact">
          <div className="portal-session-modal">
            {insertStep === "summary" ? (
              <>
                <div className="portal-summary-icon">
                  <CheckIcon />
                </div>
                <h2>Session Complete</h2>
                <p className="portal-session-bin">Bin {selectedBinId}</p>

                <div className="portal-summary-big">
                  <span className="portal-summary-count">{sessionBottleCount}</span>
                  <span className="portal-summary-unit">
                    bottle{sessionBottleCount !== 1 ? "s" : ""} accepted
                  </span>
                </div>

                <dl className="portal-session-stats">
                  <div>
                    <dt>Total weight collected:</dt>
                    <dd>{formatWeight(sessionTotalKg * 1000)}</dd>
                  </div>
                  <div>
                    <dt>Credited to your account:</dt>
                    <dd>{sessionSaved ? `${sessionTotalKg.toFixed(4)} kg` : `${sessionTotalKg.toFixed(4)} kg pending save`}</dd>
                  </div>
                </dl>

                <button
                  type="button"
                  className="portal-session-done"
                  onClick={handleCloseSession}
                >
                  Close
                </button>
              </>
            ) : (
              <>
                <h2>Insert Bottle</h2>

                {insertStep === "active" ? (
                  <strong className="portal-session-timer">{`${minutes}:${seconds}`}</strong>
                ) : null}

                <p>
                  {insertStep === "waiting" ? `Activating bin ${selectedBinId}...` : null}
                  {insertStep === "active" ? `Drop bottles into bin ${selectedBinId}` : null}
                  {insertStep === "error" ? insertError || "The bin session failed." : null}
                </p>

                {insertNotice ? <span className="portal-session-validation">{insertNotice}</span> : null}

                {sessionBottleCount > 0 ? (
                  <dl className="portal-session-stats">
                    <div>
                      <dt>Bottles accepted:</dt>
                      <dd>{sessionBottleCount}</dd>
                    </div>
                    <div>
                      <dt>Weight collected:</dt>
                      <dd>{formatWeight(sessionTotalKg * 1000)}</dd>
                    </div>
                  </dl>
                ) : null}

                <button
                  type="button"
                  className="portal-session-done"
                  onClick={handleDone}
                >
                  Done and Save
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
