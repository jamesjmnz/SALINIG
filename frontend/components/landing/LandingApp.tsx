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

const spamSignals = [
  { label: 'SPAM', tone: 'rust', top: '15%', left: '7%', x: [-70, 12, 58], y: [18, -18, 10], rotate: [-10, 6, -5], delay: 0.1, duration: 9.5 },
  { label: 'BOT BURST', tone: 'ink', top: '24%', left: '78%', x: [80, 4, -64], y: [-8, 18, -12], rotate: [9, -4, 8], delay: 1.1, duration: 10.8 },
  { label: 'RUMOR', tone: 'amber', top: '40%', left: '13%', x: [-58, 0, 76], y: [8, -22, 16], rotate: [7, -7, 3], delay: 2.2, duration: 11.2 },
  { label: 'CLAIM', tone: 'green', top: '55%', left: '80%', x: [66, -8, -74], y: [16, -18, 12], rotate: [-6, 5, -8], delay: 0.7, duration: 9.8 },
  { label: 'CLICKBAIT', tone: 'rust', top: '68%', left: '9%', x: [-64, 14, 70], y: [-4, -24, 6], rotate: [5, -5, 9], delay: 3, duration: 12 },
  { label: 'NOISE', tone: 'ink', top: '72%', left: '70%', x: [74, 2, -82], y: [12, -14, 20], rotate: [-9, 4, -4], delay: 1.8, duration: 10.4 },
  { label: 'SOURCE?', tone: 'amber', top: '31%', left: '42%', x: [-48, 8, 44], y: [20, -16, 8], rotate: [-5, 5, -3], delay: 3.5, duration: 13 },
] satisfies Array<{
  label: string;
  tone: 'rust' | 'green' | 'amber' | 'ink';
  top: string;
  left: string;
  x: number[];
  y: number[];
  rotate: number[];
  delay: number;
  duration: number;
}>;

function SpamSignalField() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="spam-field" aria-hidden="true">
      <motion.div
        className="spam-filter"
        initial={{ opacity: 0, scale: 0.86 }}
        animate={reduceMotion ? { opacity: 0.22, scale: 1 } : { opacity: [0.1, 0.34, 0.18], scale: [0.92, 1.06, 0.96] }}
        transition={{ duration: reduceMotion ? 0.4 : 5, repeat: reduceMotion ? 0 : Infinity, ease: 'easeInOut' }}
      >
        <span className="spam-filter-ring"></span>
        <span className="spam-filter-line"></span>
      </motion.div>

      {spamSignals.map((signal) => (
        <motion.span
          className={`spam-chip ${signal.tone}`}
          key={signal.label}
          style={{ top: signal.top, left: signal.left }}
          initial={{ opacity: 0, x: signal.x[0], y: signal.y[0], rotate: signal.rotate[0] }}
          animate={
            reduceMotion
              ? { opacity: [0.12, 0.2, 0.12] }
              : {
                  opacity: [0, 0.58, 0.34, 0],
                  x: signal.x,
                  y: signal.y,
                  rotate: signal.rotate,
                  scale: [0.96, 1.04, 0.94],
                }
          }
          transition={{
            duration: reduceMotion ? 4 : signal.duration,
            repeat: Infinity,
            delay: signal.delay,
            ease: 'easeInOut',
          }}
        >
          {signal.label}
        </motion.span>
      ))}
    </div>
  );
}

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

