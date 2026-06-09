import PublicSiteLayout from "../components/PublicSiteLayout";

export default function RewardsPage() {
  return (
    <PublicSiteLayout>
      <main>
        <section className="eco-landing__hero">
          <div className="eco-landing__hero-inner">
            <div className="eco-landing__hero-copy-panel">
              <span className="eco-landing__eyebrow">Rewards & Impact</span>
              <h1 className="eco-landing__title eco-landing__title--banner">
                Your Impact, Rewarded.
              </h1>
              <p className="eco-landing__subtitle eco-landing__subtitle--banner">
                Turn your plastic waste into Rice Credits. Support your family, help
                your community, and heal the planet one kilogram at a time.
              </p>
            </div>

            <div className="eco-landing__hero-visual">
              <div className="eco-landing__hero-card">
                <img
                  alt="A premium rice bag and community donation products"
                  src="https://lh3.googleusercontent.com/aida/AP1WRLvHhs0AlBhUoRSpdGOm4zXMKnP8yusCalHlPyjZ-25fg9ccdtQvIIUSAdz2TqRt6ny31TphL4237x-tDmDyjiewjp5ki0KVtJ6yAzbsymukDQ7o85efjX9HE5lqIQRdk-Lk2_Vgxn0g_57wAXeTK0E7yREST_1DjjsE_lKnSC4n9Zedt3zOw0cXzlwoH1vwY6Gp8CMddRoDP0dVf4_IXTJ3i34Q0cIFaabdv8CvGIlYoRPIEFpnFuQpcZw"
                />
                <div className="eco-landing__hero-card-overlay" />
                <div className="eco-landing__hero-badge">Rewards Catalog</div>
              </div>
            </div>
          </div>
        </section>

        <section className="eco-landing__section eco-landing__section--soft">
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
