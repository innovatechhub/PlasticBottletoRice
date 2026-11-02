import { useEffect, useRef } from "react";

// Modal confirmation. Focus starts on Cancel so Enter never confirms by accident.
export default function ConfirmDialog({
  title,
  children,
  confirmLabel,
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}) {
  const cancelRef = useRef(null);
  const previousFocus = useRef(null);

  useEffect(() => {
    previousFocus.current = document.activeElement;
    cancelRef.current?.focus();
    const onKey = (event) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previousFocus.current?.focus?.();
    };
  }, [onCancel]);

  return (
    <div className="adm-dialog-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="adm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="adm-dialog-title"
        aria-describedby="adm-dialog-body"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="adm-dialog-title" className="adm-dialog__title">
          {title}
        </h2>
        <div id="adm-dialog-body" className="adm-dialog__body">
          {children}
        </div>
        <div className="adm-dialog__actions">
          <button type="button" className="adm-btn adm-btn--secondary" ref={cancelRef} onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className={`adm-btn ${danger ? "adm-btn--danger" : "adm-btn--primary"}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
