import Link from "next/link";
import { FoundingProgrammePanel } from "@/components/FoundingProgrammePanel";

const plans = [
  {
    name: "AutoFace Free",
    price: "£0",
    cadence: "forever",
    eyebrow: "START HERE",
    description: "Build your profile, complete verification and experience considered introductions without paying to be seen.",
    cta: "Create free account",
    href: "/register",
    features: [
      "Member profile & profile photo",
      "Atlas relationship profile",
      "Core compatibility explanations",
      "Limited considered recommendations",
      "Mutual introductions",
      "5 messages per introduction",
      "Core safety, blocking and privacy controls",
    ],
  },
  {
    name: "Founding Member",
    price: "£0",
    cadence: "lifetime",
    eyebrow: "FIRST 20 VERIFIED MEMBERS",
    featured: true,
    description: "Automatically awarded to the first 20 eligible verified AutoFace members. Founder status cannot be selected or purchased.",
    cta: "Check Founder availability",
    href: "#founding-programme",
    features: [
      "Everything in AutoFace Free",
      "Unlimited messaging",
      "Contact-detail sharing",
      "Full Atlas explanations",
      "Atlas Reflection",
      "Advanced introduction preferences",
      "Full recommendation history",
      "Expanded considered introductions",
      "Permanent Founding Member number",
      "Lifetime launch Founder benefits",
    ],
  },
  {
    name: "AutoFace Plus",
    price: "£7.99",
    cadence: "per month",
    eyebrow: "COMING AFTER FOUNDING",
    description: "The planned paid membership for members who want the fuller Atlas, messaging and discovery experience after the Founder launch.",
    cta: "Coming soon",
    href: "#founding-programme",
    features: [
      "Everything in AutoFace Free",
      "Unlimited messaging",
      "Contact-detail sharing",
      "Full Atlas experience",
      "Advanced preferences",
      "Expanded recommendation access",
      "Full recommendation history",
      "Additional future member insights",
    ],
  },
];

const principles = [
  ["Verification stays accessible", "Core trust and safety should strengthen the whole community, not become a paywall."],
  ["You cannot buy compatibility", "Paying never increases your compatibility score or makes Atlas pretend someone is a better match."],
  ["No pay-to-win visibility", "AutoFace monetises useful capability, not artificial popularity or ranking tricks."],
];

export default function PricingPage() {
  return <main>
    <section className="pricing-hero">
      <div className="container pricing-hero-inner">
        <span className="eyebrow">Launch Founding Programme</span>
        <h1>Help build AutoFace.<br/><span>Be there from the beginning.</span></h1>
        <p className="lead">Every member starts with AutoFace Free. The first 20 members who complete the required profile and verification journey are automatically awarded permanent Founding Member status.</p>
        <div className="pricing-beta-banner">
          <span>FIRST 20 ELIGIBLE VERIFIED MEMBERS</span>
          <b>Founding Member · £0 lifetime launch access</b>
          <small>No Founder purchase button. Complete AutoFace and, while places remain, Founder status is awarded automatically.</small>
        </div>
      </div>
    </section>

    <section className="section pricing-section">
      <div className="container">
        <div className="pricing-grid">
          {plans.map((plan) => <article className={`pricing-card ${plan.featured ? "featured" : ""}`} key={plan.name}>
            {plan.featured && <div className="pricing-popular">FOUNDING MEMBER</div>}
            <span className="privacy-kicker">{plan.eyebrow}</span>
            <h2>{plan.name}</h2>
            <p className="pricing-description">{plan.description}</p>
            <div className="pricing-price"><strong>{plan.price}</strong><span>{plan.cadence}</span></div>
            <Link className={`btn ${plan.featured ? "btn-relationship" : ""}`} href={plan.href}>{plan.cta}</Link>
            <div className="pricing-feature-list">
              {plan.features.map((feature) => <span key={feature}><i>✓</i>{feature}</span>)}
            </div>
          </article>)}
        </div>

        <div className="founding-callout card">
          <div>
            <span className="privacy-kicker">WHY FOUNDING MEMBERS?</span>
            <h2>The first members are helping create the community.</h2>
            <p>Founding Membership recognises the first 20 eligible members who complete their profile, Atlas Profile, profile picture and verification journey. Founder places are allocated automatically and Founder numbers are permanent.</p>
          </div>
          <div className="founding-number"><strong>20</strong><span>permanent founding places</span></div>
        </div>

        <div id="founding-programme">
          <FoundingProgrammePanel />
        </div>

        <div className="pricing-principles">
          <div className="pricing-principles-head">
            <span className="privacy-kicker">THE AUTOFACE APPROACH</span>
            <h2>Some things should never depend on what you pay.</h2>
            <p>Revenue should fund a better product without undermining trust in Atlas or the authenticity model.</p>
          </div>
          <div className="pricing-principle-grid">
            {principles.map(([title, description]) => <div className="pricing-principle" key={title}>
              <span>✦</span>
              <div><h3>{title}</h3><p>{description}</p></div>
            </div>)}
          </div>
        </div>

        <div className="pricing-faq">
          <span className="privacy-kicker">MEMBERSHIP MODEL</span>
          <h2>Free first. Founder automatically. Plus later.</h2>
          <p>Every new account begins on AutoFace Free. Founder status is automatically allocated to the first 20 eligible verified members. AutoFace Plus is the planned paid subscription after the founding launch; payment processing is not enabled yet.</p>
          <div className="hero-actions">
            <Link className="btn btn-primary" href="/register">Create your profile</Link>
            <Link className="btn" href="/feedback">Give feedback</Link>
          </div>
        </div>
      </div>
    </section>
  </main>;
}
