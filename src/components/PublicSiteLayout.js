import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../app/AuthContext";
import BrandMark from "./BrandMark";
import PublicMobileNav from "./PublicMobileNav";
import { accountHome } from "../utils/routes";

const navLinks = [
  { to: "/", label: "Home", end: true },
  { to: "/rewards", label: "Rewards" },
  { to: "/about-us", label: "About Us" },
];

export default function PublicSiteLayout({ children }) {
  const { currentUser } = useAuth();
  const accountPath = accountHome(currentUser);

  return (
    <div className="pub">
      <header className="pub-header">
        <nav className="pub-header__inner" aria-label="Primary">
          <Link className="pub-brand" to="/">
            <BrandMark />
            EcoRice
          </Link>

          <div className="pub-header__links">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) => `pub-header__link${isActive ? " is-active" : ""}`}
              >
                {link.label}
              </NavLink>
            ))}
          </div>

          {currentUser ? (
            <Link className="eco-text-btn" to={accountPath}>
              My account
            </Link>
          ) : (
            <Link className="eco-text-btn" to="/login">
              Log in
            </Link>
          )}
        </nav>
      </header>

      <main className="pub-main">{children}</main>
      <PublicMobileNav />
    </div>
  );
}
