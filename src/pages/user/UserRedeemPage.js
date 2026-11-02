import { useEffect, useMemo, useRef, useState } from "react";
import { onValue, ref } from "firebase/database";
import { useAuth } from "../../app/AuthContext";
import { useData } from "../../app/DataContext";
import Sheet from "../../components/Sheet";
import { realtimeDb } from "../../services/firebaseClient";
import { writeRiceCommand } from "../../services/cloudSync";
import { formatBinName, formatKg } from "../../utils/format";
import { MIN_REDEEM_KG, REDEEM_OPTIONS_KG } from "../../utils/redeem";

// The bin checks for rice commands about every 5 s and opens the gate for up to 20 s.
const DISPENSE_TIMEOUT_MS = 60000;

function blockReason(amountKg, balanceKg, riceStockKg) {
  if (riceStockKg <= 0) {
    return "Out of stock";
  }
  if (balanceKg < amountKg) {
    return `Need ${formatKg(amountKg - balanceKg)} more`;
  }
  if (riceStockKg < amountKg) {
    return `Only ${formatKg(riceStockKg)} of rice left`;
  }
  return "";
}

// One line above the Redeem button when no amount can be redeemed; none when one can.
function unavailableMessage(balanceKg, riceStockKg) {
  if (riceStockKg <= 0) return "Rice is out of stock";
  if (balanceKg < MIN_REDEEM_KG) return `Need ${formatKg(MIN_REDEEM_KG - balanceKg)} more`;
  if (riceStockKg < MIN_REDEEM_KG) return `Only ${formatKg(riceStockKg)} of rice left`;
  return "";
}

