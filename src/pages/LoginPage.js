import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../app/AuthContext";
import BrandMark from "../components/BrandMark";
import PublicMobileNav from "../components/PublicMobileNav";

const PAGE_TITLE = "Sign in | EcoRice";
// Matches the mobile layout breakpoint in index.css.
const MOBILE_QUERY = "(max-width: 767px)";

// Inline so the arrows show even before the icon font loads.
function ArrowIcon({ direction = "forward" }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {direction === "back" ? <path d="M19 12H5M11 18l-6-6 6-6" /> : <path d="M5 12h14M13 6l6 6-6 6" />}
    </svg>
  );
}

const isMobile = () =>
  typeof window !== "undefined" && window.matchMedia?.(MOBILE_QUERY).matches;

export default function LoginPage() {
  const { login, authError } = useAuth();
  const [form, setForm] = useState({ loginId: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const [typing, setTyping] = useState(false);
  const submittingRef = useRef(false);
  const passwordRef = useRef(null);
  const error = loginError || authError;

  useEffect(() => {
    const previous = document.title;
    document.title = PAGE_TITLE;
    return () => {
      document.title = previous;
    };
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // On success the login route redirects once the user's role and data are loaded,
  // so the button stays in its loading state until this page goes away.
  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submittingRef.current) return;
    // Browsers stop this with "required" first; this covers any that don't.
    if (!form.loginId.trim() || !form.password) {
      setLoginError("Enter your username and password.");
      return;
    }
    submittingRef.current = true;
    setLoginError("");
    setSubmitting(true);

    const result = await login(form);
    if (!result.ok) {
      submittingRef.current = false;
      setSubmitting(false);
      setLoginError(result.error);
      setForm((prev) => ({ ...prev, password: "" }));
      passwordRef.current?.focus();
    }
  };

  // On phones: hide the bottom navigation while typing and keep the field above the keyboard.
  const handleFocus = (event) => {
    if (!isMobile()) return;
    setTyping(true);
    const field = event.target;
    if (field.tagName === "INPUT" && field.scrollIntoView) {
      setTimeout(() => field.scrollIntoView({ block: "center", behavior: "smooth" }), 300);
    }
  };

  const handleBlur = (event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setTyping(false);
  };

  return (
    <div className={`sb-login-shell${typing ? " sb-login-shell--typing" : ""}`}>
      {/* Mobile only: compact branded header */}
      <header className="sb-mobile-hero">
        <Link className="sb-mobile-hero__brand" to="/" aria-label="EcoRice home">
          <BrandMark size={26} />
          <span>EcoRice</span>
        </Link>
      </header>

      {/* ── Left: Form Panel ── */}
      <main className="sb-login-left">
        <Link className="sb-back-btn" to="/">
          <ArrowIcon direction="back" />
          Back to Home
        </Link>

        <div className="sb-login-left-inner">
          {/* Logo (desktop) */}
          <div className="sb-logo-wrap">
            <div className="sb-logo-icon">
              <BrandMark size={28} />
            </div>
            <div className="sb-logo-text">
              <span className="sb-logo-plus">Eco</span>
              <span className="sb-logo-name">Rice</span>
            </div>
          </div>

          <div className="sb-form-heading">
            <h1 className="sb-form-title">Welcome back</h1>
            <p className="sb-form-sub">Sign in to your EcoRice account</p>
          </div>

          <form
            className="sb-form"
            aria-label="Sign in"
            aria-busy={submitting}
            onSubmit={handleSubmit}
            onFocus={handleFocus}
            onBlur={handleBlur}
          >
            <div className="sb-field-wrap">
              <label className="sb-label" htmlFor="sb-username">Username</label>
              <div className="sb-input-wrap">
                <span className="sb-input-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                    <circle cx="12" cy="8" r="4"/>
                    <path d="M4 21a8 8 0 0 1 16 0"/>
                  </svg>
                </span>
                <input
                  id="sb-username"
                  className="sb-input"
                  type="text"
                  name="loginId"
                  value={form.loginId}
                  onChange={handleChange}
                  placeholder="Enter your username"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="next"
                  aria-invalid={Boolean(loginError)}
                  aria-describedby={error ? "sb-login-error" : undefined}
                  required
                />
              </div>
            </div>

            <div className="sb-field-wrap">
              <label className="sb-label" htmlFor="sb-password">Password</label>
              <div className="sb-input-wrap">
                <span className="sb-input-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                    <rect x="3" y="11" width="18" height="11" rx="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </span>
                <input
                  id="sb-password"
                  ref={passwordRef}
                  className="sb-input sb-input--pad-right"
                  type={showPassword ? "text" : "password"}
                  name="password"
                  autoComplete="current-password"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="go"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
                  aria-invalid={Boolean(loginError)}
                  aria-describedby={error ? "sb-login-error" : undefined}
                  required
                />
                <button
                  type="button"
                  className="sb-eye-btn"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" aria-hidden="true">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" aria-hidden="true">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="sb-error-box" role="alert" id="sb-login-error">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" aria-hidden="true">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            )}

            <div className="sb-form-row">
              {/* Not connected yet: sign-ins always stay remembered (see project notes). */}
              <label className="sb-remember">
                <input type="checkbox" className="sb-checkbox" name="remember" />
                Remember me
              </label>
              <button
                type="button"
                className="sb-forgot"
                aria-expanded={helpOpen}
                aria-controls="sb-forgot-help"
                onClick={() => setHelpOpen((open) => !open)}
              >
                Forgot password?
              </button>
            </div>

            {/* Placeholder until the owner decides: there is no self-service reset;
                admins reset resident passwords from the resident's profile. */}
            {helpOpen ? (
              <p className="sb-help" id="sb-forgot-help">
                Ask your barangay admin to reset your password. They can set a new one for you.
              </p>
            ) : null}

            <button className="sb-signin-btn" type="submit" disabled={submitting}>
              {submitting ? "Signing in..." : "Sign in"}
              {!submitting && <ArrowIcon />}
            </button>
          </form>

          {/* Accounts are created by admins; there is no sign-up. */}
          <p className="sb-newcomer">No account? Ask your barangay admin.</p>
        </div>
      </main>

      {/* ── Right: Image Panel (desktop) ── */}
      <div
        className="sb-login-right"
        style={{
          backgroundImage: `url(${process.env.PUBLIC_URL}/PageUI.png)`,
          backgroundPosition: "center center",
          backgroundRepeat: "no-repeat",
          backgroundSize: "cover",
        }}
        role="img"
        aria-label="A hand putting a plastic bottle into a recycling bin"
      />

      <PublicMobileNav />
    </div>
  );
}
