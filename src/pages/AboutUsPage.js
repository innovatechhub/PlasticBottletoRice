import PublicSiteLayout from "../components/PublicSiteLayout";

const rows = [
  {
    title: "How it works",
    copy: "Insert bottles at an EcoRice bin. Their weight is added to your balance.",
  },
  {
    title: "Why it matters",
    copy: "Fewer bottles end up in streets and rivers.",
  },
  {
    title: "Who can join",
    copy: "Residents of Tibiao, Antique, with an account from their barangay admin.",
  },
];

export default function AboutUsPage() {
  return (
    <PublicSiteLayout>
      <section className="pub-hero pub-hero--text">
        <div className="pub-hero__text">
          <h1 className="pub-title">About EcoRice</h1>
          <p className="pub-lead">
            A smart recycling system that turns plastic bottles into rice rewards in Tibiao,
            Antique.
          </p>
        </div>
      </section>

      <section className="pub-section">
        <dl className="pub-rows">
          {rows.map((row) => (
            <div key={row.title} className="pub-rows__item">
              <dt>{row.title}</dt>
              <dd>{row.copy}</dd>
            </div>
          ))}
        </dl>
      </section>
    </PublicSiteLayout>
  );
}