// Steps: choose | confirm | dispensing | done | failed
export default function UserRedeemPage() {
  const { currentUser } = useAuth();
  const { system, actions } = useData();

  const [amountKg, setAmountKg] = useState(null);
  const [selectedBinId, setSelectedBinId] = useState("");
  const [step, setStep] = useState("choose");
  const [error, setError] = useState("");
  const [redeemedKg, setRedeemedKg] = useState(0);
  const [failure, setFailure] = useState("");

  const submittingRef = useRef(false);
  const unsubscribeRef = useRef(null);
  const headingRef = useRef(null);

  const balanceKg = Number(currentUser?.weightKg || 0);
  const riceStockKg = Number(system.riceStock || 0);
  const availableBins = useMemo(() => Object.keys(system.bins || {}), [system.bins]);

  const options = REDEEM_OPTIONS_KG.map((kg) => ({
    kg,
    reason: blockReason(kg, balanceKg, riceStockKg),
  }));
  const selected = options.find((option) => option.kg === amountKg);
  const canRedeem = Boolean(selected && !selected.reason && selectedBinId);
  const message = unavailableMessage(balanceKg, riceStockKg);
  const binLabel = (binId) => formatBinName(binId, system.bins?.[binId]);

  useEffect(() => {
    if (availableBins.length === 1 && !selectedBinId) {
      setSelectedBinId(availableBins[0]);
    }
  }, [availableBins, selectedBinId]);

  // Drop a choice that became unavailable, e.g. after the balance changed.
  useEffect(() => {
    if (step === "choose" && selected?.reason) setAmountKg(null);
  }, [step, selected]);

  useEffect(() => () => unsubscribeRef.current?.(), []);

  useEffect(() => {
    if (step !== "choose" && step !== "confirm") headingRef.current?.focus();
  }, [step]);

  // Result screens cover the whole page, so what's behind them must not scroll.
  const showingResult = step === "dispensing" || step === "done" || step === "failed";
  useEffect(() => {
    if (!showingResult) return undefined;
    document.body.classList.add("portal-modal-lock");
    return () => document.body.classList.remove("portal-modal-lock");
  }, [showingResult]);

  useEffect(() => {
    if (step !== "dispensing") return undefined;
    const id = setTimeout(() => {
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
      setFailure("The bin did not confirm that it dispensed your rice.");
      setStep("failed");
    }, DISPENSE_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [step]);

  const listenForDispense = (binId) => {
    unsubscribeRef.current?.();
    unsubscribeRef.current = onValue(
      ref(realtimeDb, `rice_commands/${binId}`),
      (snap) => {
        if (!snap.exists()) return;
        const { status, message } = snap.val();
        if (status === "done") {
          unsubscribeRef.current?.();
          unsubscribeRef.current = null;
          setStep("done");
        } else if (status === "error") {
          unsubscribeRef.current?.();
          unsubscribeRef.current = null;
          setFailure(message || "The bin reported a problem while dispensing.");
          setStep("failed");
        }
      },
      () => {
        setFailure("Lost contact with the bin while dispensing.");
        setStep("failed");
      }
    );
  };

  const handleRedeem = async () => {
    if (!currentUser || submittingRef.current) return;
    if (!canRedeem) {
      setStep("choose");
      return;
    }
    submittingRef.current = true;
    setError("");

    const result = actions.redeemRice(currentUser.id, amountKg);
    if (!result.ok) {
      submittingRef.current = false;
      setError(result.error);
      setStep("choose");
      return;
    }
    setRedeemedKg(result.riceKg);

    if (!realtimeDb) {
      setStep("done");
      return;
    }

    setStep("dispensing");
    const cmdResult = await writeRiceCommand(
      selectedBinId,
      currentUser.id,
      currentUser.name,
      result.riceKg
    );
    if (cmdResult.ok) {
      listenForDispense(selectedBinId);
    } else {
      setFailure(cmdResult.error || "The bin could not be reached.");
      setStep("failed");
    }
  };

  const startOver = () => {
    submittingRef.current = false;
    setAmountKg(null);
    setRedeemedKg(0);
    setFailure("");
    setError("");
    setStep("choose");
  };

  return (
    <div className="eco-page eco-redeem">
      <h1 className="eco-page__title">Redeem Rice</h1>

      <section className="eco-summary" aria-label="Balance and stock">
        <dl className="eco-summary__balance">
          <dt>Your balance</dt>
          <dd>{formatKg(balanceKg)}</dd>
        </dl>
        <p className="eco-summary__note">1 kg plastic = 1 kg rice</p>

        <dl className="eco-rows">
          <div className="eco-row">
            <dt>Rice in stock</dt>
            <dd className={riceStockKg <= 0 ? "is-empty" : undefined}>{formatKg(riceStockKg)}</dd>
          </div>
          {availableBins.length > 1 ? null : (
            <div className="eco-row">
              <dt>Pickup bin</dt>
              <dd>{availableBins.length === 1 ? binLabel(availableBins[0]) : "No bins set up yet"}</dd>
            </div>
          )}
        </dl>

        {availableBins.length > 1 ? (
          <label className="eco-field">
            <span>Pickup bin</span>
            <select
              className="eco-field__input"
              value={selectedBinId}
              onChange={(e) => setSelectedBinId(e.target.value)}
            >
              <option value="">Choose a bin</option>
              {availableBins.map((id) => (
                <option key={id} value={id}>
                  {binLabel(id)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </section>

      {step === "choose" || step === "confirm" ? (
        <section className="eco-panel" aria-labelledby="amount-heading">
          <h2 id="amount-heading" className="eco-panel__title">
            Choose an amount
          </h2>
          <div className="eco-amounts" role="radiogroup" aria-labelledby="amount-heading">
            {options.map((option) => {
              // The line above Redeem already explains when nothing can be redeemed.
              const hint = option.reason
                ? message
                  ? ""
                  : option.reason
                : `${formatKg(balanceKg - option.kg)} left`;
              return (
                <button
                  key={option.kg}
                  type="button"
                  role="radio"
                  aria-checked={amountKg === option.kg}
                  aria-label={formatKg(option.kg)}
                  aria-describedby={
                    option.reason && message
                      ? "redeem-status"
                      : hint
                        ? `amount-hint-${option.kg}`
                        : undefined
                  }
                  className={`eco-amount${amountKg === option.kg ? " is-selected" : ""}`}
                  disabled={Boolean(option.reason)}
                  onClick={() => setAmountKg(option.kg)}
                >
                  <span className="eco-amount__value">{formatKg(option.kg)}</span>
                  {hint ? (
                    <span id={`amount-hint-${option.kg}`} className="eco-amount__hint">
                      {hint}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {error ? (
            <p className="eco-inline-error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="eco-action-bar">
            {message ? (
              <p id="redeem-status" className="eco-status">
                {message}
              </p>
            ) : null}
            <button
              type="button"
              className="eco-btn eco-btn--primary eco-btn--block"
              disabled={!canRedeem}
              onClick={() => setStep("confirm")}
            >
              Redeem
            </button>
          </div>
        </section>
      ) : null}

      {step === "confirm" && selected ? (
        <Sheet
          title={`Get ${formatKg(selected.kg)} of rice?`}
          showClose={false}
          onClose={() => setStep("choose")}
          actions={
            <>
              <button type="button" className="eco-btn eco-btn--primary" onClick={handleRedeem}>
                Dispense {formatKg(selected.kg)}
              </button>
              <button
                type="button"
                className="eco-btn eco-btn--secondary"
                onClick={() => setStep("choose")}
              >
                Back
              </button>
            </>
          }
        >
          <dl className="eco-confirm">
            <div>
              <dt>Bin</dt>
              <dd>{binLabel(selectedBinId)}</dd>
            </div>
            <div>
              <dt>Rice</dt>
              <dd>{formatKg(selected.kg)}</dd>
            </div>
            <div>
              <dt>Balance after</dt>
              <dd>{formatKg(balanceKg - selected.kg)}</dd>
            </div>
          </dl>
          <p className="eco-status">Have your container ready at the bin.</p>
        </Sheet>
      ) : null}

      {step === "dispensing" ? (
        <section className="eco-result" aria-live="polite">
          <span className="eco-sheet__status eco-sheet__status--busy" aria-hidden="true">
            <span className="eco-spinner" />
          </span>
          <h2 className="eco-panel__title" tabIndex={-1} ref={headingRef}>
            Dispensing {formatKg(redeemedKg)}
          </h2>
          <p className="eco-status">Keep your container under the gate.</p>
        </section>
      ) : null}

      {step === "done" ? (
        <section className="eco-result" aria-live="polite">
          <span className="eco-sheet__status eco-sheet__status--success" aria-hidden="true">
            ✓
          </span>
          <h2 className="eco-panel__title" tabIndex={-1} ref={headingRef}>
            Rice dispensed
          </h2>
          <p className="eco-status">Balance now {formatKg(balanceKg)}</p>
          <div className="eco-action-bar">
            <button type="button" className="eco-btn eco-btn--primary eco-btn--block" onClick={startOver}>
              Done
            </button>
          </div>
        </section>
      ) : null}

      {step === "failed" ? (
        <section className="eco-result" role="alert">
          <span className="eco-sheet__status eco-sheet__status--error" aria-hidden="true">
            !
          </span>
          <h2 className="eco-panel__title" tabIndex={-1} ref={headingRef}>
            Rice not confirmed
          </h2>
          <p className="eco-status">
            {failure} {formatKg(redeemedKg)} was taken from your balance. If no rice came out,
            ask your barangay admin.
          </p>
          <div className="eco-action-bar">
            <button type="button" className="eco-btn eco-btn--primary eco-btn--block" onClick={startOver}>
              Close
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
