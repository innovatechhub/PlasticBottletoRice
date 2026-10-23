import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../app/AuthContext";
import PublicMobileNav from "../components/PublicMobileNav";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, authError } = useAuth();
  const [form, setForm] = useState({ loginId: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loginError, setLoginError] = useState("");
  const error = loginError || authError;

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // On success the login route redirects once the user's role and data are loaded.
  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoginError("");
    setSubmitting(true);
    const result = await login(form);
    setSubmitting(false);
    if (!result.ok) {
      setLoginError(result.error);
    }
  };

  return (
    <div className="sb-login-shell">

      {/* ── Left: Form Panel ── */}
      <div className="sb-login-left">
        <div className="sb-login-left-inner">
          <button
            type="button"
            className="sb-back-btn"
            onClick={() => navigate("/")}
          >
            <span className="material-symbols-outlined">arrow_back</span>
            Back to Home
          </button>

          {/* Logo */}
          <div className="sb-logo-wrap">
            <div className="sb-logo-icon">
              <svg viewBox="0 0 24 24" fill="none" width="28" height="28">
                <path d="M6 2h12l1 4H5L6 2Z" fill="#22c55e" opacity="0.3"/>
                <path d="M5 6l1.5 14h11L19 6H5Z" fill="#16a34a"/>
                <path d="M10 10v6M14 10v6" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" stroke="#15803d" strokeWidth="1.5"/>
                <circle cx="12" cy="3.5" r="1" fill="#22c55e"/>
                <path d="M10 2.5l2-1.5 2 1.5" stroke="#22c55e" strokeWidth="1" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="sb-logo-text">
              <span className="sb-logo-plus">+Eco</span>
              <span className="sb-logo-name">Rice</span>
            </div>
          </div>

          {/* Form */}
          <form className="sb-form" aria-label="Sign in" aria-busy={submitting} onSubmit={handleSubmit}>
            <div className="sb-field-wrap">
              <label className="sb-label" htmlFor="sb-username">Username</label>
              <div className="sb-input-wrap">
                <span className="sb-input-icon">
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
                  spellCheck={false}
                  required
                />
              </div>
            </div>

            <div className="sb-field-wrap">
              <label className="sb-label" htmlFor="sb-password">Password</label>
              <div className="sb-input-wrap">
                <span className="sb-input-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                    <rect x="3" y="11" width="18" height="11" rx="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </span>
                <input
                  id="sb-password"
                  className="sb-input sb-input--pad-right"
                  type={showPassword ? "text" : "password"}
                  name="password"
                  autoComplete="current-password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
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
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="sb-error-box" role="alert">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            )}

            <div className="sb-form-row">
              <label className="sb-remember">
                <input type="checkbox" className="sb-checkbox" />
                Remember me
              </label>
              <span className="sb-forgot">Forgot password?</span>
            </div>

            <button className="sb-signin-btn" type="submit" disabled={submitting}>
              {submitting ? "Signing in..." : "Sign in"}
              {!submitting && <span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span>}
            </button>
          </form>

        </div>
      </div>

      {/* ── Right: Image Panel ── */}
      <div
        className="sb-login-right"
        style={{
          backgroundImage: `url(${process.env.PUBLIC_URL}/PageUI.png)`,
          backgroundPosition: "center center",
          backgroundRepeat: "no-repeat",
          backgroundSize: "cover",
        }}
      >
        <div className="sb-login-right-overlay" />
        <div className="sb-login-right-content">
          <h2 className="sb-right-title">Join our community of eco-warriors</h2>
          <p className="sb-right-sub">
            Make a difference by recycling and earning rewards for your contributions
          </p>
        </div>
      </div>

      <PublicMobileNav />
    </div>
  );
}
