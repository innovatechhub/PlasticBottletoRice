import { useCallback, useEffect, useRef, useState } from "react";
import { onValue, ref } from "firebase/database";
import { realtimeDb } from "../../services/firebaseClient";
import {
  cancelBinCommand,
  flushWrites,
  isBinInUse,
  writeBinCommand,
} from "../../services/cloudSync";
import { formatBinName, formatKg } from "../../utils/format";

const SESSION_SECONDS = 60;
// The bin checks for commands about every 5 s; allow a few missed checks.
const CONNECT_TIMEOUT_MS = 25000;
const SAVE_TIMEOUT_MS = 15000;
const CANCEL_TIMEOUT_MS = 5000;

const withTimeout = (promise, ms) =>
  Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve({ ok: false, timedOut: true }), ms)),
  ]);

const STEPS = ["Connect", "Insert", "Save"];

const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

// Phases: connecting | active | saving | saved | unconfirmed | ended | noResponse | failed
export default function InsertBottleSession({ binId, user, onFinalize, onClose }) {
  const [phase, setPhase] = useState("connecting");
  const [bottles, setBottles] = useState([]);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [timerSeconds, setTimerSeconds] = useState(SESSION_SECONDS);
  const [timerPaused, setTimerPaused] = useState(false);
  const [online, setOnline] = useState(true);
  const [savedKg, setSavedKg] = useState(0);
  const [checking, setChecking] = useState(false);

  const phaseRef = useRef(phase);
  const bottlesRef = useRef(bottles);
  const unsubRef = useRef(null);
  const attemptRef = useRef(0);
  const savingRef = useRef(false);
  const lastAcceptedAtRef = useRef("");
  const lastValidationAtRef = useRef("");
  const headingRef = useRef(null);

  phaseRef.current = phase;
  bottlesRef.current = bottles;

  const stopListening = useCallback(() => {
    unsubRef.current?.();
    unsubRef.current = null;
  }, []);

  const save = useCallback(async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    stopListening();
    setPhase("saving");
    setError("");

    // Stop the bin first so it doesn't take bottles that this save would miss.
    await withTimeout(cancelBinCommand(binId), CANCEL_TIMEOUT_MS);

    const weights = bottlesRef.current.map((bottle) => bottle.weightKg);
    const result = onFinalize(weights);
    if (!result.ok) {
      setPhase("unconfirmed");
      setError(result.error || "The bottles could not be saved.");
      return;
    }
    setSavedKg(result.kgEarned);

    const sync = await withTimeout(flushWrites(), SAVE_TIMEOUT_MS);
    if (sync.ok) {
      setPhase("saved");
    } else {
      setPhase("unconfirmed");
      setError(sync.timedOut ? "" : sync.error || "");
    }
  }, [binId, onFinalize, stopListening]);

  const endSession = useCallback(() => {
    stopListening();
    if (bottlesRef.current.length > 0) {
      save();
    } else {
      setPhase("ended");
    }
  }, [save, stopListening]);

  const listen = useCallback(() => {
    stopListening();
    unsubRef.current = onValue(
      ref(realtimeDb, `bin_commands/${binId}`),
      (snapshot) => {
        if (!snapshot.exists()) return;
        const current = phaseRef.current;
        if (current !== "connecting" && current !== "active") return;

        const {
          status,
          lastWeightKg,
          lastAcceptedAt,
          lastValidationStatus,
          lastValidationMessage,
          lastValidationAt,
        } = snapshot.val();

        if (status === "active") {
          setPhase("active");
          const isNewValidation =
            lastValidationAt && lastValidationAt !== lastValidationAtRef.current;

          if (
            isNewValidation &&
            (lastValidationStatus === "warning" || lastValidationStatus === "rejected")
          ) {
            setTimerPaused(lastValidationStatus === "warning");
            setNotice(
              lastValidationMessage ||
                (lastValidationStatus === "warning"
                  ? "Metal detected. Remove it."
                  : "Not accepted. Try another bottle.")
            );
            lastValidationAtRef.current = lastValidationAt;
          } else if (isNewValidation && lastValidationStatus === "ready") {
            setTimerPaused(false);
            setTimerSeconds(SESSION_SECONDS);
            setNotice("");
            lastValidationAtRef.current = lastValidationAt;
          }

          if (lastAcceptedAt && lastAcceptedAt !== lastAcceptedAtRef.current) {
            const kg = Number(lastWeightKg || 0);
            if (kg > 0) {
              setBottles((prev) => [...prev, { weightKg: kg }]);
              setTimerSeconds(SESSION_SECONDS);
            }
            lastAcceptedAtRef.current = lastAcceptedAt;
            setTimerPaused(false);
            setNotice("");
          }
          return;
        }

        if (status === "expired" || status === "idle") {
          endSession();
        }
      },
      () => {
        stopListening();
        setPhase("failed");
        setError("Lost contact with the bin.");
      }
    );
  }, [binId, endSession, stopListening]);

  const start = useCallback(async () => {
    attemptRef.current += 1;
    const attempt = attemptRef.current;
    // A newer attempt or the connect timeout has taken over.
    const superseded = () =>
      attempt !== attemptRef.current || phaseRef.current !== "connecting";

    stopListening();
    phaseRef.current = "connecting";
    setPhase("connecting");
    setError("");
    setNotice("");
    setTimerSeconds(SESSION_SECONDS);
    setTimerPaused(false);
    lastAcceptedAtRef.current = "";
    lastValidationAtRef.current = "";

    if (!realtimeDb) {
      setPhase("failed");
      setError("The bin needs an online connection, and this app isn't connected to Firebase.");
      return;
    }

    const inUse = await isBinInUse(binId, user.id);
    if (superseded()) return;
    if (inUse) {
      setPhase("failed");
      setError("Another resident is using this bin. Try again in a minute.");
      return;
    }

    const result = await writeBinCommand(binId, user.id, user.name);
    if (superseded()) return;
    if (!result.ok) {
      setPhase("failed");
      setError(result.error || "The bin could not be reached.");
      return;
    }
    listen();
  }, [binId, listen, stopListening, user.id, user.name]);

  const cancel = () => {
    stopListening();
    if (phaseRef.current === "connecting" || phaseRef.current === "active") {
      withTimeout(cancelBinCommand(binId), CANCEL_TIMEOUT_MS);
    }
    onClose();
  };

  const checkAgain = async () => {
    if (checking) return;
    setChecking(true);
    const sync = await withTimeout(flushWrites(), SAVE_TIMEOUT_MS);
    setChecking(false);
    if (sync.ok) {
      setPhase("saved");
      setError("");
    } else if (!sync.timedOut) {
      setError(sync.error || "");
    }
  };

  // Start once when the session opens; stop listening when it closes.
  useEffect(() => {
    start();
    return () => {
      unsubRef.current?.();
      unsubRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // No answer from the bin: give up and free it so it doesn't wake up later.
  useEffect(() => {
    if (phase !== "connecting") return undefined;
    const id = setTimeout(() => {
      if (phaseRef.current !== "connecting") return;
      phaseRef.current = "noResponse";
      stopListening();
      withTimeout(cancelBinCommand(binId), CANCEL_TIMEOUT_MS);
      setPhase("noResponse");
    }, CONNECT_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [phase, binId, stopListening]);

  useEffect(() => {
    if (phase !== "active" || timerPaused) return undefined;
    const id = setInterval(() => setTimerSeconds((t) => Math.max(0, t - 1)), 1000);
    return () => clearInterval(id);
  }, [phase, timerPaused]);

  useEffect(() => {
    if (phase === "active" && !timerPaused && timerSeconds === 0) {
      endSession();
    }
  }, [phase, timerPaused, timerSeconds, endSession]);

  // Firebase's own connection flag; only report a loss after a first connection.
  useEffect(() => {
    if (!realtimeDb) return undefined;
    let wasConnected = false;
    return onValue(ref(realtimeDb, ".info/connected"), (snapshot) => {
      const connected = snapshot.val() === true;
      if (connected) wasConnected = true;
      setOnline(connected || !wasConnected);
    });
  }, []);

  // Warn before leaving the page with bottles that are not saved yet.
  useEffect(() => {
    const unsaved = bottles.length > 0 && phase !== "saved";
    if (!unsaved) return undefined;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [bottles.length, phase]);

  useEffect(() => {
    headingRef.current?.focus();
  }, [phase]);

  const count = bottles.length;
  const totalKg = bottles.reduce((sum, bottle) => sum + bottle.weightKg, 0);
  const minutes = Math.floor(timerSeconds / 60);
  const seconds = String(timerSeconds % 60).padStart(2, "0");
  const live = phase === "connecting" || phase === "active";
  const showCount = phase === "active" || (phase === "failed" && count > 0) || phase === "saving";
  // How far along the three steps this phase is.
  const stepIndex =
    phase === "saving" || phase === "saved" || phase === "unconfirmed"
      ? 2
      : phase === "active" || phase === "ended" || count > 0
        ? 1
        : 0;

  const view = {
    connecting: {
      tone: "busy",
      title: "Connecting…",
      text: "This can take up to 20 seconds.",
    },
    active: {
      tone: "ready",
      title: "Ready. Insert your bottles.",
      text: count === 0 ? "One bottle at a time." : "Tap Done when you're finished.",
    },
    saving: {
      tone: "busy",
      title: "Saving…",
      text: "Keep this page open.",
    },
    saved: {
      tone: "success",
      title: "Saved",
      text: `${plural(count, "bottle")}. Balance now ${formatKg(user.weightKg)}.`,
    },
    unconfirmed: {
      tone: "warning",
      title: "Not saved yet",
      text: error
        ? `${error} Ask your barangay admin to check your balance.`
        : `${plural(count, "bottle")} (${formatKg(totalKg)}) are on this phone only. Stay online, then check again.`,
    },
    ended: {
      tone: "neutral",
      title: "Session ended",
      text: "No bottles added.",
    },
    noResponse: {
      tone: "error",
      title: "Bin not responding",
      text: "Check that the bin is on and online.",
    },
    failed:
      count > 0
        ? {
            tone: "error",
            title: "Connection lost",
            text: `${plural(count, "bottle")} counted. Save them now.`,
          }
        : {
            tone: "error",
            title: "Couldn't start",
            text: error,
          },
  }[phase];

  return (
    <div className="eco-sheet-backdrop eco-insert">
      <section
        className="eco-sheet eco-sheet--full"
        role="dialog"
        aria-modal="true"
        aria-labelledby="insert-session-title"
        aria-describedby="insert-session-text"
      >
        <div className="eco-insert__head">
          <p className="eco-sheet__bin">{formatBinName(binId)}</p>
          <ol className="eco-insert__steps" aria-label="Progress">
            {STEPS.map((step, index) => (
              <li
                key={step}
                className={index <= stepIndex ? "is-reached" : undefined}
                aria-current={index === stepIndex ? "step" : undefined}
              >
                {step}
              </li>
            ))}
          </ol>
        </div>

        <div className="eco-insert__body">
          {phase === "active" ? null : (
            <span className={`eco-sheet__status eco-sheet__status--${view.tone}`} aria-hidden="true">
              {view.tone === "busy" ? <span className="eco-spinner" /> : null}
              {view.tone === "success" ? "✓" : null}
              {view.tone === "error" || view.tone === "warning" ? "!" : null}
              {view.tone === "neutral" ? "–" : null}
            </span>
          )}

          <h2
            id="insert-session-title"
            className="eco-sheet__title"
            tabIndex={-1}
            ref={headingRef}
          >
            {view.title}
          </h2>

          {phase === "saved" ? (
            <p className="eco-sheet__amount">+{formatKg(savedKg)}</p>
          ) : null}

          <p id="insert-session-text" className="eco-sheet__text" aria-live="polite">
            {view.text}
          </p>

          {showCount ? (
            <dl className="eco-insert__stats">
              <div className="eco-insert__count">
                <dt>Bottles</dt>
                <dd>{count}</dd>
              </div>
              <div>
                <dt>Weight</dt>
                <dd>{formatKg(totalKg)}</dd>
              </div>
              {phase === "active" ? (
                <div>
                  <dt>{timerPaused ? "Paused" : "Ends in"}</dt>
                  <dd>{`${minutes}:${seconds}`}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}

          {notice && phase === "active" ? (
            <p className="eco-sheet__notice" role="alert">
              {notice}
            </p>
          ) : null}

          {!online && live ? (
            <p className="eco-sheet__notice" role="alert">
              Offline. New bottles may not count.
            </p>
          ) : null}
        </div>

        <div className="eco-sheet__actions">
          {phase === "connecting" ? (
            <button type="button" className="eco-btn eco-btn--secondary" onClick={cancel}>
              Cancel
            </button>
          ) : null}

          {phase === "active" ? (
            <>
              <button
                type="button"
                className="eco-btn eco-btn--primary"
                onClick={save}
                disabled={count === 0}
              >
                Done
              </button>
              {count === 0 ? (
                <button type="button" className="eco-btn eco-btn--secondary" onClick={cancel}>
                  Cancel
                </button>
              ) : null}
            </>
          ) : null}

          {phase === "saving" ? (
            <button type="button" className="eco-btn eco-btn--primary" disabled>
              Saving…
            </button>
          ) : null}

          {phase === "saved" ? (
            <button type="button" className="eco-btn eco-btn--primary" onClick={onClose}>
              Done
            </button>
          ) : null}

          {phase === "unconfirmed" ? (
            <>
              {!error ? (
                <button
                  type="button"
                  className="eco-btn eco-btn--primary"
                  onClick={checkAgain}
                  disabled={checking}
                >
                  {checking ? "Checking…" : "Check again"}
                </button>
              ) : null}
              <button type="button" className="eco-btn eco-btn--secondary" onClick={onClose}>
                Close
              </button>
            </>
          ) : null}

          {phase === "failed" && count > 0 ? (
            <button type="button" className="eco-btn eco-btn--primary" onClick={save}>
              Save {plural(count, "bottle")}
            </button>
          ) : null}

          {phase === "noResponse" || phase === "ended" || (phase === "failed" && count === 0) ? (
            <>
              <button type="button" className="eco-btn eco-btn--primary" onClick={start}>
                {phase === "ended" ? "Start again" : "Try again"}
              </button>
              <button type="button" className="eco-btn eco-btn--secondary" onClick={onClose}>
                {phase === "ended" ? "Close" : "Cancel"}
              </button>
            </>
          ) : null}
        </div>
      </section>
    </div>
  );
}
