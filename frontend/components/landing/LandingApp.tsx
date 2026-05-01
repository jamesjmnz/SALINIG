'use client';

import { useState } from 'react';
import Link from 'next/link';
import { SUP_FAQ_ITEMS } from '@/lib/landingData';

// ─── Figma Asset URLs (expire in ~7 days) ────────────────────
const A = {
  dashboard: '/dashboard-hero.png',
  logos: {
    springfield: 'https://www.figma.com/api/mcp/asset/e7d29749-ef0c-4ab5-b803-704b2b5599fc',
    orbitc:      'https://www.figma.com/api/mcp/asset/769e517c-ce42-47f2-b783-202f2350df72',
    cloud:       'https://www.figma.com/api/mcp/asset/63ef6acf-6f47-47cc-920a-da0367a088ab',
    proline:     'https://www.figma.com/api/mcp/asset/8fff1717-fd3c-4716-8050-2883c2b8df37',
    amsterdam:   'https://www.figma.com/api/mcp/asset/29197b29-ab91-4eb3-a47d-b5f43a6fe2c5',
    luminous:    'https://www.figma.com/api/mcp/asset/62d318dd-7229-4353-b4ac-820243e06368',
  },
  feat: {
    invite:    'https://www.figma.com/api/mcp/asset/409a0e6d-eead-4326-ad26-189f8beab02e',
    edit:      'https://www.figma.com/api/mcp/asset/735035a3-e396-4ac7-b226-40c5f20d5c47',
    feedback:  'https://www.figma.com/api/mcp/asset/488c513b-d405-4efb-8e0e-dfb2fc431746',
    calendar:  'https://www.figma.com/api/mcp/asset/850efee6-b394-491b-8aa9-b19d38a09495',
    analytics: 'https://www.figma.com/api/mcp/asset/39a0a62a-efe4-43dd-aa15-3366d8c1e80b',
  },
  bento: {
    chart:       'https://www.figma.com/api/mcp/asset/bd82faca-2069-4f27-88c6-1049d87db0c7',
    collabBg:    'https://www.figma.com/api/mcp/asset/7eee4b17-ced9-420b-8f4e-211d52abb0c5',
    collabAv1:   'https://www.figma.com/api/mcp/asset/d3953d96-8dd2-42e5-a12a-f3e51070fc79',
    collabAv2:   'https://www.figma.com/api/mcp/asset/4792b54b-2783-40d4-9832-0332d912b543',
    collabAv3:   'https://www.figma.com/api/mcp/asset/33251df3-8275-4ab8-b0b9-72e2fcd85332',
    collabAv4:   'https://www.figma.com/api/mcp/asset/1122cb80-1226-4073-a55d-1ff6da108d02',
    shortcutsBg: 'https://www.figma.com/api/mcp/asset/25897210-f670-4782-9e89-fc673f688f3e',
    intBg:       'https://www.figma.com/api/mcp/asset/78d5c80a-8caf-49d5-8717-a9072f4e6094',
    intCloud:    'https://www.figma.com/api/mcp/asset/5ab926ba-1eeb-4be2-9a5d-ae855dae69c2',
    intProline:  'https://www.figma.com/api/mcp/asset/a9054340-a795-4731-95cb-a4afc1dc8e31',
    intLuminous: 'https://www.figma.com/api/mcp/asset/f61ae6f6-d1ea-4b0a-a3aa-3d79d7f33d16',
    widgets:     'https://www.figma.com/api/mcp/asset/21a7dda4-9c12-4cd3-a787-f7903b3f1c64',
  },
  slider: {
    calendar:    'https://www.figma.com/api/mcp/asset/42ea83ba-a4a7-4358-ab46-bd6b02421d4e',
    analytics:   'https://www.figma.com/api/mcp/asset/d8666e35-b88d-4a1f-8780-b98f2bca5aa6',
    integration: 'https://www.figma.com/api/mcp/asset/555d89df-6584-4943-8b69-b2b52a119dc6',
    boards:      'https://www.figma.com/api/mcp/asset/24f77289-6f9f-48eb-b0cf-2912cec34be2',
  },
};

