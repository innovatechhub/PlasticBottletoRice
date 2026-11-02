import { Link } from "react-router-dom";
import { useAuth } from "../app/AuthContext";
import PublicSiteLayout from "../components/PublicSiteLayout";
import { accountHome } from "../utils/routes";

const steps = ["Collect bottles", "Insert in bin", "Get rice"];

export default function HomePage() {
  const { currentUser } = useAuth();

  return (
    <PublicSiteLayout>
      <section className="pub-hero">
        <div className="pub-hero__text">
          <h1 className="pub-title">Bottles for rice</h1>
          <p className="pub-lead">Recycle in Tibiao. Earn rice.</p>
          {currentUser ? (
            <Link className="eco-btn eco-btn--primary pub-hero__cta" to={accountHome(currentUser)}>
              Go to account
            </Link>
          ) : (
            <Link className="eco-btn eco-btn--primary pub-hero__cta" to="/login">
              Log in
            </Link>
          )}
        </div>
        <img
          className="pub-hero__image"
          src={`${process.env.PUBLIC_URL}/PageUI.png`}
          alt="A hand putting a plastic bottle into a recycling bin"
          width="1189"
          height="670"
        />
      </section>

      <section className="pub-section" aria-labelledby="steps-heading">
        <h2 id="steps-heading" className="pub-section__title">
          How it works
        </h2>
        <ol className="pub-steps">
          {steps.map((step) => (
            <li key={step} className="pub-steps__item">
              {step}
            </li>
          ))}
        </ol>
      </section>
    </PublicSiteLayout>
  );
}
