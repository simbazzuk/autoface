import Link from "next/link";

const plans = [
  {
    name: "AutoFace Free",
    price: "£0",
    cadence: "forever",
    eyebrow: "START HERE",
    description: "The essential AutoFace experience. Meet people through considered introductions rather than endless swiping.",
    featured: false,
    cta: "Create free account",
    href: "/register",
    features: [
      "Create your member profile",
      "Atlas relationship profile",
      "Authenticity profile",
      "Compatibility score & explanation",
      "Limited Atlas Daily Discovery",
      "Mutual introductions",
      "Messaging after mutual interest",
      "Core safety & privacy controls",
    ],
  },
  {
    name: "AutoFace+",
    price: "£9.99",
    cadence: "per month",
    eyebrow: "PLANNED",
    description: "For members who want more considered discovery and the full explainable Atlas experience.",
    featured: true,
    cta: "Included during beta",
    href: "/register",
    features: [
      "Everything in AutoFace Free",
      "Daily Atlas Discovery",
      "Unlimited Save for later",
      "Full recommendation history",
      "Full compatibility explanations",
      "Atlas AI Discovery",
      "AI conversation starters",
      "Expanded Discovery preferences",
    ],
  },
  {
    name: "Atlas Premium",
    price: "£19.99",
    cadence: "per month",
    eyebrow: "FUTURE",
    description: "A deeper Atlas experience for members who value richer insight around particularly promising introductions.",
    featured: false,
    cta: "Coming later",
    href: "/how-it-works",
    features: [
      "Everything in AutoFace+",
      "Deeper Atlas relationship insights",
      "Expanded Atlas Introduction Coach",
      "Additional considered introductions",
      "Future premium compatibility reports",
      "Future verification benefits",
      "Early access to new Atlas capabilities",
    ],
  },
];

const principles = [
  ["Messaging stays human", "Mutual-interest messaging is not designed as a premium gate."],
  ["Safety is never premium", "Blocking, reporting, privacy and account-protection controls remain part of the core product."],
  ["Pay for intelligence, not attention", "AutoFace plans to charge for deeper Atlas capability rather than boosts, popularity or visibility tricks."],
];

export default function PricingPage() {
  return (
    <main>
      <section className="pricing-hero">
        <div className="container pricing-hero-inner">
          <span className="eyebrow">Simple, considered pricing</span>
          <h1>Pay for better insight.<br/><span>Not more swipes.</span></h1>
          <p className="lead">
            AutoFace is currently in controlled beta, so founding members can explore the product without a subscription.
            These planned tiers show how pricing may work after beta.
          </p>
          <div className="pricing-beta-banner">
            <span>FOUNDING MEMBER BETA</span>
            <b>Premium capabilities are currently unlocked for testing.</b>
            <small>No subscription payment is required during the controlled beta.</small>
          </div>
        </div>
      </section>

      <section className="section pricing-section">
        <div className="container">
          <div className="pricing-grid">
            {plans.map((plan) => (
              <article className={`pricing-card ${plan.featured ? "featured" : ""}`} key={plan.name}>
                {plan.featured && <div className="pricing-popular">PLANNED CORE PLAN</div>}
                <span className="privacy-kicker">{plan.eyebrow}</span>
                <h2>{plan.name}</h2>
                <p className="pricing-description">{plan.description}</p>
                <div className="pricing-price">
                  <strong>{plan.price}</strong>
                  <span>{plan.cadence}</span>
                </div>
                <Link className={`btn ${plan.featured ? "btn-relationship" : ""}`} href={plan.href}>{plan.cta}</Link>
                <div className="pricing-feature-list">
                  {plan.features.map((feature) => <span key={feature}><i>✓</i>{feature}</span>)}
                </div>
              </article>
            ))}
          </div>

          <div className="pricing-principles">
            <div className="pricing-principles-head">
              <span className="privacy-kicker">THE AUTOFACE APPROACH</span>
              <h2>Some things should never depend on what you pay.</h2>
              <p>AutoFace is being designed around considered introductions, trust and member control — not artificial scarcity.</p>
            </div>
            <div className="pricing-principle-grid">
              {principles.map(([title,copy]) => (
                <div className="pricing-principle" key={title}>
                  <span>✦</span>
                  <div><h3>{title}</h3><p>{copy}</p></div>
                </div>
              ))}
            </div>
          </div>

          <div className="pricing-verification card">
            <div>
              <span className="privacy-kicker">OPTIONAL SERVICES · FUTURE</span>
              <h2>Facial verification may be offered separately.</h2>
              <p>
                AutoFace is exploring specialist-provider facial verification as an optional authenticity service.
                Final pricing will depend on provider costs. Facial verification will never affect compatibility or who Atlas recommends.
              </p>
            </div>
            <span className="coming-soon">COMING SOON</span>
          </div>

          <div className="pricing-faq">
            <span className="privacy-kicker">BETA PRICING</span>
            <h2>Nothing to pay yet.</h2>
            <p>
              Pricing is indicative while AutoFace is in controlled beta. Plans, features and prices can change before commercial launch.
              The priority now is learning which capabilities members genuinely value.
            </p>
            <div className="hero-actions">
              <Link className="btn btn-primary" href="/register">Join the beta</Link>
              <Link className="btn" href="/how-it-works">See how AutoFace works</Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
