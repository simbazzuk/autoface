import { MembershipCentre } from "@/components/MembershipCentre";

export default function MembershipPage() {
  return (
    <main className="membership-centre-page">
      <section className="membership-centre-hero">
        <div className="container">
          <span className="privacy-kicker">MY AUTOFACE</span>
          <h1>Membership Centre</h1>
          <p>See your current AutoFace plan, Founder status and the features available with your membership.</p>
        </div>
      </section>
      <section className="section">
        <div className="container">
          <MembershipCentre />
        </div>
      </section>
    </main>
  );
}
