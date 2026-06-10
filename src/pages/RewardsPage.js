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
              <a className="eco-landing__btn eco-landing__btn--outline" href="#rewards-details">
                Learn More
              </a>
            </div>
          </div>
        </section>

        <section className="eco-landing__section eco-landing__section--soft" id="rewards-details">
          <div className="eco-landing__section-inner eco-landing__rewards-layout">
            <div className="eco-landing__panel">
              <h3 className="eco-landing__panel-title">Live Impact Tracker</h3>
              <div className="eco-landing__progress-group">
                <div className="eco-landing__progress-row">
                  <div className="eco-landing__progress-row-head">
                    <span>Plastic Collected</span>
                    <strong>12,450 kg</strong>
                  </div>
                  <div className="eco-landing__progress-track" aria-hidden="true">
                    <div className="eco-landing__progress-fill" style={{ width: "75%" }} />
                  </div>
                </div>
                <div className="eco-landing__progress-row">
                  <div className="eco-landing__progress-row-head">
                    <span>Rice Distributed</span>
                    <strong>2,490 kg</strong>
                  </div>
                  <div className="eco-landing__progress-track" aria-hidden="true">
                    <div
                      className="eco-landing__progress-fill eco-landing__progress-fill--tertiary"
                      style={{ width: "60%" }}
                    />
                  </div>
                </div>
              </div>
              <div className="eco-landing__impact-grid">
                <div className="eco-landing__impact-card eco-landing__impact-card--green">
                  <p className="eco-landing__impact-label">Ratio</p>
                  <div className="eco-landing__impact-value">5:1</div>
                  <p className="eco-landing__impact-note">Plastic to Rice</p>
                </div>
                <div className="eco-landing__impact-card eco-landing__impact-card--amber">
                  <p className="eco-landing__impact-label">Families Fed</p>
                  <div className="eco-landing__impact-value">840+</div>
                  <p className="eco-landing__impact-note">This Month</p>
                </div>
              </div>
            </div>

            <div className="eco-landing__panel">
              <h3 className="eco-landing__panel-title">Your Waste is Wealth</h3>
              <p className="eco-landing__section-copy" style={{ textAlign: "left", marginTop: 0 }}>
                Our algorithm ensures fair distribution based on local needs. The more
                you recycle, the more we can provide sustainable, high-protein rice to
                families across the region.
              </p>
              <ul className="eco-landing__checklist">
                <li className="eco-landing__checklist-item">
                  <span className="material-symbols-outlined">check_circle</span>
                  <span>10kg Plastic = 2kg High-Grade Rice</span>
                </li>
                <li className="eco-landing__checklist-item">
                  <span className="material-symbols-outlined">check_circle</span>
                  <span>Bonus rewards for sorted PET bottles</span>
                </li>
                <li className="eco-landing__checklist-item">
                  <span className="material-symbols-outlined">check_circle</span>
                  <span>Community leaderboard and annual prizes</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section className="eco-landing__section eco-landing__section--soft">
          <div className="eco-landing__section-inner eco-landing__grid-2">
            <div className="eco-landing__panel">
              <h3 className="eco-landing__panel-title">
                <span className="material-symbols-outlined" style={{ verticalAlign: "text-bottom" }}>
                  trophy
                </span>{" "}
                Community Heroes
              </h3>
              <div className="eco-landing__progress-group">
                <div className="eco-landing__progress-row">
                  <div className="eco-landing__progress-row-head">
                    <span>1. Anita Mendoza</span>
                    <strong>12.4k</strong>
                  </div>
                  <div className="eco-landing__progress-track" aria-hidden="true">
                    <div className="eco-landing__progress-fill" style={{ width: "90%" }} />
                  </div>
                </div>
                <div className="eco-landing__progress-row">
                  <div className="eco-landing__progress-row-head">
                    <span>2. Roberto Tan</span>
                    <strong>11.1k</strong>
                  </div>
                  <div className="eco-landing__progress-track" aria-hidden="true">
                    <div className="eco-landing__progress-fill" style={{ width: "82%" }} />
                  </div>
                </div>
                <div className="eco-landing__progress-row">
                  <div className="eco-landing__progress-row-head">
                    <span>3. Siti Larasati</span>
                    <strong>9.8k</strong>
                  </div>
                  <div className="eco-landing__progress-track" aria-hidden="true">
                    <div className="eco-landing__progress-fill" style={{ width: "72%" }} />
                  </div>
                </div>
              </div>
            </div>

            <div className="eco-landing__panel">
              <h3 className="eco-landing__panel-title">How to Earn</h3>
              <ul className="eco-landing__checklist">
                <li className="eco-landing__checklist-item">
                  <span className="material-symbols-outlined">recycling</span>
                  <span>PET Plastics (1kg = 50 Credits)</span>
                </li>
                <li className="eco-landing__checklist-item">
                  <span className="material-symbols-outlined">shopping_bag</span>
                  <span>HDPE Plastics (1kg = 35 Credits)</span>
                </li>
                <li className="eco-landing__checklist-item">
                  <span className="material-symbols-outlined">volunteer_activism</span>
                  <span>Community bonus for cleanup drives</span>
                </li>
              </ul>
              <div className="eco-landing__impact-grid" style={{ marginTop: "22px" }}>
                <div className="eco-landing__impact-card eco-landing__impact-card--green">
                  <p className="eco-landing__impact-label">Plastic Collected</p>
                  <div className="eco-landing__impact-value">14.2t</div>
                  <p className="eco-landing__impact-note">Global</p>
                </div>
                <div className="eco-landing__impact-card eco-landing__impact-card--amber">
                  <p className="eco-landing__impact-label">Families Fed</p>
                  <div className="eco-landing__impact-value">8,500</div>
                  <p className="eco-landing__impact-note">Worldwide</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </PublicSiteLayout>
  );
}
