'use client';

import { useState, useEffect } from 'react';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import {
  TWEAK_DEFAULTS, MARQUEE_ITEMS, FEAT_TABS, WHY_CARDS, STEPS, LOG_LINES, FAQ_DATA,
  type LogLine, type WhyCard, type Step,
} from '@/lib/landingData';

const riseIn: Variants = {
  hidden: { opacity: 0, y: 22, filter: 'blur(8px)' },
  show: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
  },
};

const staggerIn: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.08 } },
};

// ─── Marquee ─────────────────────────────────────────────────
function Marquee() {
  const items = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS];
  return (
    <div className="marquee-wrap">
      <div className="marquee-track">
        {items.map((item, i) => (
          <span className="marquee-item" key={i}>
            <span className="marquee-sep">·</span>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Console Dashboard ───────────────────────────────────────
function ConsoleDashboard() {
  return (
    <div className="hc-wrap">
      <div className="hc-chrome">
        <div className="hc-chrome-dots">
          <div className="wdot wd-r" /><div className="wdot wd-y" /><div className="wdot wd-g" />
        </div>
        <div className="hc-url">salinig.ai/console</div>
        <div style={{ width: 52 }} />
      </div>
      <div className="hc-layout">
        <div className="hc-sb">
          <div className="hc-sb-logo">
            <div className="hc-sb-mark" />
            <div>
              <div className="hc-sb-name">Salinig</div>
              <div className="hc-sb-sub">intelligence</div>
            </div>
          </div>
          <div className="hc-sb-section">
            <div className="hc-sb-label">Navigation</div>
            {[
              { label: 'Dashboard', active: true },
              { label: 'Signals', badge: '3' },
              { label: 'Reports' },
              { label: 'Agents' },
              { label: 'Sources' },
              { label: 'Settings' },
            ].map((item, i) => (
              <div key={i} className={`hc-sb-item${item.active ? ' active' : ''}`}>
                <div className="hc-sb-icon" />
                {item.label}
                {item.badge && <span className="hc-sb-badge">{item.badge}</span>}
              </div>
            ))}
          </div>
        </div>
        <div className="hc-main">
          <div className="hc-topbar">
            <span className="hc-topbar-title">Dashboard</span>
            <div className="hc-topbar-right">
              <div className="hc-status">
                <span className="pulse-dot" />
                Live
              </div>
              <div className="hc-btn">Analyze Signal</div>
            </div>
          </div>
          <div className="hc-content">
            <div className="hc-stats">
              {[
                { label: 'CREDIBILITY', val: '87', green: true, delta: '+4 today' },
                { label: 'SIGNALS', val: '2,847', delta: '+142 this week' },
                { label: 'SOURCES', val: '18', delta: '+3 active' },
                { label: 'RAG CYCLES', val: '12', delta: 'avg per run' },
              ].map((s, i) => (
                <div key={i} className="hc-stat">
                  <div className="hc-stat-label">{s.label}</div>
                  <div className={`hc-stat-val${s.green ? ' green' : ''}`}>{s.val}</div>
                  <div className="hc-stat-delta">{s.delta}</div>
                </div>
              ))}
            </div>
            <div className="hc-panels">
              <div className="hc-panel">
                <div className="hc-panel-head">
                  <span className="hc-panel-title">Signal Feed</span>
                  <span className="hc-panel-action">View all →</span>
                </div>
                {[
                  { text: 'Infrastructure bill claim: budget figures disputed by 3 independent sources', src: 'Reuters', time: '2m ago', score: '87', dot: 'high', sc: 'high' },
                  { text: 'Market sentiment: tech sector showing mixed signals on AI regulation', src: 'Bloomberg', time: '8m ago', score: '72', dot: 'medium', sc: 'medium' },
                  { text: 'Climate data: satellite imagery confirms deforestation claim', src: 'NASA DB', time: '14m ago', score: '94', dot: 'low', sc: 'high' },
                  { text: 'Political statement: timeline inconsistency detected in press release', src: 'AP News', time: '23m ago', score: '58', dot: 'high', sc: 'low' },
                ].map((sig, i) => (
                  <div key={i} className="signal-item" style={{ cursor: 'default' }}>
                    <div className={`signal-dot ${sig.dot}`} />
                    <div className="signal-content">
                      <div className="signal-text" style={{ fontSize: 12 }}>{sig.text}</div>
                      <div className="signal-meta">
                        <span className="signal-source">{sig.src}</span>
                        <span className="signal-time">{sig.time}</span>
                      </div>
                    </div>
                    <div className={`signal-score ${sig.sc}`}>{sig.score}</div>
                  </div>
                ))}
              </div>
              <div className="hc-panel">
                <div className="hc-panel-head">
                  <span className="hc-panel-title">Active Agents</span>
                </div>
                {[
                  { name: 'Query Gen', task: 'Generating Tavily queries', status: 'running' },
                  { name: 'Collector', task: '5 results retrieved', status: 'running' },
                  { name: 'Analyst', task: 'Credibility assessment', status: 'busy' },
                  { name: 'Memory', task: 'Qdrant similarity search', status: 'idle' },
                  { name: 'Evaluator', task: 'Scoring report: 87/100', status: 'idle' },
                  { name: 'Learning', task: 'Awaiting pass threshold', status: 'idle' },
                ].map((a, i) => (
                  <div key={i} className="agent-item">
                    <div className={`agent-status-dot ${a.status}`} />
                    <div className="agent-name" style={{ fontSize: 11 }}>{a.name}</div>
                    <div className="agent-task">{a.task}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Features ────────────────────────────────────────────────
function FeatPanel({ lines }: { lines: LogLine[] }) {
  const [visible, setVisible] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setVisible(v => v < lines.length ? v + 1 : v), 600);
    return () => clearInterval(iv);
  }, [lines]);
  return (
    <div className="feat-panel">
      <div className="feat-panel-bar">
        <div className="wdot wd-r"></div><div className="wdot wd-y"></div><div className="wdot wd-g"></div>
        <span style={{fontFamily:'var(--font-dm-mono), monospace', fontSize:11, color:'var(--muted)', marginLeft:6}}>agent-runtime</span>
      </div>
      <div className="feat-panel-body">
        {lines.slice(0, visible).map((l, i) => (
          <motion.div
            className="ll"
            key={`${l.t}-${i}`}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            <span className="lt">{l.t}</span>
            <span className="la">[{l.a}]</span>
            <span className={`lm ${l.c}`}>{l.m}</span>
          </motion.div>
        ))}
        {visible >= lines.length && (
          <motion.div className="ll" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <span className="lt">—</span>
            <span className="lm">Awaiting next batch <span className="cursor"></span></span>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function Features() {
  const [active, setActive] = useState(0);
  const tab = FEAT_TABS[active];
  return (
    <section id="features">
      <div className="section-inner">
        <div className="section-header-row">
          <div>
            <div className="section-tag">Core Capabilities</div>
            <h2 className="section-title">One unified pipeline<br/>for credibility intelligence.</h2>
          </div>
          <p className="section-desc">Six specialist agents, one evidence graph. From raw signal to verified, scored report — in seconds.</p>
        </div>
        <motion.div className="feat-tabs" initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.4 }} variants={staggerIn}>
          {FEAT_TABS.map((t, i) => (
            <motion.button
              key={t.id}
              className={`feat-tab ${active === i ? 'active' : ''}`}
              onClick={() => setActive(i)}
              variants={riseIn}
              whileTap={{ scale: 0.98 }}
            >
              {t.label}
            </motion.button>
          ))}
        </motion.div>
        <motion.div className="feat-layout" initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.25 }} variants={staggerIn}>
          <motion.div className="feat-left" variants={riseIn}>
            <div className="feat-badge">{tab.badge}</div>
            <h3 className="feat-name">{tab.name}</h3>
            <p className="feat-desc">{tab.desc}</p>
            <ul className="feat-points">
                {tab.points.map((p, i) => <li key={i}>{p}</li>)}
            </ul>
          </motion.div>
          <motion.div className="feat-right" variants={riseIn}>
            <FeatPanel key={tab.id} lines={tab.panel} />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

// ─── Why Grid ────────────────────────────────────────────────
function WhySection() {
  return (
    <section id="why">
      <div className="section-inner">
        <div className="section-header-row">
          <div>
            <div className="section-tag">Why Salinig</div>
            <h2 className="section-title">Everything your intelligence<br/>team needs, in one system.</h2>
          </div>
          <p className="section-desc">Purpose-built for high-stakes environments where accuracy and speed both matter.</p>
        </div>
        <motion.div className="why-grid" initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }} variants={staggerIn}>
          {WHY_CARDS.map((c: WhyCard, i: number) => (
            <motion.div className="why-card" key={i} variants={riseIn} whileHover={{ y: -4 }}>
              <div className={`why-icon ${c.color === 'g' ? 'g' : ''}`}>
                <span style={{fontSize:16, color: c.color === 'g' ? 'var(--green)' : 'var(--rust)'}}>{c.icon}</span>
              </div>
              <div className="why-name">{c.name}</div>
              <div className="why-desc">{c.desc}</div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ─── How It Works ────────────────────────────────────────────
function HowSection() {
  const [active, setActive] = useState(0);
  const [logVisible, setLogVisible] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setActive(a => (a + 1) % STEPS.length), 2400);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const iv = setInterval(() => setLogVisible(v => v < LOG_LINES.length ? v + 1 : v), 700);
    return () => clearInterval(iv);
  }, []);

  return (
    <section id="how">
      <div className="section-inner">
        <div className="section-header-row">
          <div>
            <div className="section-tag">Architecture</div>
            <h2 className="section-title">How Salinig works.</h2>
          </div>
          <p className="section-desc">Six agents. One evidence loop. Results that improve with every cycle.</p>
        </div>
        <motion.div className="how-layout" initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }} variants={staggerIn}>
          <motion.div className="steps" variants={riseIn}>
            {STEPS.map((s: Step, i: number) => (
              <motion.div
                key={i}
                className={`step ${active === i ? 'active' : ''}`}
                onClick={() => setActive(i)}
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.99 }}
              >
                <div className="step-circle">0{i+1}</div>
                <div className="step-content">
                  <div className="step-agent">{s.agent}</div>
                  <div className="step-name">{s.name}</div>
                  <div className="step-desc">{s.desc}</div>
                  <div className="step-tags">
                    {s.tags.map((t: string, j: number) => <span key={j} className="step-tag">{t}</span>)}
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
          <motion.div className="how-right" variants={riseIn}>
            <div className="how-panel">
              <div className="how-panel-bar">
                <div className="wdot wd-r"></div><div className="wdot wd-y"></div><div className="wdot wd-g"></div>
                <span className="how-panel-title">salinig / live-pipeline</span>
              </div>
              <div className="how-log">
                {LOG_LINES.slice(0, logVisible).map((l: LogLine, i: number) => (
                  <motion.div
                    className="ll"
                    key={`${l.t}-${i}`}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.22, ease: 'easeOut' }}
                  >
                    <span className="lt">{l.t}</span>
                    <span className="la">[{l.a}]</span>
                    <span className={`lm ${l.c}`}>{l.m}</span>
                  </motion.div>
                ))}
                {logVisible >= LOG_LINES.length && (
                  <motion.div className="ll" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <span className="lt">—</span>
                    <span className="lm">Pipeline active <span className="cursor"></span></span>
                  </motion.div>
                )}
              </div>
              <div className="how-step-card">
                <div className="how-step-label">Active Agent</div>
                <div className="how-step-name">{STEPS[active].agent}</div>
                <div className="how-step-sub">{STEPS[active].name}</div>
              </div>
              <div className="how-prog">
                <div className="how-prog-fill" style={{width:`${(active+1)/STEPS.length*100}%`}}></div>
              </div>
              <div style={{padding:'8px 16px 16px', fontFamily:'var(--font-dm-mono), monospace', fontSize:10, color:'var(--muted)'}}>Step {active+1} of {STEPS.length}</div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

// ─── FAQ ─────────────────────────────────────────────────────
function FAQSection() {
  const cats = Object.keys(FAQ_DATA);
  const [cat, setCat] = useState(cats[0]);
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="faq">
      <div className="section-inner">
        <div className="section-tag">FAQ</div>
        <h2 className="section-title">Questions, answered.</h2>
        <div className="faq-layout">
          <div className="faq-sidebar">
            <div className="faq-sidebar-title">Topics</div>
            <div className="faq-cats">
              {cats.map(c => (
                <button key={c} className={`faq-cat ${cat === c ? 'active' : ''}`} onClick={() => { setCat(c); setOpen(null); }}>{c}</button>
              ))}
            </div>
            <div className="faq-contact">
              <div className="faq-contact-title">Still have questions?</div>
              <div className="faq-contact-desc">Our team is here to help. Reach out and we&apos;ll get back to you quickly.</div>
              <a href="mailto:hello@salinig.ai" className="faq-contact-link">Email us →</a>
            </div>
          </div>
          <motion.div className="faq-items" initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }} variants={staggerIn}>
            {FAQ_DATA[cat].map((f, i) => (
              <motion.div key={i} className={`faq-item ${open === i ? 'open' : ''}`} onClick={() => setOpen(open === i ? null : i)} variants={riseIn}>
                <div className="faq-q">
                  <div className="faq-question">{f.q}</div>
                  <div className="faq-toggle">+</div>
                </div>
                <div className="faq-answer">{f.a}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ─── Tweaks ──────────────────────────────────────────────────
interface LandingTweaks {
  accentColor: string;
  roundness: string;
  heroUI: boolean;
}

function TweaksPanel({ tweaks, setTweak }: { tweaks: LandingTweaks; setTweak: (k: keyof LandingTweaks, v: string | boolean) => void }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === '__activate_edit_mode') setOpen(true);
      if (e.data?.type === '__deactivate_edit_mode') setOpen(false);
    };
    window.addEventListener('message', onMsg);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', onMsg);
  }, []);

  const accentOpts = ['rust', 'navy', 'forest'];
  const roundOpts  = ['rounded', 'sharp'];

  return (
    <div className={`tweaks-panel ${open ? 'open' : ''}`}>
      <div className="tweaks-panel-title">Tweaks</div>
      <div className="tweaks-row">
        <div className="tweaks-label">Accent</div>
        <div className="tweaks-opts">
          {accentOpts.map(o => (
            <button key={o} className={`tweaks-opt ${tweaks.accentColor === o ? 'active' : ''}`}
              onClick={() => {
                setTweak('accentColor', o);
                const map: Record<string, string> = { rust: '0.505 0.130 25', navy: '0.50 0.18 255', forest: '0.50 0.14 145' };
                const v = map[o];
                document.documentElement.style.setProperty('--rust', `oklch(${v})`);
                document.documentElement.style.setProperty('--rust-bg', `oklch(${v} / 0.08)`);
                document.documentElement.style.setProperty('--rust-border', `oklch(${v} / 0.25)`);
              }}>{o}</button>
          ))}
        </div>
      </div>
      <div className="tweaks-row">
        <div className="tweaks-label">Cards</div>
        <div className="tweaks-opts">
          {roundOpts.map(o => (
            <button key={o} className={`tweaks-opt ${tweaks.roundness === o ? 'active' : ''}`}
              onClick={() => {
                setTweak('roundness', o);
                document.querySelectorAll<HTMLElement>('.why-card,.feat-panel,.how-panel,.hero-card,.faq-contact,.how-step-card').forEach(el => {
                  el.style.borderRadius = o === 'sharp' ? '4px' : '';
                });
              }}>{o}</button>
          ))}
        </div>
      </div>
      <div className="tweaks-row">
        <div className="tweaks-label">Hero UI</div>
        <div className="tweaks-toggle">
          <div className={`toggle-track ${tweaks.heroUI ? 'on' : ''}`} onClick={() => setTweak('heroUI', !tweaks.heroUI)}>
            <div className="toggle-thumb"></div>
          </div>
          <span className="toggle-label">Show dashboard card</span>
        </div>
      </div>
    </div>
  );
}

// ─── App ─────────────────────────────────────────────────────
export default function LandingApp() {
  const [tweaks, setTweakState] = useState<LandingTweaks>(TWEAK_DEFAULTS);
  const setTweak = (k: keyof LandingTweaks, v: string | boolean) => {
    setTweakState(prev => ({ ...prev, [k]: v }));
    window.parent.postMessage({ type: '__edit_mode_set_keys', edits: { [k]: v } }, '*');
  };

  return (
    <>
      {/* ── HERO ── */}
      <motion.section
        id="home"
        initial="hidden"
        animate="show"
        variants={staggerIn}
      >
        <div className="hero-inner">
          <motion.div className="hero-copy" variants={staggerIn}>
            <motion.div className="hero-badge" variants={riseIn} whileHover={{ y: -2 }}>
              <div className="hero-badge-dot"></div>
              Real-time evidence verification v2
            </motion.div>
            <motion.h1 className="hero-title" variants={riseIn}>
              Public sentiment,<br/><em>verified</em> in seconds.
            </motion.h1>
            <motion.p className="hero-sub" variants={riseIn}>
              Salinig turns noisy public discourse into verified, scored, and auditable intelligence with self-learning agents and cyclic retrieval.
            </motion.p>
            <motion.div className="hero-actions" variants={riseIn}>
              <motion.button className="btn-primary" whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} onClick={() => { window.location.href = '/console'; }}>Open console</motion.button>
              <motion.button className="btn-outline" whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} onClick={() => document.getElementById('how')?.scrollIntoView({block:'start'})}>See workflow</motion.button>
            </motion.div>
            <motion.div className="hero-metrics" variants={riseIn}>
              <div className="hero-metric">
                <strong>87</strong>
                <span>credibility score</span>
              </div>
              <div className="hero-metric">
                <strong>18</strong>
                <span>sources checked</span>
              </div>
              <div className="hero-metric">
                <strong>2</strong>
                <span>RAG cycles</span>
              </div>
            </motion.div>
          </motion.div>

          {tweaks.heroUI && (
            <motion.div className="hero-visual" variants={riseIn}>
              <ConsoleDashboard />
            </motion.div>
          )}
        </div>
      </motion.section>

      {/* ── MARQUEE ── */}
      <Marquee />

      {/* ── INTRO ── */}
      <div className="intro-section">
        <div className="intro-tag">About Salinig</div>
        <div className="intro-body">
          <p>Salinig is a credibility intelligence platform that turns the noise of public discourse into verified, scored, and auditable intelligence.</p>
          <p className="dim">It connects six specialized agents in a single pipeline — ingesting signals, routing queries, retrieving evidence in iterative cycles, and verifying claims against independent sources in real time.</p>
          <p className="dimmer">From sentiment shifts to factual contradictions, Salinig surfaces the truth faster than any manual review — and gets measurably better with every cycle.</p>
        </div>
      </div>

      {/* ── FEATURES ── */}
      <Features />

      {/* ── WHY ── */}
      <WhySection />

      {/* ── HOW ── */}
      <HowSection />

      {/* ── FAQ ── */}
      <FAQSection />

      {/* ── CTA ── */}
      <motion.div className="cta-section" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.7 }}>
        <div className="cta-inner">
          <motion.div className="cta-eyebrow" initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.1 }}>
            Start today
          </motion.div>
          <motion.h2 className="cta-title" initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}>
            Truth is a signal.<br/><em>We find it.</em>
          </motion.h2>
          <motion.p className="cta-sub" initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.28 }}>
            Set up in minutes. No infrastructure changes. Verified results from the first prompt.
          </motion.p>
          <motion.div className="cta-actions" initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.36 }}>
            <motion.button className="btn-light" whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} onClick={() => { window.location.href = '/console'; }}>
              Request access
            </motion.button>
            <motion.button className="cta-ghost" whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} onClick={() => document.getElementById('how')?.scrollIntoView({ block: 'start' })}>
              See how it works →
            </motion.button>
          </motion.div>
          <motion.div className="cta-proof" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.48 }}>
            <span className="cta-proof-item">87 avg credibility score</span>
            <span className="cta-proof-item">2,847 signals analyzed</span>
            <span className="cta-proof-item">Zero setup required</span>
          </motion.div>
        </div>
      </motion.div>

      {/* ── FOOTER ── */}
      <footer>
        <div className="footer-grid">
          <div className="footer-brand">
            <div className="footer-logo">Salinig</div>
            <div className="footer-tagline">Self-Learning Multi-Agent Credibility Intelligence System</div>
          </div>
          <div>
            <div className="footer-col-title">Product</div>
            <div className="footer-links">
              <a href="#home">Home</a>
              <a href="#features">Features</a>
              <a href="#how">How It Works</a>
              <a href="#faq">FAQ</a>
            </div>
          </div>
          <div>
            <div className="footer-col-title">Company</div>
            <div className="footer-links">
              <a href="#">About</a>
              <a href="#">Research</a>
              <a href="#">Careers</a>
              <a href="#">Blog</a>
            </div>
          </div>
          <div>
            <div className="footer-col-title">Legal</div>
            <div className="footer-links">
              <a href="#">Privacy Policy</a>
              <a href="#">Terms of Use</a>
              <a href="#">Security</a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <div className="footer-copy">© Salinig, 2026. All rights reserved.</div>
          <div className="footer-copy">hello@salinig.ai</div>
        </div>
      </footer>

      {/* ── TWEAKS ── */}
      <TweaksPanel tweaks={tweaks} setTweak={setTweak} />
    </>
  );
}
