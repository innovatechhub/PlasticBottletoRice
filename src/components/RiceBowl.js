// The resident's balance as a bowl that fills with rice. Full means there is
// enough to redeem; `label` and `valueText` say the same thing to screen readers.
export default function RiceBowl({ percent, full, label, valueText }) {
  const level = Math.min(100, Math.max(0, percent));

  return (
    <div
      className="eco-bowl"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(level)}
      aria-valuetext={valueText}
      aria-label={label}
    >
      {full ? <span className="eco-bowl__heap eco-rice" /> : null}
      <span className="eco-bowl__body">
        <span className="eco-bowl__fill eco-rice" style={{ height: `${level}%` }} />
      </span>
      <span className="eco-bowl__foot" />
    </div>
  );
}
