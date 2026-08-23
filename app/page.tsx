import Link from "next/link";
import { ArrowRight, BadgeCheck, Check, Heart, HeartHandshake, MessageCircle, Search, ShieldCheck, Sparkles, UserRound } from "lucide-react";

const alignments = [
  { label: "Family outlook", value: 92, tone: "Strong alignment" },
  { label: "Communication", value: 86, tone: "Strong alignment" },
  { label: "Lifestyle rhythm", value: 81, tone: "Aligned" },
];

export default function Home() {
  return <main className="experience-home">
    <section className="experience-hero">
      <div className="experience-glow experience-glow-one" />
      <div className="experience-glow experience-glow-two" />
      <div className="container experience-hero-grid">
        <div className="experience-hero-copy">
          <span className="experience-kicker"><Sparkles size={14}/> The Match Intelligence Platform</span>
          <h1>Meet with intention.<br/><em>Match with intelligence.</em></h1>
          <p>AutoFace is the Match Intelligence Platform — combining relationship understanding, explainable AI and verified profiles to help Sikhs discover people worth getting to know, with fewer profiles, clearer reasons and mutual choice.</p>
          <div className="experience-actions">
            <Link className="experience-primary" href="/register">Join AutoFace <ArrowRight size={17}/></Link>
            <Link className="experience-secondary" href="/how-it-works">See how Atlas works</Link>
          </div>
          <div className="experience-proof">
            <span><Check size={14}/> No endless swiping</span>
            <span><Check size={14}/> Explainable compatibility</span>
            <span><Check size={14}/> Mutual introductions</span>
            <span><Check size={14}/> Private by design</span>
          </div>
        </div>

        <div className="experience-match-wrap" aria-label="Example Atlas compatibility card">
          <div className="experience-card-aura" />
          <article className="experience-match-card">
            <div className="experience-card-top">
              <div>
                <span className="experience-card-label">ATLAS INTRODUCTION</span>
                <h2>Profile A, 36</h2>
                <p>Leeds · Healthcare</p>
              </div>
              <span className="experience-auth-chip"><BadgeCheck size={13}/> Strong authenticity</span>
            </div>

            <div className="experience-score">
              <strong>84%</strong>
              <span>COMPATIBILITY</span>
              <small>Strong alignment</small>
            </div>

            <div className="experience-alignments">
              {alignments.map(item => <div className="experience-alignment" key={item.label}>
                <div>
                  <span><b>{item.label}</b><small>{item.tone}</small></span>
                  <strong>{item.value}%</strong>
                </div>
                <div className="experience-alignment-meter"><i style={{width:`${item.value}%`}} /></div>
              </div>)}
            </div>

            <div className="experience-card-footer">
              <span>Why Atlas recommended Profile A</span>
              <ArrowRight size={16}/>
            </div>
          </article>
        </div>
      </div>
    </section>

    <section className="experience-statement">
      <div className="container">
        <span className="experience-section-label">MATCH INTELLIGENCE FOR MODERN INTRODUCTIONS</span>
        <h2>Fewer profiles.<br/><em>Better reasons to meet.</em></h2>
        <p>AutoFace is not trying to predict love. Atlas helps narrow the noise, explains the compatibility signals and leaves the decision with you.</p>
      </div>
    </section>

    <section className="product-story-section">
      <div className="container">
        <div className="product-story-intro">
          <span className="experience-section-label">THE MATCH INTELLIGENCE PLATFORM</span>
          <h2>Technology that helps you understand <em>who may be worth meeting.</em></h2>
          <p>Traditional matchmaking starts with a profile. AutoFace goes further — helping you understand compatibility, make considered choices and build confidence before an introduction begins.</p>
        </div>

        <article className="product-story-row story-understand">
          <div className="product-story-copy"><span className="story-number">01</span><span className="story-kicker">UNDERSTAND</span><h3>More than a biodata.</h3><p>Atlas learns what matters to you — values, personality, lifestyle, ambitions and relationship priorities — and turns those signals into a relationship profile designed around real compatibility.</p><Link href="/relationship-profile">Build your relationship profile <ArrowRight size={16}/></Link></div>
          <div className="story-visual atlas-profile-visual"><div className="story-window-head"><span>ATLAS RELATIONSHIP PROFILE</span><Sparkles size={16}/></div><div className="story-profile-score"><strong>YOU</strong><span>What matters to you</span></div><div className="story-signal-grid"><span><b>Values</b><i>High priority</i></span><span><b>Family outlook</b><i>Important</i></span><span><b>Lifestyle</b><i>Balanced</i></span><span><b>Communication</b><i>Very important</i></span></div><div className="story-insight"><Sparkles size={16}/><p><b>Atlas insight</b><br/>You value shared direction, open communication and a strong sense of family.</p></div></div>
        </article>

        <article className="product-story-row story-discover">
          <div className="product-story-copy"><span className="story-number">02</span><span className="story-kicker">DISCOVER</span><h3>Fewer profiles. Better reasons.</h3><p>No endless catalogue of people. AutoFace surfaces considered profiles around your preferences and relationship profile — then Atlas explains the signals behind the recommendation.</p><Link href="/discover">Explore discovery <ArrowRight size={16}/></Link></div>
          <div className="story-visual discover-visual"><div className="story-window-head"><span>ATLAS RECOMMENDATION</span><BadgeCheck size={16}/></div><div className="discover-person"><div className="discover-avatar">P</div><div><strong>Priya, 34</strong><span>London · Healthcare</span></div><div className="discover-score"><b>87%</b><small>MATCH</small></div></div><div className="story-bars"><span><b>Values</b><i><em style={{width:'92%'}}/></i><strong>92%</strong></span><span><b>Family</b><i><em style={{width:'89%'}}/></i><strong>89%</strong></span><span><b>Lifestyle</b><i><em style={{width:'84%'}}/></i><strong>84%</strong></span></div><div className="story-insight"><Sparkles size={16}/><p><b>Why Atlas recommends Priya</b><br/>Strong alignment across family outlook, communication and lifestyle rhythm.</p></div></div>
        </article>

        <article className="product-story-row story-trust">
          <div className="product-story-copy"><span className="story-number">03</span><span className="story-kicker">TRUST</span><h3>Know there is a real person behind the profile.</h3><p>Face verification, verified-photo integrity and authenticity signals help create a community where people can approach an introduction with greater confidence.</p><Link href="/trust">See how AutoFace builds trust <ArrowRight size={16}/></Link></div>
          <div className="story-visual trust-visual"><div className="trust-shield"><ShieldCheck size={30}/></div><span className="trust-title"><BadgeCheck size={17}/> FACE VERIFIED</span><div className="trust-checks"><span><Check size={16}/><b>Live person confirmed</b></span><span><Check size={16}/><b>Profile photo matched</b></span><span><Check size={16}/><b>Verified photo protected</b></span></div><p>Verification strengthens confidence without replacing your own judgement.</p></div>
        </article>
      </div>
    </section>

    <section className="founder-access-section"><div className="container"><div className="founder-access-card"><div className="founder-access-copy"><span className="founder-badge"><Sparkles size={15}/> FOUNDING MEMBER ACCESS</span><h2>Be one of the <em>first 20.</em></h2><p>Join AutoFace at the beginning. The first 20 verified members to complete their profile will receive <strong>12 months of AutoFace Unlimited, complimentary.</strong></p><div className="founder-benefits"><span><b>20</b><small>FOUNDING PLACES</small></span><span><b>12</b><small>MONTHS FREE</small></span><span><b>∞</b><small>UNLIMITED ACCESS</small></span></div><Link className="founder-cta" href="/register">Claim founding access <ArrowRight size={18}/></Link><small className="founder-qualifier"><BadgeCheck size={14}/> Complete registration, your relationship profile and verification to qualify.</small></div><div className="founder-pass"><div className="founder-pass-top"><span>AUTOFACE</span><Sparkles size={20}/></div><div className="founder-pass-mark">✦</div><span className="founder-pass-label">FOUNDING MEMBER</span><strong>01 / 20</strong><p>12 MONTHS<br/>UNLIMITED</p><div className="founder-pass-foot"><BadgeCheck size={15}/> VERIFIED MEMBER</div></div></div></div></section>

    <section className="experience-final">
      <div className="container experience-final-inner">
        <span className="experience-section-label">JOIN AUTOFACE</span>
        <h2>Ready to be introduced, not overwhelmed?</h2>
        <p>Create your profile and join a modern Sikh introduction experience built around fewer, more considered introductions.</p>
        <div className="experience-actions final-actions">
          <Link className="experience-primary" href="/register">Create your AutoFace account <ArrowRight size={17}/></Link>
          <Link className="experience-secondary" href="/early-access">Join the waiting list</Link>
        </div>
      </div>
    </section>
  </main>;
}
