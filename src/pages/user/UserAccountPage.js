import { useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { useAuth } from "../../app/AuthContext";
import { useData } from "../../app/DataContext";
import Sheet from "../../components/Sheet";
import { formatMonthYear } from "../../utils/format";
import { APP_URL_MISSING, householdQrValue } from "../../utils/qr";
import useMediaQuery from "../../utils/useMediaQuery";

const HELP = [
  ["How do I earn rice?", "Insert bottles in the bin. Their weight is added to your balance."],
  ["Why is rice out of stock?", "The bin has no rice right now. Please try again later."],
  ["What if the bin isn't working?", "Try again, or contact your barangay admin."],
];

const Icon = ({ d }) => (
  <svg className="eco-row__icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d={d} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const QR_ICON = "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2";
const HELP_ICON = "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01";
const CHEVRON = "M9 6l6 6-6 6";

// A tappable row: icon, label, chevron. Shares the information rows' look.
function ActionRow({ icon, label, onClick }) {
  return (
    <li>
      <button type="button" className="eco-row eco-row--action" onClick={onClick} aria-haspopup="dialog">
        <Icon d={icon} />
        <span className="eco-row__label">{label}</span>
        <svg className="eco-row__chevron" viewBox="0 0 24 24" aria-hidden="true">
          <path d={CHEVRON} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </li>
  );
}

export default function UserAccountPage() {
  const { currentUser, logout } = useAuth();
  const { syncErrors = [] } = useData();
  const [sheet, setSheet] = useState(""); // "" | "qr" | "help" | "logout"
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const qrRef = useRef(null);
  // Wide screens have room to show the QR code and Help on the page itself.
  const isWide = useMediaQuery("(min-width: 960px)");
  // Stops a double tap from logging out twice (state updates arrive too late for that).
  const loggingOutRef = useRef(false);

  if (!currentUser) {
    return (
      <div className="eco-page">
        <h1 className="eco-page__title">Account</h1>
        <p className="eco-status" role="status">
          Loading your account…
        </p>
      </div>
    );
  }

  const name = currentUser.name?.trim() || "";
  const barangay = currentUser.barangay?.trim() || "";
  const memberSince = formatMonthYear(currentUser.createdAt);
  const loadFailed = syncErrors.some((key) => key === "users" || key.startsWith("users:"));

  // Only details the profile already has; empty ones are left out.
  const details = [
    ["Username", currentUser.username],
    ["Barangay", barangay],
  ].filter(([, value]) => value);

  const closeSheet = () => {
    setSheet("");
    setLogoutError("");
  };

  const saveImage = () => {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) return;
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `${(name || "household").replace(/[^\w-]+/g, "-").toLowerCase()}-qr.png`;
    link.click();
  };

  const confirmLogout = async () => {
    if (loggingOutRef.current) return;
    loggingOutRef.current = true;
    setLoggingOut(true);
    setLogoutError("");
    try {
      await logout();
    } catch {
      setLogoutError("Couldn't log out. Try again.");
      loggingOutRef.current = false;
      setLoggingOut(false);
    }
  };

  const qrView = (
    <div className="eco-qr-view">
      <div className="eco-qr" ref={qrRef}>
        <QRCodeCanvas
          value={householdQrValue(currentUser.id)}
          size={480}
          level="M"
          includeMargin
          bgColor="#ffffff"
          fgColor="#16191a"
          // Drawn at 480 px for a sharp saved image, shown at a scannable size.
          style={{ width: "min(260px, 68vw, 46vh)", height: "auto" }}
          role="img"
          aria-label={`QR code for ${name || "your household"}`}
        />
      </div>
      <p className="eco-qr-view__name">{name}</p>
      {APP_URL_MISSING ? (
        <p className="eco-dev-note">
          Developer: this QR points to this computer. Set REACT_APP_PUBLIC_APP_URL before building.
        </p>
      ) : null}
    </div>
  );

  const helpList = (
    <dl className="eco-faq">
      {HELP.map(([question, answer]) => (
        <div key={question}>
          <dt>{question}</dt>
          <dd>{answer}</dd>
        </div>
      ))}
    </dl>
  );

  return (
    <div className="eco-page eco-account">
      <h1 className="eco-page__title">Account</h1>

      {loadFailed ? (
        <p className="eco-inline-error" role="alert">
          Couldn't load your latest details. Check your connection.
        </p>
      ) : null}

      <section className="eco-profile" aria-label="Profile">
        <span className="eco-avatar" aria-hidden="true">
          {(name[0] || "?").toUpperCase()}
        </span>
        <div className="eco-profile__text">
          <p className="eco-profile__name">{name || "Resident"}</p>
          {barangay ? <p className="eco-profile__meta">{barangay}</p> : null}
          {memberSince ? <p className="eco-profile__meta">Member since {memberSince}</p> : null}
        </div>
      </section>

      {isWide ? (
        <section className="eco-qr-panel" aria-labelledby="qr-heading">
          <h2 id="qr-heading" className="eco-section__title">
            My QR code
          </h2>
          {qrView}
          <button type="button" className="eco-btn eco-btn--secondary eco-btn--block" onClick={saveImage}>
            Save image
          </button>
        </section>
      ) : (
        <button type="button" className="eco-qr-button" onClick={() => setSheet("qr")} aria-haspopup="dialog">
          <svg className="eco-qr-button__icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d={QR_ICON} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="eco-row__label">My QR code</span>
          <svg className="eco-row__chevron" viewBox="0 0 24 24" aria-hidden="true">
            <path d={CHEVRON} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}

      <section className="eco-section" aria-label="Account details">
        {details.length > 0 ? (
          <dl className="eco-rows">
            {details.map(([label, value]) => (
              <div key={label} className="eco-row">
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {/* No Change password row: residents have no change or reset flow (admins reset passwords). */}
        {isWide ? null : (
          <ul className="eco-rows eco-rows--list eco-rows--joined">
            <ActionRow icon={HELP_ICON} label="Help" onClick={() => setSheet("help")} />
          </ul>
        )}
        <p className="eco-status">To change details, ask your barangay admin.</p>
      </section>

      {isWide ? (
        <section className="eco-section" aria-labelledby="help-heading">
          <h2 id="help-heading" className="eco-section__title">
            Help
          </h2>
          {helpList}
        </section>
      ) : null}

      <button type="button" className="eco-text-btn eco-account__logout" onClick={() => setSheet("logout")}>
        Log out
      </button>

      {sheet === "qr" ? (
        <Sheet
          title="Your QR code"
          full
          onClose={closeSheet}
          actions={
            <button type="button" className="eco-btn eco-btn--primary eco-btn--block" onClick={saveImage}>
              Save image
            </button>
          }
        >
          {qrView}
        </Sheet>
      ) : null}

      {sheet === "help" ? (
        <Sheet title="Help" onClose={closeSheet}>
          {helpList}
        </Sheet>
      ) : null}

      {sheet === "logout" ? (
        <Sheet
          title="Log out?"
          showClose={false}
          onClose={closeSheet}
          actions={
            <>
              <button
                type="button"
                className="eco-btn eco-btn--primary"
                onClick={confirmLogout}
                disabled={loggingOut}
              >
                {loggingOut ? "Logging out…" : "Log out"}
              </button>
              <button type="button" className="eco-btn eco-btn--secondary" onClick={closeSheet}>
                Cancel
              </button>
            </>
          }
        >
          {logoutError ? (
            <p className="eco-inline-error" role="alert">
              {logoutError}
            </p>
          ) : null}
        </Sheet>
      ) : null}
    </div>
  );
}