// ─── Hero Card ───────────────────────────────────────────────
function HeroCard() {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className="hero-card"
      initial={{ opacity: 0, y: 28, scale: 0.98 }}
      animate={reduceMotion ? { opacity: 1, y: 0, scale: 1 } : { opacity: 1, y: [28, 0, -3, 0], scale: 1 }}
      whileHover={reduceMotion ? undefined : { y: -6 }}
      transition={{ duration: 0.8, delay: 0.42, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="hero-card-bar">
        <div className="wdot wd-r"></div><div className="wdot wd-y"></div><div className="wdot wd-g"></div>
        <span className="card-title">salinig / intelligence-report</span>
      </div>
      <div className="hero-card-body">
        <div className="card-greeting">LIVE ANALYSIS · SIGNAL #2847</div>
        <div className="card-question">Is the circulating claim about the infrastructure bill verified?</div>
        <div className="card-response">
          <div className="card-response-label">Synthesis Agent · 2 RAG Cycles · 18 Sources</div>
          <div className="card-response-text">The core claim is <strong>substantially verified</strong> with minor factual discrepancies on budget figures. Three sources contradict the timeline assertion — flagged for review. Overall credibility: <strong>87/100</strong>.</div>
        </div>
        <div className="card-scores">
          <div className="card-score">
            <div className="card-score-label">Credibility</div>
            <div className="card-score-val green">87</div>
            <div className="card-bar"><div className="card-bar-fill" style={{width:'87%'}}></div></div>
          </div>
          <div className="card-score">
            <div className="card-score-label">Sentiment</div>
            <div className="card-score-val">+0.62</div>
            <div className="card-bar"><div className="card-bar-fill" style={{width:'62%', background:'var(--rust)'}}></div></div>
          </div>
          <div className="card-score">
            <div className="card-score-label">Confidence</div>
            <div className="card-score-val green">0.84</div>
            <div className="card-bar"><div className="card-bar-fill" style={{width:'84%'}}></div></div>
          </div>
        </div>
        <div className="card-sources">
          <span className="card-source">Reuters</span>
          <span className="card-source">AP News</span>
          <span className="card-source">Gov. DB</span>
          <span className="card-source">+15 more</span>
        </div>
      </div>
    </motion.div>
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
        style={{minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center', padding:'100px 40px 0', position:'relative', overflow:'hidden'}}
        initial="hidden"
        animate="show"
        variants={staggerIn}
      >
        {/* landscape SVG */}
        <motion.svg
          style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none',zIndex:0}}
          viewBox="0 0 1440 800"
          preserveAspectRatio="xMidYMid slice"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.1, ease: 'easeOut' }}
        >
          <defs>
            <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="oklch(0.88 0.03 78)" />
              <stop offset="60%" stopColor="oklch(0.92 0.025 72)" />
              <stop offset="100%" stopColor="oklch(0.96 0.015 75)" />
            </linearGradient>
            <linearGradient id="hill1" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="oklch(0.78 0.06 135)" />
              <stop offset="100%" stopColor="oklch(0.70 0.08 135)" />
            </linearGradient>
            <linearGradient id="hill2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="oklch(0.68 0.07 130)" />
              <stop offset="100%" stopColor="oklch(0.60 0.09 130)" />
            </linearGradient>
            <linearGradient id="hill3" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="oklch(0.82 0.05 80)" />
              <stop offset="100%" stopColor="oklch(0.75 0.07 78)" />
            </linearGradient>
          </defs>
          <rect width="1440" height="800" fill="url(#sky)" />
          <ellipse cx="720" cy="560" rx="900" ry="200" fill="oklch(0.88 0.04 78 / 0.5)" />
          <path d="M0,620 Q200,480 400,540 Q600,600 720,520 Q840,440 1040,510 Q1240,580 1440,520 L1440,800 L0,800 Z" fill="url(#hill2)" opacity="0.5" />
          <path d="M0,660 Q180,580 360,620 Q540,660 720,600 Q900,540 1080,590 Q1260,640 1440,600 L1440,800 L0,800 Z" fill="url(#hill1)" opacity="0.65" />
          <path d="M0,720 Q240,680 480,700 Q720,720 960,690 Q1200,660 1440,700 L1440,800 L0,800 Z" fill="url(#hill3)" opacity="0.55" />
          <rect y="760" width="1440" height="40" fill="oklch(0.975 0.010 78)" opacity="0.9" />
        </motion.svg>

        <SpamSignalField />

        <motion.div style={{position:'relative', zIndex:1}} variants={staggerIn}>
          <motion.div className="hero-badge" variants={riseIn} whileHover={{ y: -2 }}>
            <div className="hero-badge-dot"></div>
            New: Real-Time Evidence Verification v2
          </motion.div>
          <motion.h1 className="hero-title" variants={riseIn}>
            Public sentiment,<br/><em>verified</em> in seconds.
          </motion.h1>
          <motion.p className="hero-sub" variants={riseIn}>
            Salinig is a self-learning multi-agent system for real-time credibility intelligence — powered by Cyclic RAG and live evidence triangulation.
          </motion.p>
          <motion.div className="hero-actions" variants={riseIn}>
            <motion.button className="btn-primary" whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} onClick={() => document.getElementById('features')?.scrollIntoView({block:'start'})}>Get started</motion.button>
            <motion.button className="btn-outline" whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} onClick={() => document.getElementById('how')?.scrollIntoView({block:'start'})}>See how it works</motion.button>
          </motion.div>
        </motion.div>

        {tweaks.heroUI && <HeroCard />}
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
      <motion.div className="cta-section" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true, amount: 0.25 }} transition={{ duration: 0.6 }}>
        <h2 className="cta-title">Truth is a signal.<br/><em>We find it.</em></h2>
        <p className="cta-sub">Set up in minutes. No infrastructure changes. Verified results from the first prompt.</p>
        <motion.button className="btn-light" whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>Request access</motion.button>
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
