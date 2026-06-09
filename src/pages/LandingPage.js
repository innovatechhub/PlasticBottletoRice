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

const rewardCards = [
  {
    image:
      "https://lh3.googleusercontent.com/aida/AP1WRLvHhs0AlBhUoRSpdGOm4zXMKnP8yusCalHlPyjZ-25fg9ccdtQvIIUSAdz2TqRt6ny31TphL4237x-tDmDyjiewjp5ki0KVtJ6yAzbsymukDQ7o85efjX9HE5lqIQRdk-Lk2_Vgxn0g_57wAXeTK0E7yREST_1DjjsE_lKnSC4n9Zedt3zOw0cXzlwoH1vwY6Gp8CMddRoDP0dVf4_IXTJ3i34Q0cIFaabdv8CvGIlYoRPIEFpnFuQpcZw",
    tag: "Best Seller",
    title: "5kg Premium Jasmine Rice",
    copy: "Sustainably farmed, high-grade jasmine rice for your family kitchen.",
    price: "450 Credits",
    action: "Redeem",
  },
  {
    image:
      "https://lh3.googleusercontent.com/aida/AP1WRLvd3Yf6zms971A3EfCnUXH0AZwbuFCNCVgPrTuobgBBMUzl51U8kAo8-BilFX2js3uK-OIQM-W1-hCTOlnJCrlp6vMbVRsADsBK8ZYC72NZhNZslXelSNebCuudOkUWXD9xe6FwVqVXNjLjZXJlqkZ9d25z3CuQuDY0FLjFusmxxAZMgqUxG-C5iFBcYzzMgOFMB8Rex0Ss8m_0IOPKcuwU1SNKciWwK2IYhm2U1VZQkrKvA-cVLoi9kA",
    tag: "Impact Choice",
    title: "Donate to Local School",
    copy: "Provide 10kg of rice to a local primary school lunch program.",
    price: "800 Credits",
    action: "Donate",
  },
  {
    image:
      "https://lh3.googleusercontent.com/aida/AP1WRLsIBLG605L8epOjOlKywwOQQgfB_DEMNbzktrjGZ6wSBp_I7qthu3ER8yso7tovahq0ILnJ4mXcwHMY47NkTacwwsUepHf6HKYK2Zj8eMieIpK7vh-GBv3427EdKSnG4XdSel5T3E2cr3umeZPUfhPRJcMXl7c6V5ZzpXYJ-7irb7mV6K9Ez_UYzwcs9L6J7cHIIuMZ2NE1zb2WkKTUdbYtd-EUNGC1sbnaIUyBccA_uvmwCFXUOVuffwo",
    tag: "Eco Pick",
    title: "EcoRice Totebag",
    copy: "Heavy-duty recycled canvas for your plastic-free shopping trips.",
    price: "200 Credits",
    action: "Redeem",
  },
];

