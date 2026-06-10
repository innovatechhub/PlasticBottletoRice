import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../app/AuthContext";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setError("");
    const result = login(form);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    navigate(result.user.role === "admin" ? "/admin/dashboard" : "/user/home", {
      replace: true,
    });
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

          {/* Heading */}
          <div className="sb-form-heading">
            <h2 className="sb-form-title">Welcome back!</h2>
            <p className="sb-form-sub">Please enter your details to sign in.</p>
          </div>

          {/* Form */}
          <form className="sb-form" onSubmit={handleSubmit}>
            <div className="sb-field-wrap">
              <label className="sb-label" htmlFor="sb-email">Email Address</label>
              <div className="sb-input-wrap">
                <span className="sb-input-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                    <rect x="2" y="4" width="20" height="16" rx="2"/>
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                  </svg>
                </span>
                <input
                  id="sb-email"
                  className="sb-input"
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="Enter your email"
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
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  className="sb-eye-btn"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
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
              <div className="sb-error-box">
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

            <button className="sb-signin-btn" type="submit">
              Sign in
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

    </div>
  );
}