// ─── Arrow icon ───────────────────────────────────────────────
function ArrowIcon({ color = 'currentColor', size = 16 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8h10M9 4l4 4-4 4" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── HERO ────────────────────────────────────────────────────

function HeroSection() {
  return (
    <>
      {/* Text area */}
      <section className="sup-hero">
        <div className="sup-hero-inner">
          <div className="sup-hero-badge">
            <span className="sup-hero-badge-new">NEW</span>
            Announcing Cyclic RAG v2
          </div>
          <h1 className="sup-hero-title">
            The most powerful<br />intelligence platform.
          </h1>
          <p className="sup-hero-sub">
            Unlock the potential of your business with our next-level intelligence
            platform. Transform your workflows and achieve new heights today.
          </p>
          <div className="sup-hero-actions">
            <Link href="/console" className="sup-btn-primary">
              Get started <ArrowIcon color="#fff" />
            </Link>
            <a href="#features" className="sup-btn-outline">
              Learn more <ArrowIcon color="#020a0f" />
            </a>
          </div>
        </div>
      </section>

      {/* Dashboard screenshot */}
      <div className="sup-dash-wrap">
        <div className="sup-dash-inner">
          <div className="sup-dash-img-wrap">
            <img src={A.dashboard} alt="Salinig dashboard" className="sup-dash-img" />
          </div>

          {/* Logos */}
          <div className="sup-logos2-label-row">
            <span className="sup-logos2-label">Trusted by the world leaders</span>
          </div>
          <div className="sup-logos2-row">
            <img src={A.logos.springfield} alt="Springfield" className="sup-logo-svg" height={22} />
            <img src={A.logos.orbitc}      alt="Orbitc"      className="sup-logo-svg" height={24} />
            <img src={A.logos.cloud}       alt="Cloud"       className="sup-logo-svg" height={16} />
            <img src={A.logos.proline}     alt="Proline"     className="sup-logo-svg" height={22} />
            <img src={A.logos.amsterdam}   alt="Amsterdam"   className="sup-logo-svg" height={14} />
            <img src={A.logos.luminous}    alt="Luminous"    className="sup-logo-svg" height={20} />
          </div>
        </div>
      </div>
    </>
  );
}

// ─── FEATURES BLOCKS ─────────────────────────────────────────

const FEAT_CARDS = [
  {
    img:   A.feat.invite,
    title: 'Invite members',
    desc:  'Share, edit, and manage projects in real-time, ensuring everyone stays aligned and productive.',
  },
  {
    img:   A.feat.edit,
    title: 'Edit together',
    desc:  'Work smarter with collaborative editing tools that keep everyone on the same page.',
  },
  {
    img:   A.feat.feedback,
    title: 'Instant feedback',
    desc:  'Easily share thoughts, ask questions, and provide feedback directly within your files.',
  },
];

function FeatPill({ color, icon, label }: { color: string; icon: string; label: string }) {
  return (
    <div className={`sup-feat-pill ${color}`}>
      <span className="sup-feat-pill-icon">{icon}</span>
      {label}
    </div>
  );
}

function FeatureBlocksSection() {
  return (
    <section id="features" className="sup-feat-blocks">
      <div className="sup-feat-blocks-inner">

        {/* Feature 1 — 3-column cards */}
        <div className="sup-feat1">
          <div className="sup-feat1-header">
            <FeatPill color="blue" icon="◈" label="Seamless collaboration" />
            <h2 className="sup-feat1-h2">Powering teamwork to simplify workflows</h2>
            <p className="sup-feat1-p">
              Say goodbye to version chaos and embrace a smoother workflow
              designed to help your team achieve more, together.
            </p>
          </div>
          <div className="sup-feat-cards">
            {FEAT_CARDS.map((card) => (
              <div key={card.title} className="sup-feat-card">
                <div className="sup-feat-card-img">
                  <img src={card.img} alt={card.title} />
                </div>
                <div className="sup-feat-card-info">
                  <div className="sup-feat-card-title">{card.title}</div>
                  <div className="sup-feat-card-desc">{card.desc}</div>
                  <a href="#" className="sup-feat-card-link">
                    Learn more <ArrowIcon color="#020a0f" size={14} />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Feature 2 — text left, image right */}
        <div className="sup-feat-row">
          <div className="sup-feat-row-text">
            <div className="sup-feat-row-title">
              <FeatPill color="orange" icon="◷" label="Meaningful calendar" />
              <h2 className="sup-feat-row-h2">Dynamic planner that keeps you ahead</h2>
              <p className="sup-feat-row-p">
                Stay one step ahead with a calendar that grows with your schedule.
                Adapt quickly to changes, manage priorities effectively, and achieve
                your goals with ease.
              </p>
            </div>
            <div>
              <a href="#" className="sup-btn-ghost">Learn more <ArrowIcon color="#020a0f" /></a>
            </div>
          </div>
          <div className="sup-feat-row-img">
            <img src={A.feat.calendar} alt="Calendar feature" />
          </div>
        </div>

        {/* Feature 3 — image left, text right */}
        <div className="sup-feat-row reverse">
          <div className="sup-feat-row-text">
            <div className="sup-feat-row-title">
              <FeatPill color="purple" icon="◎" label="Insightful analytics" />
              <h2 className="sup-feat-row-h2">Analytics that power smarter decisions</h2>
              <p className="sup-feat-row-p">
                Our cutting-edge analytics deliver detailed trends, patterns, and
                actionable intelligence to help you make informed decisions and
                stay ahead of the competition.
              </p>
            </div>
            <div>
              <a href="#" className="sup-btn-ghost">Learn more <ArrowIcon color="#020a0f" /></a>
            </div>
          </div>
          <div className="sup-feat-row-img">
            <img src={A.feat.analytics} alt="Analytics feature" />
          </div>
        </div>

      </div>
    </section>
  );
}

// ─── BENTO GRID ───────────────────────────────────────────────

function BentoGridSection() {
  return (
    <section className="sup-bento2">
      <div className="sup-bento2-inner">

        {/* Header */}
        <div className="sup-bento2-header">
          <FeatPill color="green" icon="⚡" label="Features" />
          <h2 className="sup-bento2-h2">Features designed to empower your workflow</h2>
          <p className="sup-bento2-p">
            Stay ahead with tools that prioritize your needs, integrating insights and
            efficiency into one powerful platform.
          </p>
        </div>

        {/* Grid */}
        <div className="sup-bento2-grid">

          {/* Block 1 — Data insights (spans 2 cols) */}
          <div className="sup-bento2-card span2">
            <div className="sup-bento2-card-img">
              <img src={A.bento.chart} alt="Analytics" />
            </div>
            <div className="sup-bento2-card-info">
              <div className="sup-bento2-card-title">Data insights</div>
              <div className="sup-bento2-card-desc">
                Make smarter, more informed decisions with powerful and actionable data insights, designed to
                empower your business with the tools needed to drive growth, efficiency, and success.
              </div>
            </div>
          </div>

          {/* Block 2 — Collaborate together */}
          <div className="sup-bento2-card">
            <div className="sup-bento2-collab-area">
              <img src={A.bento.collabBg} alt="" className="sup-bento2-collab-bg" />
              <img src={A.bento.collabAv1} alt="" className="sup-bento2-av sup-bento2-av1" />
              <img src={A.bento.collabAv2} alt="" className="sup-bento2-av sup-bento2-av2" />
              <img src={A.bento.collabAv3} alt="" className="sup-bento2-av sup-bento2-av3" />
              <img src={A.bento.collabAv4} alt="" className="sup-bento2-av sup-bento2-av4" />
            </div>
            <div className="sup-bento2-card-info">
              <div className="sup-bento2-card-title">Collaborate together</div>
              <div className="sup-bento2-card-desc">
                Collaborate with your team, share updates instantly, and achieve your goals faster.
              </div>
            </div>
          </div>

          {/* Block 3 — App shortcuts */}
          <div className="sup-bento2-card">
            <div className="sup-bento2-shortcuts-area">
              <img src={A.bento.shortcutsBg} alt="" className="sup-bento2-shortcuts-bg" />
              <div className="sup-bento2-shortcuts-ui">
                <div className="sup-bento2-keys">
                  <div className="sup-bento2-key">⌘</div>
                  <div className="sup-bento2-key">K</div>
                </div>
                <div className="sup-bento2-keytag">Command menu</div>
              </div>
            </div>
            <div className="sup-bento2-card-info">
              <div className="sup-bento2-card-title">App shortcuts</div>
              <div className="sup-bento2-card-desc">
                Save time, boost efficiency, and focus on what truly matters for you.
              </div>
            </div>
          </div>

          {/* Block 4 — Seamless integrations */}
          <div className="sup-bento2-card">
            <div className="sup-bento2-int-area">
              <img src={A.bento.intBg} alt="" className="sup-bento2-int-bg" />
              <div className="sup-bento2-int-icons">
                <div className="sup-bento2-int-icon" style={{ left: 44, bottom: 56 }}>
                  <img src={A.bento.intCloud} alt="Cloud" />
                </div>
                <div className="sup-bento2-int-icon" style={{ left: '50%', transform: 'translateX(-50%)', top: -13 + 60 }}>
                  <img src={A.bento.intProline} alt="Proline" />
                </div>
                <div className="sup-bento2-int-icon" style={{ right: 48, top: 53 }}>
                  <img src={A.bento.intLuminous} alt="Luminous" />
                </div>
                <div className="sup-bento2-int-center">
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#020a0f' }}>S</span>
                </div>
              </div>
            </div>
            <div className="sup-bento2-card-info">
              <div className="sup-bento2-card-title">Seamless integrations</div>
              <div className="sup-bento2-card-desc">
                Seamlessly connect your favorite apps and platforms with our powerful integrations.
              </div>
            </div>
          </div>

          {/* Block 5 — Smart widgets */}
          <div className="sup-bento2-card">
            <div className="sup-bento2-card-img">
              <img src={A.bento.widgets} alt="Widgets" />
            </div>
            <div className="sup-bento2-card-info">
              <div className="sup-bento2-card-title">Smart widgets</div>
              <div className="sup-bento2-card-desc">
                Provides real-time data, actionable insights, and key metrics at a glance.
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}

// ─── SLIDER ───────────────────────────────────────────────────

const SLIDER_TABS = [
  {
    id: 'calendar',
    label: 'Meaningful calendar',
    icon: '◷',
    pill: { color: 'orange', icon: '◷', label: 'Meaningful calendar' },
    heading: 'Stay organized and on track',
    desc: 'Effortlessly manage your time and tasks with our intuitive scheduling calendar. Create, modify, and share events with ease.',
    img: A.slider.calendar,
  },
  {
    id: 'analytics',
    label: 'Insightful analytics',
    icon: '◎',
    pill: { color: 'purple', icon: '◎', label: 'Insightful analytics' },
    heading: 'Turn data into decisive action',
    desc: 'Get actionable intelligence from real-time credibility scores and sentiment maps. Track narrative shifts across all your active analyses.',
    img: A.slider.analytics,
  },
  {
    id: 'integration',
    label: 'Seamless integration',
    icon: '⊞',
    pill: { color: 'blue', icon: '⊞', label: 'Seamless integration' },
    heading: 'Connect your entire intelligence stack',
    desc: 'Salinig integrates with your existing tools via REST API and webhooks. Export reports, evidence graphs, and credibility scores to any platform.',
    img: A.slider.integration,
  },
  {
    id: 'boards',
    label: 'Effortless boards',
    icon: '▦',
    pill: { color: 'green', icon: '▦', label: 'Effortless boards' },
    heading: 'Organize investigations at scale',
    desc: 'Track evidence threads, manage analyst workloads, and coordinate intelligence operations with purpose-built boards for your team.',
    img: A.slider.boards,
  },
];

function SliderSection() {
  const [active, setActive] = useState(0);
  const tab = SLIDER_TABS[active];
  return (
    <section className="sup-slider2">
      <div className="sup-slider2-inner">
        <div className="sup-slider2-header">
          <FeatPill color="green" icon="⚡" label="Features" />
          <h2 className="sup-slider2-h2">Suited for every scenario</h2>
          <p className="sup-slider2-p">
            Explore the comprehensive suite of tools designed to enhance your
            productivity and streamline your workflow.
          </p>
        </div>

        {/* Tab bar */}
        <div className="sup-slider2-tabs" role="tablist">
          {SLIDER_TABS.map((t, i) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={i === active}
              className={`sup-slider2-tab${i === active ? ' active' : ''}`}
              onClick={() => setActive(i)}
            >
              <span>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="sup-slider2-content">
          <div className="sup-slider2-text">
            <div className="sup-slider2-text-inner">
              <FeatPill color={tab.pill.color} icon={tab.pill.icon} label={tab.pill.label} />
              <div className="sup-slider2-heading">{tab.heading}</div>
              <div className="sup-slider2-desc">{tab.desc}</div>
            </div>
            <a href="#" className="sup-btn-ghost">Learn more <ArrowIcon color="#020a0f" /></a>
          </div>
          <div className="sup-slider2-img">
            <img src={tab.img} alt={tab.label} />
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── FAQ ─────────────────────────────────────────────────────

function FAQSection() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section id="faq" className="sup-section sup-faq">
      <div className="sup-section-inner sup-section-centered">
        <div className="sup-section-label green">⊕ FAQ</div>
        <h2 className="sup-section-heading" style={{ fontSize: 'clamp(40px, 5vw, 64px)' }}>
          In case you missed anything
        </h2>
        <p className="sup-section-sub">We&apos;re here to answer all your questions.</p>
        <div className="sup-faq-support">
          <a href="mailto:hello@salinig.ai" className="sup-btn-ghost">Contact support →</a>
        </div>
        <div className="sup-faq-items">
          {SUP_FAQ_ITEMS.map((item, i) => (
            <div key={i} className={`sup-faq-item${open === i ? ' open' : ''}`}>
              <div className="sup-faq-q" onClick={() => setOpen(open === i ? null : i)}>
                <div className="sup-faq-question">{item.q}</div>
                <div className="sup-faq-toggle">+</div>
              </div>
              <div className="sup-faq-answer">{item.a}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── CTA + FOOTER ────────────────────────────────────────────

function CTAAndFooter() {
  return (
    <>
      <div className="sup-cta-section">
        <div className="sup-cta-card">
          <div className="sup-cta-dot" style={{ width: 10, height: 10, top: '20%', left: '16%' }} />
          <div className="sup-cta-dot" style={{ width: 7, height: 7, top: '62%', left: '9%' }} />
          <div className="sup-cta-dot" style={{ width: 7, height: 7, top: '28%', right: '13%' }} />
          <div className="sup-cta-dot" style={{ width: 5, height: 5, top: '72%', right: '20%' }} />
          <div className="sup-cta-dot" style={{ width: 4, height: 4, top: '14%', left: '46%' }} />
          <h2 className="sup-cta-title">Start your trial today.</h2>
          <p className="sup-cta-sub">
            Unlock the power of public sentiment intelligence. Transform your workflows
            and achieve new heights today.
          </p>
          <Link href="/console" className="sup-cta-btn">Open Console →</Link>
        </div>
      </div>

      <footer className="sup-footer">
        <div className="sup-footer-inner">
          <div className="sup-footer-top">
            <div>
              <div className="sup-footer-logo">
                <span className="sup-footer-logo-icon" />
                Salinig
              </div>
              <div className="sup-footer-socials">
                {['𝕏', 'in', '⊛', '◈'].map((icon, i) => (
                  <a key={i} href="#" className="sup-footer-social">{icon}</a>
                ))}
              </div>
            </div>
            <div>
              <div className="sup-footer-col-title">Product</div>
              <div className="sup-footer-links">
                <a href="#features">Features</a>
                <a href="#">Integrations</a>
                <a href="#">Changelog</a>
                <a href="#">Pricing</a>
                <a href="/console">Open Console</a>
              </div>
            </div>
            <div>
              <div className="sup-footer-col-title">Company</div>
              <div className="sup-footer-links">
                <a href="#">About</a>
                <a href="#">Blog</a>
                <a href="#">Careers</a>
                <a href="#">Contact</a>
              </div>
            </div>
            <div>
              <div className="sup-footer-col-title">Resources</div>
              <div className="sup-footer-links">
                <a href="#">Documentation</a>
                <a href="#">Research</a>
                <a href="#">API Reference</a>
                <a href="#">Status</a>
              </div>
            </div>
            <div>
              <div className="sup-footer-col-title">Legal</div>
              <div className="sup-footer-links">
                <a href="#">Privacy Policy</a>
                <a href="#">Terms of Use</a>
                <a href="#">Security</a>
                <a href="#">Cookie Policy</a>
              </div>
            </div>
          </div>
          <div className="sup-footer-bottom">
            <div className="sup-footer-copy">© Salinig, 2026. All rights reserved.</div>
            <div className="sup-footer-copy">hello@salinig.ai</div>
          </div>
        </div>
      </footer>
    </>
  );
}

// ─── Main Export ─────────────────────────────────────────────

export default function LandingApp() {
  return (
    <>
      <HeroSection />
      <FeatureBlocksSection />
      <BentoGridSection />
      <SliderSection />
      <FAQSection />
      <CTAAndFooter />
    </>
  );
}
