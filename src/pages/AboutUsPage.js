import { useNavigate } from "react-router-dom";
import PublicSiteLayout from "../components/PublicSiteLayout";

const smartBinBlocks = [
  {
    title: "What is smartBin?",
    copy:
      "EcoRice is an IoT-based recycling and rewards system designed to tackle plastic waste in Tibiao, Antique. Our goal is to make recycling a habit by making it easy, rewarding, and trackable.",
  },
  {
    title: "What it does?",
    copy:
      "The system detects bottles using sensors and associates each detection with a unique Bin ID. Users identify the EcoRice by entering its Bin ID to claim points, which can then be redeemed for rewards. Users can also report illegal dumping with photos and GPS.",
  },
  {
    title: "Why it matters?",
    copy:
      "The Philippines generates over 60,000 tons of waste daily, much of it plastic. EcoRice motivates recycling, supports government monitoring, and empowers communities.",
  },
  {
    title: "Who it's for?",
    copy:
      "EcoRice is designed for residents of All barangays in the Municipality of Tibiao, Antique.",
  },
];

const missionVisionBlocks = [
  {
    icon: "target",
    title: "Our Mission",
    copy:
      "To revolutionize waste management through innovative technology and community engagement, making recycling accessible, rewarding, and measurable for everyone.",
    tone: "green",
  },
  {
    icon: "visibility",
    title: "Our Vision",
    copy:
      "A future where environmental stewardship is seamlessly integrated into daily life, powered by smart technology and sustained by community participation.",
    tone: "amber",
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
              <a className="eco-landing__btn eco-landing__btn--outline" href="#smartbin">
                Learn More
              </a>
            </div>
          </div>
        </section>

        <section className="eco-about-smartbin eco-about-smartbin--light" id="smartbin">
          <div className="eco-about-smartbin__inner">
            <div className="eco-about-smartbin__grid">
              {smartBinBlocks.slice(0, 2).map((block) => (
                <article key={block.title} className="eco-about-smartbin__item">
                  <h2 className="eco-about-smartbin__title">{block.title}</h2>
                  <p className="eco-about-smartbin__copy">{block.copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="eco-about-smartbin eco-about-smartbin--soft">
          <div className="eco-about-smartbin__inner">
            <div className="eco-about-smartbin__grid">
              {smartBinBlocks.slice(2).map((block) => (
                <article key={block.title} className="eco-about-smartbin__item">
                  <h2 className="eco-about-smartbin__title">{block.title}</h2>
                  <p className="eco-about-smartbin__copy">{block.copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="eco-about-values">
          <div className="eco-about-values__inner">
            {missionVisionBlocks.map((block) => (
              <article
                key={block.title}
                className={`eco-about-values__card eco-about-values__card--${block.tone}`}
              >
                <div className="eco-about-values__heading">
                  <span className="eco-about-values__icon" aria-hidden="true">
                    <span className="material-symbols-outlined">{block.icon}</span>
                  </span>
                  <h2 className="eco-about-values__title">{block.title}</h2>
                </div>
                <p className="eco-about-values__copy">{block.copy}</p>
              </article>
            ))}
          </div>
        </section>

      </main>
    </PublicSiteLayout>
  );
}
