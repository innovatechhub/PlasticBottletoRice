import { NavLink } from "react-router-dom";

const links = [
  { to: "/", label: "Home", icon: "home" },
  { to: "/rewards", label: "Rewards", icon: "redeem" },
  { to: "/about-us", label: "About Us", icon: "info" },
];

export default function PublicMobileNav() {
  return (
    <nav className="public-mobile-nav" aria-label="Mobile primary navigation">
      {links.map(({ to, label, icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/"}
          className={({ isActive }) =>
            `public-mobile-nav__link${isActive ? " is-active" : ""}`
          }
        >
          <span className="material-symbols-outlined" aria-hidden="true">{icon}</span>
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
