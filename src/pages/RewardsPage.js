import { useNavigate } from "react-router-dom";
import PublicSiteLayout from "../components/PublicSiteLayout";

export default function RewardsPage() {
  const navigate = useNavigate();

  return (
    <PublicSiteLayout>
      <main>
        <section
          className="eco-landing__hero eco-landing__hero--banner"
          style={{
            backgroundImage: `linear-gradient(180deg, rgba(0, 45, 20, 0.42) 0%, rgba(2, 56, 28, 0.68) 100%), url(${process.env.PUBLIC_URL}/PageUI.png)`,
            backgroundPosition: "center center",
            backgroundRepeat: "no-repeat",
            backgroundSize: "cover",
          }}
        >
            <div className="eco-landing__hero-banner">
              <div className="eco-landing__hero-banner-glow" />
              <div className="eco-landing__hero-banner-icon" aria-hidden="true">
                <span className="material-symbols-outlined">redeem</span>
              </div>
            <span className="eco-landing__eyebrow">Rewards & Impact</span>
            <h1 className="eco-landing__title eco-landing__title--banner">
              Your Impact, Rewarded.
            </h1>
            <p className="eco-landing__subtitle eco-landing__subtitle--banner">
              Turn your plastic waste into Rice Credits. Support your family, help
              your community, and heal the planet one kilogram at a time.
            </p>

            <div className="eco-landing__hero-actions eco-landing__hero-actions--banner">
              <button
                type="button"
                className="eco-landing__btn eco-landing__btn--primary eco-landing__btn--banner-primary"
                onClick={() => navigate("/login")}
              >
                Get Started
              </button>
            </div>
          </div>
        </section>

      </main>
    </PublicSiteLayout>
  );
}
