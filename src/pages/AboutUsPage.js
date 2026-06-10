import { useNavigate } from "react-router-dom";
import PublicSiteLayout from "../components/PublicSiteLayout";

const timeline = [
  {
    year: "2022",
    title: "The Spark of an Idea",
    copy:
      "EcoRice was founded in response to the dual crisis of plastic-clogged waterways and rising food costs in coastal regions.",
  },
  {
    year: "2023 Q1",
    title: "Scale Up",
    copy: "Partnered with 50 local farmers to source regenerative rice.",
  },
  {
    year: "2023 Q3",
    title: "Milestone",
    copy: "10,000kg of plastic diverted from oceans in just six months.",
  },
  {
    year: "2024",
    title: "Nationwide Network",
    copy: "Connecting major urban centers with sustainable agricultural hubs.",
  },
];

export default function AboutUsPage() {
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
              <span className="material-symbols-outlined">eco</span>
            </div>
            <span className="eco-landing__eyebrow">About EcoRice</span>
            <h1 className="eco-landing__title eco-landing__title--banner">
              Cultivating Change, One Grain at a Time.
            </h1>
            <p className="eco-landing__subtitle eco-landing__subtitle--banner">
              EcoRice bridges the gap between environmental responsibility and social
              welfare through innovative circular economy solutions.
            </p>

            <div className="eco-landing__hero-actions eco-landing__hero-actions--banner">
              <button
                type="button"
                className="eco-landing__btn eco-landing__btn--primary eco-landing__btn--banner-primary"
                onClick={() => navigate("/login")}
              >
                Get Started
              </button>
              <a className="eco-landing__btn eco-landing__btn--outline" href="#our-purpose">
                Learn More
              </a>
            </div>
          </div>
        </section>

        <section className="eco-landing__section eco-landing__section--soft" id="our-purpose">
          <div className="eco-landing__section-inner eco-landing__about">
            <div>
              <span className="eco-landing__section-kicker">Our Purpose</span>
              <h2 className="eco-landing__section-title">A Mission to Restore and Nourish</h2>
              <p className="eco-landing__section-copy" style={{ textAlign: "left", marginLeft: 0 }}>
                At EcoRice, we believe that the solution to plastic pollution should not
                be a burden, but a bridge to community resilience. Our mission is to
                transform discarded plastic into a currency for nutrition, creating a
                self-sustaining cycle that benefits both the planet and its people.
              </p>
              <div className="eco-landing__grid-2" style={{ marginTop: "24px" }}>
                <div className="eco-landing__card" style={{ textAlign: "left" }}>
                  <h3 className="eco-landing__card-title">Vision</h3>
                  <p className="eco-landing__card-copy">
                    A world where plastic waste is a relic of the past and food security
                    is a universal reality for every community.
                  </p>
                </div>
                <div className="eco-landing__card" style={{ textAlign: "left" }}>
                  <h3 className="eco-landing__card-title">Commitment</h3>
                  <p className="eco-landing__card-copy">
                    We pledge transparency in our impact reporting and ethical sourcing
                    for all our rice distribution programs.
                  </p>
                </div>
              </div>
            </div>

            <div className="eco-landing__about-card">
              <div className="eco-landing__about-grid">
                <img
                  alt="A close-up of hands holding rice grains"
                  src="https://lh3.googleusercontent.com/aida/AP1WRLsNzlBoO3sOLbJepBsKECWAPi7qFRB-rQuzrZxVG-_3rGtNBdWe4bHLEJ-CBEfYPSwmnffsRIDGR3mXRYcKNthi_g8KqDoczPGkQD7l09mC5wW2W6JwwpFGew8RtfJW9D7FqLDDxuDZizadVc-EU2T5mM7SSK8ff-gGx67ANgcxAbHk6UzHZu67XST4cTGhEjBH_qZGiihdXeKWJ7ARR3wCIr-u3xdLFDL_5r1kNQfa0e8kbRpqPzkO8Q"
                  loading="lazy"
                />
                <img
                  alt="Community recycling facility"
                  src="https://lh3.googleusercontent.com/aida/AP1WRLvaToRrOVO7nhomwZcY-do28P9mRpPJ4zJglTcc-QNoM4Iq4-BvVPEMJ9gjszQf3vpxHMlNyLie8uN1NyrjI1t9zbYFwcSmTfEJdVHbpuJBr-sZyGDL3cswPbRwmnQ59CwScKYL2fM9OjrMTwuxN2F7YeBK4-H-J4dxZ5XsYKt_clCmwG6vSHRqv0oYlNdAVGfjZ-rp-faewHSKug61z8xDWg6ya2eQeJ_PGr32CXSgwHazv48SJ9eah8E"
                  loading="lazy"
                />
              </div>
              <p className="eco-landing__about-note">
                Every kilogram of plastic collected provides measurable support for food
                security and environmental restoration.
              </p>
            </div>
          </div>
        </section>

        <section className="eco-landing__section">
          <div className="eco-landing__section-inner">
            <div className="eco-landing__section-heading">
              <span className="eco-landing__section-kicker">Our Journey Since 2022</span>
              <h2 className="eco-landing__section-title">From a Small Pilot to a National Movement</h2>
              <p className="eco-landing__section-copy">
                EcoRice started with a single collection point and a simple question:
                what if waste could become nourishment?
              </p>
            </div>

            <div className="eco-landing__grid-2">
              {timeline.map((item) => (
                <article key={item.title} className="eco-landing__card" style={{ textAlign: "left" }}>
                  <span className="eco-landing__section-kicker">{item.year}</span>
                  <h3 className="eco-landing__card-title">{item.title}</h3>
                  <p className="eco-landing__card-copy">{item.copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="eco-landing__section eco-landing__section--soft">
          <div className="eco-landing__section-inner">
            <div className="eco-landing__section-heading">
              <span className="eco-landing__section-kicker">Our Network</span>
              <h2 className="eco-landing__section-title">Powered by Collaboration</h2>
              <p className="eco-landing__section-copy">
                We work with industry leaders and grassroots organizations to amplify
                our reach and ensure long-term sustainability.
              </p>
            </div>

            <div className="eco-landing__grid-3">
              {["GREENCO", "AGRILIFE", "OCEANFIX"].map((name) => (
                <div key={name} className="eco-landing__card">
                  <h3 className="eco-landing__card-title">{name}</h3>
                  <p className="eco-landing__card-copy">Strategic sustainability partner.</p>
                </div>
              ))}
            </div>
          </div>
        </section>

      </main>
    </PublicSiteLayout>
  );
}
