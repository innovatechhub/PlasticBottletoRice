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
    </div>
  );
}
