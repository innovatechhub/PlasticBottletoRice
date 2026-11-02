import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../app/AuthContext";
import { useData } from "../../app/DataContext";
import ActivityList from "../../components/ActivityList";
import BrandMark from "../../components/BrandMark";
import RiceBowl from "../../components/RiceBowl";
import { formatKg } from "../../utils/format";
import { MIN_REDEEM_KG } from "../../utils/redeem";
import InsertBottleSession from "./InsertBottleSession";

// Phones show the first two (see resident.css); wide screens have room for all four.
const RECENT_COUNT = 4;

// Progress toward the smallest amount of rice the Redeem page offers.
function riceProgress(balanceKg, hasRedeemed) {
  if (balanceKg >= MIN_REDEEM_KG) {
    return { percent: 100, text: "Ready to redeem", ready: true };
  }
  return {
    percent: (balanceKg / MIN_REDEEM_KG) * 100,
    text: `${formatKg(MIN_REDEEM_KG - balanceKg)} to your ${hasRedeemed ? "next" : "first"} rice`,
    ready: false,
  };
}

export default function UserHomePage() {
  const { currentUser } = useAuth();
  const { transactions, system, actions } = useData();

  const availableBins = useMemo(() => Object.keys(system.bins || {}), [system.bins]);

  const [binModalOpen, setBinModalOpen] = useState(false);
  const [binInput, setBinInput] = useState("");
  const [binError, setBinError] = useState("");
  const [startError, setStartError] = useState("");
  const [sessionBinId, setSessionBinId] = useState("");

  useEffect(() => {
    const isModalOpen = binModalOpen || Boolean(sessionBinId);
    document.body.classList.toggle("portal-modal-lock", isModalOpen);
    return () => {
      document.body.classList.remove("portal-modal-lock");
    };
  }, [binModalOpen, sessionBinId]);

  const openSession = (binId) => {
    setBinModalOpen(false);
    setBinError("");
    setStartError("");
    setSessionBinId(binId);
  };

  const handleInsertBottleClick = () => {
    if (sessionBinId) return;
    if (availableBins.length === 0) {
      setStartError("No bins are set up yet. Ask the barangay admin to add one.");
      return;
    }
    if (availableBins.length === 1) {
      openSession(availableBins[0]);
      return;
    }
    setBinError("");
    setBinModalOpen(true);
  };

  const handleBinSubmit = (event) => {
    event.preventDefault();
    const binId = binInput.trim();
    if (!binId) {
      setBinError("Enter the bin ID shown on the bin.");
      return;
    }
    if (!availableBins.includes(binId)) {
      setBinError(`There is no bin called ${binId}. Check the ID on the bin.`);
      return;
    }
    openSession(binId);
  };

  const finalizeSession = useCallback(
    (weightsKg) => actions.finalizeBottleSession(currentUser.id, weightsKg, sessionBinId),
    [actions, currentUser, sessionBinId]
  );

  const closeSession = useCallback(() => {
    setSessionBinId("");
    setBinInput("");
  }, []);

  // Newest first, as stored.
  const myTransactions = useMemo(
    () => (currentUser ? transactions.filter((item) => item.userId === currentUser.id) : []),
    [transactions, currentUser]
  );

  const bottlesRecycled = useMemo(
    () =>
      myTransactions
        .filter((item) => item.type === "bottle")
        .reduce((sum, item) => sum + Number(item.amount || item.bottleDelta || 0), 0),
    [myTransactions]
  );

  const recycledKg = useMemo(
    () =>
      myTransactions
        .filter((item) => item.type === "bottle")
        .reduce((sum, item) => sum + Math.max(0, Number(item.kgDelta) || 0), 0),
    [myTransactions]
  );

  const redeemed = myTransactions.filter(
    (item) => item.type === "redeem" && item.status !== "declined"
  );
  const hasRedeemed = redeemed.length > 0;
  const riceKg = redeemed.reduce(
    (sum, item) => sum + Math.abs(Number(item.riceDeltaKg) || Number(item.kgDelta) || 0),
    0
  );
  const recent = myTransactions.slice(0, RECENT_COUNT);

  const balanceKg = Number(currentUser?.weightKg || 0);
  const progress = riceProgress(balanceKg, hasRedeemed);
  const firstName = currentUser?.name?.split(" ")[0] || "";
  const isNew = myTransactions.length === 0 && balanceKg === 0;

  return (
    <div className="eco-home">
      <div className="eco-home__inner">
        <div className="eco-home__top">
          <h1 className="eco-home__greeting">{firstName ? `Hi, ${firstName}` : "Hi"}</h1>
          <BrandMark size={26} className="eco-brand-mark eco-home__mark" />
        </div>

        <section className="eco-balance" aria-labelledby="balance-label">
          <p id="balance-label" className="eco-balance__label">
            Your balance
          </p>
          <p className="eco-balance__value">{formatKg(balanceKg)}</p>

          <RiceBowl
            percent={progress.percent}
            full={progress.ready}
            label={`Progress to ${formatKg(MIN_REDEEM_KG)} of rice`}
            valueText={progress.text}
          />

          {progress.ready ? (
            <Link className="eco-btn eco-btn--dark eco-btn--block eco-balance__cta" to="/user/redeem">
              Redeem rice
            </Link>
          ) : (
            <p className="eco-balance__next">{progress.text}</p>
          )}

          <button
            type="button"
            className="eco-btn eco-btn--primary eco-btn--large eco-btn--block eco-balance__insert"
            onClick={handleInsertBottleClick}
            disabled={Boolean(sessionBinId)}
          >
            Insert Bottle
          </button>
        </section>

        {startError ? (
          <p className="eco-inline-error" role="alert">
            {startError}
          </p>
        ) : null}

        <div className="eco-home__side">
          {isNew ? (
            <ol className="eco-steps" aria-label="How it works">
              <li>Collect</li>
              <li>Insert</li>
              <li>Get rice</li>
            </ol>
          ) : (
            <>
              <dl className="eco-stats" aria-label="Your recycling">
                <div>
                  <dt>Bottles</dt>
                  <dd>{bottlesRecycled}</dd>
                </div>
                <div>
                  <dt>Recycled</dt>
                  <dd>{formatKg(recycledKg)}</dd>
                </div>
                <div>
                  <dt>Rice earned</dt>
                  <dd>{formatKg(riceKg)}</dd>
                </div>
              </dl>

              <section className="eco-section" aria-labelledby="recent-heading">
                <div className="eco-section__head">
                  <h2 id="recent-heading" className="eco-section__title">
                    Recent
                  </h2>
                  <Link className="eco-text-btn" to="/user/history" aria-label="See all activity">
                    See all
                  </Link>
                </div>
                <ActivityList items={recent} label="Recent activity" />
              </section>
            </>
          )}
        </div>
      </div>

      {binModalOpen ? (
        <div className="eco-sheet-backdrop">
          <form
            className="eco-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="bin-modal-title"
            onSubmit={handleBinSubmit}
          >
            <h2 id="bin-modal-title" className="eco-sheet__title">
              Which bin are you at?
            </h2>
            <label className="eco-field">
              <span>Bin ID</span>
              <input
                className="eco-field__input"
                value={binInput}
                onChange={(e) => setBinInput(e.target.value)}
                placeholder="e.g. bin_001"
                autoComplete="off"
                autoFocus
              />
            </label>
            {binError ? (
              <p className="eco-inline-error" role="alert">
                {binError}
              </p>
            ) : null}
            <div className="eco-sheet__actions">
              <button type="submit" className="eco-btn eco-btn--primary">
                Connect to bin
              </button>
              <button
                type="button"
                className="eco-btn eco-btn--secondary"
                onClick={() => {
                  setBinModalOpen(false);
                  setBinError("");
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {sessionBinId && currentUser ? (
        <InsertBottleSession
          binId={sessionBinId}
          user={currentUser}
          onFinalize={finalizeSession}
          onClose={closeSession}
        />
      ) : null}
    </div>
  );
}