function SectionHeading({ kicker, title, copy }) {
  return (
    <div className="eco-landing__section-heading">
      {kicker ? <span className="eco-landing__section-kicker">{kicker}</span> : null}
      <h2 className="eco-landing__section-title">{title}</h2>
      {copy ? <p className="eco-landing__section-copy">{copy}</p> : null}
    </div>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="eco-landing">
      <header className="eco-landing__header">
        <nav className="eco-landing__nav" aria-label="Primary">
          <a className="eco-landing__brand" href="#home">
            EcoRice
          </a>

          <div className="eco-landing__nav-links">
            <a className="eco-landing__nav-link" href="#home">
              Home
            </a>
            <a className="eco-landing__nav-link" href="#rewards">
              Rewards
            </a>
            <a className="eco-landing__nav-link" href="#about">
              About Us
            </a>
          </div>

          <div className="eco-landing__nav-actions">
            <button
              type="button"
              className="eco-landing__btn eco-landing__btn--primary"
              onClick={() => navigate("/login")}
            >
              Login
            </button>
          </div>
        </nav>
      </header>

      <main>
        <section className="eco-landing__hero" id="home">
          <div className="eco-landing__hero-inner">
            <div>
              <span className="eco-landing__eyebrow">Pioneering Circularity</span>
              <h1 className="eco-landing__title">
                Exchange Plastic for a Sustainable Future
              </h1>
              <p className="eco-landing__subtitle">
                Transform local waste into essential nutrition. Join a community
                cleaning the planet while feeding those in need, one grain at a time.
              </p>

              <div className="eco-landing__hero-actions">
                <button
                  type="button"
                  className="eco-landing__btn eco-landing__btn--primary"
                  onClick={() => navigate("/login")}
                >
                  Get Started
                  <span className="material-symbols-outlined">arrow_forward</span>
                </button>
                <a className="eco-landing__btn eco-landing__btn--outline" href="#about">
                  Learn More
                </a>
              </div>
            </div>

            <div className="eco-landing__hero-visual">
              <div className="eco-landing__hero-card">
                <img
                  alt="Community members near a modern recycling pavilion in a lush green environment"
                  src="https://lh3.googleusercontent.com/aida/AP1WRLuj0WsEYmfWBHOyhOmD_VSo_8NFzJDtc3VnW-bSBvlEoUTM_wJgPawXOGYPCydzN0iFBLOfJ3ewQP9Mvahg9cgTF2jgQ3_83dpFInBQEskFuHI3JbLMRkHMHQWih9OisgNAbwvWUWBgj0N3dBr7__nuL85k77-wo8osdos4ui1i114bu8rfdQvibYE1PTSJsZLlnTUKs-KNzejWnh0-Bf7qlN5MEqodLhDPypwUP8gwHYMHDAFva7ooIJg"
                />
                <div className="eco-landing__hero-card-overlay" />
                <div className="eco-landing__hero-badge">Exchange Plastic, Earn Rice</div>
                <div className="eco-landing__floating-card">
                  <h3 className="eco-landing__floating-title">Live Impact Tracker</h3>
                  <div className="eco-landing__floating-metrics">
                    <div className="eco-landing__metric">
                      <span className="eco-landing__metric-label">Plastic Collected</span>
                      <strong className="eco-landing__metric-value">12,450 kg</strong>
                    </div>
                    <div className="eco-landing__metric">
                      <span className="eco-landing__metric-label">Families Fed</span>
                      <strong className="eco-landing__metric-value">840+</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="eco-landing__section eco-landing__section--soft">
          <div className="eco-landing__section-inner">
            <SectionHeading
              title="How it Works"
              copy="Simple steps to make a global impact."
            />

            <div className="eco-landing__grid-3">
              {steps.map((step) => (
                <article key={step.title} className="eco-landing__card">
                  <div className="eco-landing__card-icon">
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
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

        <section className="eco-landing__section" id="rewards">
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
          <div className="eco-landing__section-inner">
            <div className="eco-landing__catalog-toolbar">
              <div>
                <h3>Rewards Catalog</h3>
                <p>Redeem your credits for essentials or impact.</p>
              </div>
              <button
                type="button"
                className="eco-landing__text-btn"
                onClick={() => navigate("/login")}
              >
                View All <span className="material-symbols-outlined">arrow_forward</span>
              </button>
            </div>

            <div className="eco-landing__catalog-grid">
              {rewardCards.map((card) => (
                <article key={card.title} className="eco-landing__reward-card">
                  <div className="eco-landing__reward-image">
                    <img alt={card.title} src={card.image} loading="lazy" />
                    <span className="eco-landing__reward-tag">{card.tag}</span>
                  </div>
                  <div className="eco-landing__reward-body">
                    <div>
                      <h4 className="eco-landing__reward-title">{card.title}</h4>
                      <p className="eco-landing__reward-copy">{card.copy}</p>
                    </div>
                    <div className="eco-landing__reward-footer">
                      <span className="eco-landing__reward-price">{card.price}</span>
                      <button
                        type="button"
                        className={`eco-landing__reward-action ${
                          card.action === "Donate" ? "eco-landing__reward-action--secondary" : ""
                        }`}
                        onClick={() => navigate("/login")}
                      >
                        {card.action}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="eco-landing__section eco-landing__section--primary" id="about">
          <div className="eco-landing__section-inner eco-landing__about">
            <div className="eco-landing__about-copy">
              <SectionHeading
                kicker="Roots of Resilience"
                title="A Mission to Restore and Nourish"
                copy="Founded in 2022, EcoRice began with a simple question: how do we solve the twin crises of plastic pollution and food insecurity at the same time?"
              />
              <p className="eco-landing__section-copy" style={{ textAlign: "left", marginTop: 0 }}>
                Our mission is to create a closed-loop system where community members are
                incentivized to protect their environment. By partnering with local
                farmers and recycling partners, we turn waste into life-sustaining
                resources.
              </p>
            </div>

            <div className="eco-landing__about-card">
              <div className="eco-landing__about-grid">
                <img
                  alt="Golden rice fields at sunrise"
                  src="https://lh3.googleusercontent.com/aida/AP1WRLsX0rfzU2QCVHirrsXuotnuh691ChlzyngR1GgZnpdnTrQtzDLQTX9T1N9L1878lydq_BHpNYf0-ZPpCB-Uxytf3uTNXQPTWYpRr_p0oLq7cSvlov3t4i2X5qlP_EZZydGx906PH3FYF9oUahMui8blkOLnFr0ciOYZ1aPn2bxOObmB8qT33Kkecx0Mr-MxYr_puZEW_km9Oyc3kaFu5Ki_k5_ncxF58FU825ZzAupqgd7ly60cqnFEkrY"
                  loading="lazy"
                />
                <img
                  alt="Processed plastic flakes ready for recycling"
                  src="https://lh3.googleusercontent.com/aida/AP1WRLtwoUMBtcUXClKosutgpH6zrvaWuYPyhQq2pnBL1phT49MAo6qooIcMr9yRPP7OR7N19Sg97edwyTl93YiVaAC2CN6aWkf_KZm1xKd7mjFqgo6Zvo--vlSTmVFoHWaGOwlf0eKFAZJvqD2x3p7RgkGtGpaQnS_T-T_Z1HZCCZynhrgFr_N8zHIR4-vEseTzSiOUBl5SurLeFh-itX9pQleJe4y1DB4GGjbO2YXmp6AXlUd7E8Plfb1hPZ0"
                  loading="lazy"
                />
              </div>
              <p className="eco-landing__about-note">
                Every kilogram of plastic collected supports a cleaner environment and
                more families with reliable food access.
              </p>
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
                  onClick={() => navigate("/login")}
                >
                  Partner with Us
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="eco-landing__footer">
        <div className="eco-landing__footer-inner">
          <div className="eco-landing__footer-brand">
            <strong>EcoRice</strong>
            <span>2024 EcoRice Initiative. Cultivating a cleaner planet, one grain at a time.</span>
          </div>

          <div className="eco-landing__footer-links">
            <a className="eco-landing__footer-link" href="#rewards">
              Sustainability Report
            </a>
            <a className="eco-landing__footer-link" href="#rewards">
              Community Impact
            </a>
            <a className="eco-landing__footer-link" href="#about">
              Privacy Policy
            </a>
            <a className="eco-landing__footer-link" href="#about">
              Terms of Service
            </a>
          </div>

          <div className="eco-landing__footer-icons" aria-label="Social links">
            <a className="eco-landing__icon-badge" href="#home" aria-label="Global">
              <span className="material-symbols-outlined">public</span>
            </a>
            <a className="eco-landing__icon-badge" href="#about" aria-label="Volunteer">
              <span className="material-symbols-outlined">volunteer_activism</span>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
