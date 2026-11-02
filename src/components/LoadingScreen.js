import BrandMark from "./BrandMark";

// Full-page placeholder shown while the sign-in state is being checked.
export default function LoadingScreen({ label = "Loading EcoRice" }) {
  return (
    <div className="eco-loading" role="status" aria-live="polite">
      <div className="eco-loading__bar">
        <BrandMark />
        <span className="eco-loading__brand">EcoRice</span>
      </div>
      <div className="eco-loading__body" aria-hidden="true">
        <span className="eco-loading__block eco-loading__block--title" />
        <span className="eco-loading__block eco-loading__block--card" />
        <span className="eco-loading__block eco-loading__block--row" />
      </div>
      <p className="eco-loading__label">{label}…</p>
    </div>
  );
}
