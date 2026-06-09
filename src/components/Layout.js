import { useMemo } from "react";
import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../app/AuthContext";
import NotificationBell from "./NotificationBell";

const adminLinks = [
  { to: "/admin/dashboard", label: "Home", icon: "home" },
  {
    to: "/admin/users",
    label: "User Management",
    mobileLabel: "Users",
    icon: "users",
  },
  { to: "/admin/logs", label: "Logs", icon: "analytics" },
  { to: "/admin/storage", label: "Settings", icon: "settings" },
];

const userLinks = [
  { to: "/user/home", label: "Home", icon: "home" },
  { to: "/user/redeem", label: "Wallet", icon: "wallet" },
  { to: "/user/history", label: "Analytics", icon: "analytics" },
];

function MenuIcon({ name, className = "" }) {
  const iconClass = className ? `menu-svg ${className}` : "menu-svg";

  if (name === "wallet") {
    return (
      <svg viewBox="0 0 24 24" className={iconClass} aria-hidden="true">
        <path
          fill="currentColor"
          d="M3 7a3 3 0 0 1 3-3h11a1 1 0 1 1 0 2H6a1 1 0 0 0 0 2h14a1 1 0 0 1 1 1v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7Zm14 7a1 1 0 1 0 0 2h2v-2h-2Z"
        />
      </svg>
    );
  }

  if (name === "analytics") {
    return (
      <svg viewBox="0 0 24 24" className={iconClass} aria-hidden="true">
        <path
          fill="currentColor"
          d="M18 3a8 8 0 1 1-8 8h8V3Zm2 2.52A9.96 9.96 0 0 1 22 12c0 5.52-4.48 10-10 10A9.96 9.96 0 0 1 5.52 20L12 13.52l8-8Z"
        />
      </svg>
    );
  }

  if (name === "settings") {
    return (
      <svg viewBox="0 0 24 24" className={iconClass} aria-hidden="true">
        <path
          fill="currentColor"
          d="M19.14 12.94a7.97 7.97 0 0 0 .05-.94c0-.32-.02-.63-.05-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.3 7.3 0 0 0-1.62-.94L14.4 2.8a.5.5 0 0 0-.49-.4h-3.84a.5.5 0 0 0-.49.4l-.36 2.52c-.58.23-1.12.54-1.62.94l-2.39-.96a.5.5 0 0 0-.6.22L2.7 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.03.31-.05.62-.05.94 0 .32.02.63.05.94L2.82 14.5a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.4 1.04.72 1.62.94l.36 2.52a.5.5 0 0 0 .49.4h3.84a.5.5 0 0 0 .49-.4l.36-2.52c.58-.23 1.12-.54 1.62-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.56ZM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z"
        />
      </svg>
    );
  }

  if (name === "users") {
    return (
      <svg viewBox="0 0 24 24" className={iconClass} aria-hidden="true">
        <path
          fill="currentColor"
          d="M16 11a4 4 0 1 0-3.999-4A4 4 0 0 0 16 11Zm-8 0a3 3 0 1 0-3-3 3 3 0 0 0 3 3Zm0 2c-2.67 0-8 1.34-8 4v1h10v-1c0-1.34.5-2.5 1.4-3.4A11.5 11.5 0 0 0 8 13Zm8 0c-2.67 0-8 1.34-8 4v3h16v-3c0-2.66-5.33-4-8-4Z"
        />
      </svg>
    );
  }

  if (name === "logout") {
    return (
      <svg viewBox="0 0 24 24" className={iconClass} aria-hidden="true">
        <path
          fill="currentColor"
          d="M10 17v-2h5V9h-5V7h7v10h-7Zm-7 2V5a2 2 0 0 1 2-2h7v2H5v14h7v2H5a2 2 0 0 1-2-2Zm14.59-3.59L19 14l4-4-4-4-1.41 1.41L19.17 9H11v2h8.17l-1.58 1.59Z"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className={iconClass} aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 3 3 10h2v10h5v-6h4v6h5V10h2l-9-7Z"
      />
    </svg>
  );
}

export default function AppLayout({ title, children }) {
  const { currentUser, logout } = useAuth();
  const isUser = currentUser?.role === "user";
  const links = currentUser?.role === "admin" ? adminLinks : userLinks;

  const visibleLinks = useMemo(() => links, [links]);

  if (isUser) {
    return (
      <div className="household-shell">
        <header className="household-nav">
          <Link className="household-brand" to="/user/home">
            <span className="household-brand-plus">+</span>
            <span>Tech smart</span>
            <span className="household-brand-accent">Bin</span>
          </Link>

          <nav className="household-nav-links" aria-label="Household navigation">
            <NavLink
              to="/user/home"
              className={({ isActive }) =>
                isActive ? "household-nav-link active" : "household-nav-link"
              }
            >
              Home
            </NavLink>
            <Link className="household-nav-link" to="/user/home#about">
              About Us
            </Link>
            <NavLink
              to="/user/redeem"
              className={({ isActive }) =>
                isActive ? "household-nav-link active" : "household-nav-link"
              }
            >
              Rewards
            </NavLink>
          </nav>

          <button
            type="button"
            className="household-profile-btn"
            onClick={logout}
            title="Logout"
            aria-label="Logout"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="7.5" r="4.2" />
              <path d="M4 21a8 8 0 0 1 16 0" />
            </svg>
          </button>
        </header>
        <main className="household-main">{children}</main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="adm-sidebar">
        <div className="adm-sidebar-brand">
          <div className="adm-sidebar-logo">
            <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
              <path d="M5 6l1.5 14h11L19 6H5Z" fill="#ffffff" opacity="0.9"/>
              <path d="M10 10v6M14 10v6" stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round"/>
              <path d="M3 6h18" stroke="#ffffff" strokeWidth="2" strokeLinecap="round"/>
              <path d="M9 6V4h6v2" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </div>
          <span className="adm-sidebar-brand-text">smartBin <span className="adm-sidebar-brand-role">Admin</span></span>
        </div>

        <p className="adm-sidebar-section-label">MAIN MENU</p>

        <nav className="adm-sidebar-nav">
          {visibleLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                isActive ? "adm-nav-link adm-nav-link--active" : "adm-nav-link"
              }
            >
              <span className="adm-nav-icon">
                <MenuIcon name={link.icon} />
              </span>
              <span>{link.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="adm-sidebar-footer">
          <button type="button" className="adm-logout-btn" onClick={logout}>
            <MenuIcon name="logout" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <div className="main-panel adm-main-panel">
        <header className="top-bar">
          <div>
            <p className="muted-text">Unified Login Session</p>
            <h1>{title}</h1>
          </div>
          <div className="top-actions">
            <NotificationBell />
            <button type="button" className="top-logout-mobile" onClick={logout}>
              Logout
            </button>
          </div>
        </header>

        <main className="content-grid">{children}</main>
      </div>

      <nav className="bottom-nav">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              isActive ? "bottom-nav-link bottom-nav-link-active" : "bottom-nav-link"
            }
          >
            <MenuIcon name={link.icon} className="bottom-nav-icon" />
            <span>{link.mobileLabel || link.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
