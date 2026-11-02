import { useLayoutEffect, useRef } from "react";
import { NavLink, useLocation } from "react-router-dom";

const publicLinks = [
  { to: "/", label: "Home", icon: "home" },
  { to: "/rewards", label: "Rewards", icon: "redeem" },
  { to: "/about-us", label: "About Us", icon: "info" },
];

// Each page builds its own menu, so the last active tab is kept here for the
// circle to slide from.
let lastSlidingIndex = null;

// Bottom navigation on phones; also used for signed-in residents with their own links.
// With `sliding`, a green circle slides to the active tab.
export default function PublicMobileNav({
  links = publicLinks,
  label = "Mobile primary navigation",
  sliding = false,
}) {
  const { pathname } = useLocation();
  const sliderRef = useRef(null);
  const activeIndex = sliding ? links.findIndex((link) => link.to === pathname) : -1;

  useLayoutEffect(() => {
    const slider = sliderRef.current;
    if (!slider) return;
    if (lastSlidingIndex !== null && lastSlidingIndex !== activeIndex) {
      // Start from the previous tab, then let the CSS transition run to this one.
      slider.style.transition = "none";
      slider.style.setProperty("--active-index", lastSlidingIndex);
      slider.getBoundingClientRect();
      slider.style.transition = "";
    }
    slider.style.setProperty("--active-index", activeIndex);
    lastSlidingIndex = activeIndex;
  }, [activeIndex]);

  return (
    <nav className="public-mobile-nav" aria-label={label}>
      {activeIndex >= 0 ? (
        <span
          ref={sliderRef}
          className="public-mobile-nav__slider"
          style={{ "--tab-count": links.length }}
          aria-hidden="true"
        />
      ) : null}
      {links.map(({ to, label: linkLabel, icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end ?? to === "/"}
          className={({ isActive }) =>
            `public-mobile-nav__link${isActive ? " is-active" : ""}`
          }
        >
          <span className="material-symbols-outlined" aria-hidden="true">{icon}</span>
          <span>{linkLabel}</span>
        </NavLink>
      ))}
    </nav>
  );
}
