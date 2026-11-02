import { useEffect, useId, useRef } from "react";

const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

// A dialog for resident pages: a bottom sheet on phones, or the whole screen with `full`.
// Focus moves into it, Tab stays inside, Esc or a tap outside closes it, and focus
// returns to whatever opened it.
export default function Sheet({ title, onClose, children, actions, full = false, showClose = true }) {
  const titleId = useId();
  const dialogRef = useRef(null);

  useEffect(() => {
    const opener = document.activeElement;
    document.body.classList.add("portal-modal-lock");
    dialogRef.current?.focus();
    return () => {
      document.body.classList.remove("portal-modal-lock");
      opener?.focus?.();
    };
  }, []);

  const handleKeyDown = (event) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const items = [...dialogRef.current.querySelectorAll(FOCUSABLE)];
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className="eco-sheet-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className={`eco-sheet eco-sheet--plain${full ? " eco-sheet--full" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <div className="eco-sheet__head">
          <h2 id={titleId} className="eco-sheet__title">
            {title}
          </h2>
          {showClose ? (
            <button type="button" className="eco-icon-btn" aria-label="Close" onClick={onClose}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          ) : null}
        </div>
        <div className="eco-sheet__body">{children}</div>
        {actions ? <div className="eco-sheet__actions">{actions}</div> : null}
      </div>
    </div>
  );
}
