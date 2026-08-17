import Link from "next/link";
import { ArrowRight, BadgeCheck, Check, HeartHandshake, ShieldCheck, Sparkles } from "lucide-react";

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
          <span className="experience-kicker"><Sparkles size={14}/> Considered introductions, explained by Atlas</span>
          <h1>Dating shouldn&apos;t feel like searching.<br/><em>It should feel like being introduced.</em></h1>
          <p>Tell Atlas who you are. AutoFace recommends a small number of people who make sense — and explains why each introduction may be worth getting to know.</p>
          <div className="experience-actions">
            <Link className="experience-primary" href="/register">Join the beta <ArrowRight size={17}/></Link>
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
                <h2>Maya, 36</h2>
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
              <span>Why Atlas recommended Maya</span>
              <ArrowRight size={16}/>
            </div>
          </article>
        </div>
      </div>
    </section>

    <section className="experience-statement">
      <div className="container">
        <span className="experience-section-label">WHY AUTOFACE</span>
        <h2>Fewer profiles.<br/><em>Better reasons to meet.</em></h2>
        <p>AutoFace is not trying to predict love. Atlas helps narrow the noise, explains the compatibility signals and leaves the decision with you.</p>
      </div>
    </section>

    <section className="experience-journey">
      <div className="container">
        <div className="experience-section-head">
          <div><span className="experience-section-label">A MORE INTENTIONAL JOURNEY</span><h2>A few people worth considering. And here&apos;s why.</h2></div>
          <p>Three simple stages keep the experience focused on understanding, mutuality and choice.</p>
        </div>

        <div className="experience-three">
          <article>
            <span>01</span>
            <div className="experience-stage-icon"><Sparkles size={22}/></div>
            <h3>Understand</h3>
            <p>Build your Atlas relationship profile around values, expectations and the way you want a relationship to work.</p>
          </article>
          <article>
            <span>02</span>
            <div className="experience-stage-icon"><HeartHandshake size={22}/></div>
            <h3>Discover</h3>
            <p>See people who meet your preferences, with compatibility explained rather than hidden behind an opaque match score.</p>
          </article>
          <article>
            <span>03</span>
            <div className="experience-stage-icon"><ShieldCheck size={22}/></div>
            <h3>Introduce</h3>
            <p>Nobody messages anybody until interest is mutual. An introduction opens only when both people independently choose it.</p>
          </article>
        </div>
      </div>
    </section>

    <section className="experience-dual">
      <div className="container experience-dual-grid">
        <div className="experience-dual-copy">
          <span className="experience-section-label">TWO DIFFERENT QUESTIONS</span>
          <h2>Compatibility is only half the story.</h2>
          <p>AutoFace deliberately separates whether two people may fit from whether a profile has stronger evidence of authenticity.</p>
          <Link href="/trust" className="experience-inline-link">Explore the trust model <ArrowRight size={15}/></Link>
        </div>
        <div className="experience-dual-visual">
          <div className="experience-orbit">
            <div className="experience-orbit-centre">AUTOFACE</div>
            <div className="experience-orbit-card orbit-atlas"><span>ATLAS</span><b>Do we fit?</b><small>Compatibility</small></div>
            <div className="experience-orbit-card orbit-auth"><span>AUTHENTICITY</span><b>Are they real?</b><small>Trust evidence</small></div>
          </div>
        </div>
      </div>
    </section>

    <section className="experience-principle">
      <div className="container">
        <div className="experience-quote">
          <span className="experience-section-label">THE AUTOFACE PRINCIPLE</span>
          <blockquote>“Atlas doesn&apos;t just show you people. It explains why you might work.”</blockquote>
          <p>Atlas explains compatibility. Authenticity builds confidence. You remain the person making the decision.</p>
        </div>
      </div>
    </section>

    <section className="experience-final">
      <div className="container experience-final-inner">
        <span className="experience-section-label">CONTROLLED BETA</span>
        <h2>Ready to be introduced, not overwhelmed?</h2>
        <p>Join the controlled beta and help shape a dating experience built around fewer, more considered introductions.</p>
        <div className="experience-actions final-actions">
          <Link className="experience-primary" href="/register">Create your AutoFace account <ArrowRight size={17}/></Link>
          <Link className="experience-secondary" href="/early-access">Join the waiting list</Link>
        </div>
      </div>
    </section>
  </main>;
}
