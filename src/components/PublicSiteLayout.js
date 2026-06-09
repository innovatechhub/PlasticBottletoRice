import { Link, NavLink } from "react-router-dom";

export default function PublicSiteLayout({ children }) {
  return (
    <div className="eco-landing">
      <header className="eco-landing__header">
        <nav className="eco-landing__nav" aria-label="Primary">
          <Link className="eco-landing__brand" to="/">
            EcoRice
          </Link>

          <div className="eco-landing__nav-links">
            <NavLink
              className={({ isActive }) =>
                `eco-landing__nav-link${isActive ? " is-active" : ""}`
              }
              to="/"
              end
            >
              Home
            </NavLink>
            <NavLink
              className={({ isActive }) =>
                `eco-landing__nav-link${isActive ? " is-active" : ""}`
              }
              to="/rewards"
            >
              Rewards
            </NavLink>
            <NavLink
              className={({ isActive }) =>
                `eco-landing__nav-link${isActive ? " is-active" : ""}`
              }
              to="/about-us"
            >
              About Us
            </NavLink>
          </div>

          <div className="eco-landing__nav-actions">
            <Link
              className="eco-landing__btn eco-landing__btn--primary eco-landing__btn--login"
              to="/login"
            >
              Login
            </Link>
          </div>
        </nav>
      </header>

      {children}

      <footer className="eco-landing__footer">
        <div className="eco-landing__footer-inner">
          <div className="eco-landing__footer-brand">
            <strong>EcoRice</strong>
            <span>
              2024 EcoRice Initiative. Cultivating a cleaner planet, one grain at a time.
            </span>
          </div>

          <div className="eco-landing__footer-links">
            <Link className="eco-landing__footer-link" to="/rewards">
              Sustainability Report
            </Link>
            <Link className="eco-landing__footer-link" to="/rewards">
              Community Impact
            </Link>
            <Link className="eco-landing__footer-link" to="/about-us">
              Privacy Policy
            </Link>
            <Link className="eco-landing__footer-link" to="/about-us">
              Terms of Service
            </Link>
          </div>

          <div className="eco-landing__footer-icons" aria-label="Social links">
            <Link className="eco-landing__icon-badge" to="/" aria-label="Global">
              <span className="material-symbols-outlined">public</span>
            </Link>
            <Link className="eco-landing__icon-badge" to="/about-us" aria-label="Volunteer">
              <span className="material-symbols-outlined">volunteer_activism</span>
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
