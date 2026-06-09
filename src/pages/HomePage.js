import PublicSiteLayout from "../components/PublicSiteLayout";
import { useNavigate } from "react-router-dom";

const steps = [
  {
    icon: "delete_sweep",
    title: "1. Collect Plastic",
    copy:
      "Gather household and community plastic waste. PET bottles, packaging, and clean scraps all count.",
  },
  {
    icon: "location_on",
    title: "2. Bring to Station",
    copy:
      "Visit an EcoRice kiosk, scan your QR ID, and submit your collected items for validation.",
  },
  {
    icon: "eco",
    title: "3. Receive Rice",
    copy:
      "Get organic rice immediately or earn credits toward longer-term community rewards.",
  },
];

function SectionHeading({ title, copy }) {
  return (
    <div className="eco-landing__section-heading">
      <h2 className="eco-landing__section-title">{title}</h2>
      {copy ? <p className="eco-landing__section-copy">{copy}</p> : null}
    </div>
  );
}

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <PublicSiteLayout>
      <main>
        <section className="eco-landing__hero eco-landing__hero--banner" id="home">
          <div className="eco-landing__hero-banner">
            <div className="eco-landing__hero-banner-glow" />
            <div className="eco-landing__hero-banner-icon" aria-hidden="true">
              <span className="material-symbols-outlined">delete</span>
            </div>
            <h1 className="eco-landing__title eco-landing__title--banner">
              <span className="eco-landing__title-plus">+Eco</span>{" "}
              <span className="eco-landing__title-main">Rice</span>{" "}
              <span className="eco-landing__title-accent">Bottle</span>
            </h1>
            <p className="eco-landing__subtitle eco-landing__subtitle--banner">
              Encouraging Recycling Through <strong>Technology</strong> &amp;{" "}
              <strong>Rewards</strong>
            </p>

            <div className="eco-landing__hero-actions eco-landing__hero-actions--banner">
              <button
                type="button"
                className="eco-landing__btn eco-landing__btn--primary eco-landing__btn--banner-primary"
                onClick={() => navigate("/login")}
              >
                Get Started
              </button>
              <a className="eco-landing__btn eco-landing__btn--outline" href="#how-it-works">
                Learn More
              </a>
            </div>
          </div>
        </section>

        <section className="eco-landing__section eco-landing__section--soft" id="how-it-works">
          <div className="eco-landing__section-inner">
            <SectionHeading
              title="How it Works"
              copy="Simple steps to make a global impact."
            />

            <div className="eco-landing__grid-3">
              {steps.map((step) => (
                <article key={step.title} className="eco-landing__card">
                  <div className="eco-landing__card-icon">
                    <span
                      className="material-symbols-outlined"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      {step.icon}
                    </span>
                  </div>
                  <h3 className="eco-landing__card-title">{step.title}</h3>
                  <p className="eco-landing__card-copy">{step.copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="eco-landing__section eco-landing__cta">
          <div className="eco-landing__section-inner">
            <div className="eco-landing__cta-panel">
              <h2 className="eco-landing__cta-title">Join the Movement</h2>
              <p className="eco-landing__cta-copy">
                Be the change in your community. Start collecting plastic today and earn
                rewards while helping us build a cleaner, better-fed world.
              </p>
              <div className="eco-landing__cta-actions">
                <button
                  type="button"
                  className="eco-landing__btn eco-landing__btn--primary"
                  onClick={() => navigate("/login")}
                >
                  Find a Station
                  <span className="material-symbols-outlined">map</span>
                </button>
                <button
                  type="button"
                  className="eco-landing__btn eco-landing__btn--outline"
                  onClick={() => navigate("/rewards")}
                >
                  View Rewards
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </PublicSiteLayout>
  );
}
