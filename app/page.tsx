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
          <span className="experience-kicker"><Sparkles size={14}/> Where technology meets matrimony</span>
          <h1>A modern way for Sikhs to meet.<br/><em>Beyond traditional introductions.</em></h1>
          <p>AutoFace brings modern technology to matrimony — using compatibility, shared values, Atlas AI and authenticity signals to help Sikhs discover people worth being introduced to, with fewer profiles, clearer reasons and mutual choice.</p>
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
        <span className="experience-section-label">A NEW DIRECTION FOR SIKH INTRODUCTIONS</span>
        <h2>Fewer profiles.<br/><em>Better reasons to meet.</em></h2>
        <p>AutoFace is not trying to predict love. Atlas helps narrow the noise, explains the compatibility signals and leaves the decision with you.</p>
      </div>
    </section>

    <section className="sikh-world-section">
      <div className="container">
        <div className="experience-section-head sikh-world-head">
          <div><span className="experience-section-label">THE SIKH COMMUNITY, CONNECTED</span><h2>Connecting Sikhs.<br/><em>Wherever life has taken us.</em></h2></div>
          <p>Designed to create considered introductions across Sikh communities around the world — starting with the UK and connecting people across established global communities.</p>
        </div>
        <div className="sikh-world-card">
          <div className="sikh-map" aria-label="AutoFace global Sikh community network">
            <svg viewBox="0 0 1000 440" role="img" aria-label="Stylised world map showing AutoFace community locations">
              <path className="map-land" d="M75 120l70-50 93 12 60 42-24 42-62 8-32 51-65-20-43-44zm245 20 62-48 87-7 42 37-28 31-56 5-27 44-51-8-37-30zm188 70 40-41 49 5 35 42-15 74-42 81-48-22-25-82zm135-93 88-54 132 23 67 55-27 40-75 2-40 38-52-11-31 42-68-24-32-51zm153 177 48-24 63 13 30 35-28 34-72 5-42-28z"/>
              <path className="map-link" d="M456 127 Q540 35 716 128"/><path className="map-link" d="M456 127 Q640 170 835 318"/><path className="map-link" d="M456 127 Q490 220 552 282"/><path className="map-link" d="M456 127 Q410 82 382 122"/>
              <g className="map-point uk"><circle cx="456" cy="127" r="9"/><circle className="pulse" cx="456" cy="127" r="17"/><text x="472" y="120">UK</text><text className="sub" x="472" y="137">Launch community</text></g>
              <g className="map-point europe"><circle cx="520" cy="135" r="7"/><text x="533" y="132">Europe</text></g>
              <g className="map-point canada"><circle cx="218" cy="116" r="7"/><text x="232" y="112">Canada</text></g>
              <g className="map-point kenya"><circle cx="552" cy="282" r="7"/><text x="566" y="279">Kenya</text></g>
              <g className="map-point australia"><circle cx="835" cy="318" r="7"/><text x="850" y="315">Australia</text></g>
            </svg>
          </div>
          <div className="sikh-world-footer"><span>UK</span><i>•</i><span>Europe</span><i>•</i><span>Canada</span><i>•</i><span>Australia</span><i>•</i><span>Kenya</span></div>
          <p className="sikh-world-note">AutoFace is building toward these communities. Locations shown describe the intended community network, not current member numbers.</p>
        </div>
      </div>
    </section>

    <section className="autoface-how-flow">
      <div className="container">
        <div className="experience-section-head autoface-how-head">
          <div><span className="experience-section-label">FROM PROFILE TO INTRODUCTION</span><h2>A considered way to meet someone.<br/><em>One step at a time.</em></h2></div>
          <p>AutoFace keeps the journey clear: understand yourself, discover a few people, choose privately, and only open a conversation when interest is mutual.</p>
        </div>

        <div className="autoface-flow-line">
          <article className="autoface-flow-step">
            <span className="flow-number">01</span>
            <div className="flow-icon flow-profile"><UserRound size={22}/></div>
            <h3>Create</h3>
            <b>Build your profile</b>
            <p>Share who you are, your lifestyle, values and what matters in an introduction.</p>
          </article>

          <span className="flow-connector"><ArrowRight size={18}/></span>

          <article className="autoface-flow-step">
            <span className="flow-number">02</span>
            <div className="flow-icon flow-atlas"><Sparkles size={22}/></div>
            <h3>Atlas</h3>
            <b>Understand compatibility</b>
            <p>Atlas builds a relationship profile and explains the signals behind each recommendation.</p>
          </article>

          <span className="flow-connector"><ArrowRight size={18}/></span>

          <article className="autoface-flow-step">
            <span className="flow-number">03</span>
            <div className="flow-icon flow-discover"><Search size={22}/></div>
            <h3>Discover</h3>
            <b>Meet considered people</b>
            <p>See a small number of profiles chosen around compatibility, preferences and authenticity.</p>
          </article>

          <span className="flow-connector"><ArrowRight size={18}/></span>

          <article className="autoface-flow-step">
            <span className="flow-number">04</span>
            <div className="flow-icon flow-interest"><Heart size={22}/></div>
            <h3>Interest</h3>
            <b>Choose privately</b>
            <p>Interested, save for later, or simply say not for me. Nobody is pressured into a conversation.</p>
          </article>
        </div>

        <div className="autoface-mutual-stage">
          <div className="mutual-side mutual-you"><span>YOU</span><Heart size={16}/><b>Interested</b></div>
          <div className="mutual-path"><i/><i/></div>
          <div className="mutual-centre">
            <span className="flow-number">05</span>
            <div className="flow-icon flow-mutual"><HeartHandshake size={24}/></div>
            <h3>Mutual interest</h3>
            <p>When you both independently choose each other, AutoFace creates an introduction.</p>
          </div>
          <div className="mutual-path mutual-path-right"><i/><i/></div>
          <div className="mutual-side mutual-them"><span>THEM</span><Heart size={16}/><b>Interested</b></div>
        </div>

        <div className="autoface-introduction-finish">
          <span className="finish-line"/>
          <article>
            <span className="flow-number">06</span>
            <div className="flow-icon flow-message"><MessageCircle size={23}/></div>
            <div><h3>Introduced</h3><b>Start a conversation when you&apos;re both ready.</b><p>Messaging opens only after mutual interest — with Atlas available to help you understand the connection along the way.</p></div>
          </article>
        </div>

        <div className="autoface-flow-principle">
          <ShieldCheck size={17}/>
          <span><b>No endless swiping. No popularity contest. No pressure.</b> Considered introductions, mutual choice and explainable recommendations.</span>
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
        <p>Join the controlled beta and help shape a modern Sikh introduction experience built around fewer, more considered introductions.</p>
        <div className="experience-actions final-actions">
          <Link className="experience-primary" href="/register">Create your AutoFace account <ArrowRight size={17}/></Link>
          <Link className="experience-secondary" href="/early-access">Join the waiting list</Link>
        </div>
      </div>
    </section>
  </main>;
}
