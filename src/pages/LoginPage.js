import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../app/AuthContext";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({
    email: "",
    password: "",
  });
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
    <div className="auth-shell">
      <div className="auth-panel">
        <p className="brand-tag">Plastic Bottle to Rice System</p>
        <h1 className="auth-title">Unified Login</h1>
        <p className="auth-subtitle">
          Sign in once. The system will detect whether you are an admin or household
          user.
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              className="input-field"
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              required
            />
          </label>
          <label>
            Password
            <input
              className="input-field"
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              required
            />
          </label>
          {error ? <p className="error-text">{error}</p> : null}
          <button className="btn-primary" type="submit">
            Login
          </button>
        </form>

        <div className="credentials-box">
          <h3>Login Info</h3>
          <p>
            Use an account stored in the database (admin or household user).
          </p>
        </div>
      </div>
    </div>
  );
}
