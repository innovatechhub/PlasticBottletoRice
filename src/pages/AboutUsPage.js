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
  return (
    <PublicSiteLayout>
      <main>
        <section
          className="eco-landing__hero"
          style={{
            backgroundImage: `linear-gradient(180deg, rgba(0, 45, 20, 0.42) 0%, rgba(2, 56, 28, 0.68) 100%), url(${process.env.PUBLIC_URL}/PageUI.png)`,
            backgroundPosition: "center center",
            backgroundRepeat: "no-repeat",
            backgroundSize: "cover",
          }}
        >
          <div className="eco-landing__hero-inner">
            <div className="eco-landing__hero-copy-panel">
              <span className="eco-landing__eyebrow">About EcoRice</span>
              <h1 className="eco-landing__title eco-landing__title--banner">
                Cultivating Change, One Grain at a Time.
              </h1>
              <p className="eco-landing__subtitle eco-landing__subtitle--banner">
                EcoRice bridges the gap between environmental responsibility and social
                welfare through innovative circular economy solutions.
              </p>
            </div>

            <div className="eco-landing__hero-visual">
              <div className="eco-landing__hero-card">
                <img
                  alt="A vast emerald green rice terrace landscape"
                  src="https://lh3.googleusercontent.com/aida/AP1WRLvBK-wN9OTq9O_M4ud3h9wM15F1a3UgHp_6j7XrRdDq64JmdJpBt4oCxcqPm0Ezb9tvN0tUA6k_-SefgNYSNMvJyf0vr-e4dZe4oUZl4icbe07FYyvwu44zk0COIepu0H5VeLBsHI1YqmW7GcJpajZG8Y77p2WDftwMy9x62Thzt0g9tS9JMZveKLVzUq4s8jRtNUx0uRh_xK0yDl2NtSc2hqboyDFtAh1mGf6QGQ1re-slo5OEX9YhV0g"
                />
                <div className="eco-landing__hero-card-overlay" />
                <div className="eco-landing__hero-badge">Our Story</div>
              </div>
            </div>
          </div>
        </section>

        <section className="eco-about-smartbin eco-about-smartbin--light">
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
