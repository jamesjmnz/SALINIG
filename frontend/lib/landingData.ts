export interface LogoItem { name: string; }
export interface FaqSimpleItem { q: string; a: string; }

export const LOGOS: LogoItem[] = [
  { name: 'Orbitc' },
  { name: 'CloudBase' },
  { name: 'Proline' },
  { name: 'Amsterdam' },
  { name: 'Luminous' },
  { name: 'Pixelwave' },
];

export const SUP_FAQ_ITEMS: FaqSimpleItem[] = [
  { q: 'Is my data safe with your platform?', a: 'Salinig uses end-to-end encryption for all data in transit and at rest. We do not store raw signal content beyond the analysis window, and all credibility reports are access-controlled by your organization.' },
  { q: 'What kind of support do you offer?', a: 'We offer email support for all plans, with priority support and dedicated account management for enterprise customers. Most requests are handled within 4 business hours.' },
  { q: 'How does pricing work?', a: 'Pricing is based on the number of analyses run per month and the number of team members. We offer flexible plans starting from a pilot tier for qualifying organizations.' },
  { q: 'Can I cancel at any time?', a: 'Yes. There are no long-term contracts required. You can downgrade or cancel your plan at any time from your account settings, effective at the end of your current billing period.' },
  { q: 'Can I upgrade or downgrade my subscription?', a: 'Absolutely. You can upgrade immediately to access more capacity, or downgrade at the end of your billing cycle. Prorated credits apply when upgrading mid-cycle.' },
];

export interface LogLine {
  t: string;
  a: string;
  m: string;
  c: string;
}

export interface FeatTab {
  id: string;
  label: string;
  badge: string;
  name: string;
  desc: string;
  points: string[];
  panel: LogLine[];
}

export interface WhyCard {
  icon: string;
  color: string;
  name: string;
  desc: string;
}

export interface Step {
  agent: string;
  name: string;
  desc: string;
  tags: string[];
}

export interface FaqItem {
  q: string;
  a: string;
}

export const TWEAK_DEFAULTS = {
  accentColor: 'rust',
  roundness: 'rounded',
  heroUI: true,
};

export const MARQUEE_ITEMS: string[] = [
  'Multi-Agent Pipeline', 'Cyclic RAG', 'Real-Time Verification', 'Sentiment Mapping',
  'Credibility Scoring', 'Self-Learning Loop', 'Evidence Triangulation', 'Source Attribution',
  'Contradiction Detection', 'Temporal Analysis', 'Agent Dispatch', 'Audit Trail',
];

export const FEAT_TABS: FeatTab[] = [
  {
    id: 'ingest', label: 'Ingest',
    badge: 'Signal Capture',
    name: 'Capture every public signal, automatically.',
    desc: 'Salinig continuously ingests real-time streams from news APIs, social platforms, government databases, and academic repositories — normalized and timestamped on arrival.',
    points: ['Sub-second ingestion from 200+ source types', 'Automatic deduplication and priority scoring', 'Structured event queue with full provenance'],
    panel: [
      { t: '09:14:01', a: 'INGEST', m: 'Connected: 214 live feeds', c: '' },
      { t: '09:14:02', a: 'INGEST', m: 'Captured 2,847 signals', c: 'hi' },
      { t: '09:14:02', a: 'INGEST', m: 'Deduplicated: 312 removed', c: '' },
      { t: '09:14:03', a: 'QUEUE',  m: '2,535 events queued for routing', c: 'hi' },
      { t: '09:14:03', a: 'QUEUE',  m: 'Priority: 41 high / 194 medium', c: '' },
    ],
  },
  {
    id: 'verify', label: 'Verify',
    badge: 'Evidence Verification',
    name: 'Cross-source verification with zero guesswork.',
    desc: 'Every claim is triangulated against independent sources simultaneously. Contradictions surface automatically, source authority is scored, and temporal consistency is validated.',
    points: ['Independent source triangulation per claim', 'Contradiction detection with conflict resolution', 'Source authority scoring from historical accuracy'],
    panel: [
      { t: '09:14:06', a: 'VERIFY', m: 'Claim queued: "Minister denied..."', c: '' },
      { t: '09:14:07', a: 'VERIFY', m: 'Cross-referencing 18 sources', c: 'hi' },
      { t: '09:14:08', a: 'VERIFY', m: '⚠ Contradiction found in 3 sources', c: 'warn' },
      { t: '09:14:09', a: 'VERIFY', m: 'Authority score: 0.91 avg', c: 'hi' },
      { t: '09:14:10', a: 'VERIFY', m: 'Credibility: 87/100 — CONFIRMED', c: 'ok' },
    ],
  },
  {
    id: 'rag', label: 'Cyclic RAG',
    badge: 'Cyclic Retrieval',
    name: 'Evidence that improves with every cycle.',
    desc: 'Unlike single-pass RAG, Salinig loops — each retrieval cycle uses the previous context to surface higher-relevance evidence until confidence thresholds are met.',
    points: ['Iterative retrieval until confidence ≥ threshold', 'Context fusion across cycles for richer grounding', 'Automatic cycle termination — no wasted compute'],
    panel: [
      { t: '09:14:04', a: 'RAG', m: 'Cycle 1 — 94 sources retrieved', c: '' },
      { t: '09:14:04', a: 'RAG', m: 'Confidence: 0.58 — below threshold', c: 'warn' },
      { t: '09:14:05', a: 'RAG', m: 'Cycle 2 — 48 enrichment sources', c: 'hi' },
      { t: '09:14:05', a: 'RAG', m: 'Confidence: 0.84 — threshold met', c: 'ok' },
      { t: '09:14:06', a: 'RAG', m: 'Evidence graph saturated in 2 cycles', c: 'hi' },
    ],
  },
  {
    id: 'learn', label: 'Self-Learn',
    badge: 'Adaptive Intelligence',
    name: 'A system that gets smarter with every outcome.',
    desc: 'Analyst corrections, verified truths, and outcome signals continuously update retrieval weights, agent routing rules, and scoring heuristics — without retraining from scratch.',
    points: ['Continuous weight updates from real outcomes', 'Drift monitoring to detect model degradation', 'Zero downtime — improvements apply live'],
    panel: [
      { t: '09:14:11', a: 'LEARN', m: 'Feedback received: 14 corrections', c: '' },
      { t: '09:14:11', a: 'LEARN', m: 'Updating retrieval weights (+12)', c: 'hi' },
      { t: '09:14:12', a: 'LEARN', m: 'Routing rule refined: politics → v2', c: 'hi' },
      { t: '09:14:12', a: 'LEARN', m: 'No model drift detected', c: 'ok' },
      { t: '09:14:13', a: 'LEARN', m: 'System accuracy: +2.3% this cycle', c: 'ok' },
    ],
  },
];

export const WHY_CARDS: WhyCard[] = [
  { icon: '◉', color: 'r', name: 'Multi-Agent Coordination', desc: 'Six specialized agents work in parallel, each owning a discrete phase of the intelligence pipeline.' },
  { icon: '↺', color: 'r', name: 'Cyclic RAG Retrieval',     desc: 'Evidence quality improves with every loop — no single-pass hallucination risk.' },
  { icon: '⚡', color: 'g', name: 'Real-Time Verification',   desc: 'Claims verified in under 10 seconds against live, independent, cross-referenced sources.' },
  { icon: '◎', color: 'g', name: 'Sentiment Intelligence',    desc: 'Track opinion shifts, emotional valence, and narrative emergence across public channels.' },
  { icon: '▲', color: 'r', name: 'Credibility Scoring',       desc: 'Transparent, auditable scores built from source authority, corroboration, and temporal consistency.' },
  { icon: '◈', color: 'g', name: 'Self-Learning Loop',        desc: 'The system improves continuously from analyst feedback and verified outcomes — no retraining needed.' },
];

export const STEPS: Step[] = [
  { agent: 'Ingestion Agent', name: 'Signal Capture', desc: 'Real-time streams from 200+ source types are ingested, normalized, deduped, and queued in milliseconds.', tags: ['Stream normalization', 'Deduplication', 'Priority queue'] },
  { agent: 'Routing Agent',   name: 'Intent Classification', desc: 'Each event is classified by type and priority — factual, opinion, contested — then dispatched to specialist agents.', tags: ['Query classification', 'Agent dispatch', 'Priority scoring'] },
  { agent: 'Retrieval Agent', name: 'Cyclic RAG', desc: 'Evidence retrieved in iterative cycles, each pass enriching the context graph until confidence thresholds are satisfied.', tags: ['Vector search', 'Cyclic refinement', 'Context fusion'] },
  { agent: 'Verification Agent', name: 'Cross-Source Verification', desc: 'Claims triangulated against independent sources. Contradictions surfaced, authority scored, temporal consistency confirmed.', tags: ['Source triangulation', 'Conflict resolution', 'Temporal analysis'] },
  { agent: 'Synthesis Agent', name: 'Credibility Report', desc: 'A structured report with credibility scores, sentiment maps, evidence citations, and confidence intervals — audit-ready.', tags: ['Report generation', 'Score attribution', 'Audit trail'] },
  { agent: 'Learning Agent',  name: 'Feedback & Improvement', desc: 'Analyst corrections and verified outcomes update retrieval weights and routing rules live — no downtime.', tags: ['Weight updates', 'Drift monitoring', 'Live improvements'] },
];

export const LOG_LINES: LogLine[] = [
  { t: '09:14:01', a: 'INGEST', m: '2,535 signals queued', c: '' },
  { t: '09:14:02', a: 'ROUTE',  m: 'Classified: 41% factual', c: '' },
  { t: '09:14:03', a: 'RAG',    m: 'Cycle 1 — conf. 0.58', c: 'hi' },
  { t: '09:14:04', a: 'RAG',    m: 'Cycle 2 — conf. 0.84 ✓', c: 'ok' },
  { t: '09:14:05', a: 'VERIFY', m: '3 contradictions flagged', c: 'warn' },
  { t: '09:14:06', a: 'VERIFY', m: 'Credibility: 87/100', c: 'ok' },
  { t: '09:14:07', a: 'LEARN',  m: '12 weights updated', c: '' },
];

export const FAQ_DATA: Record<string, FaqItem[]> = {
  General: [
    { q: 'What is Salinig?', a: 'Salinig is a self-learning multi-agent system for public sentiment analysis and credibility verification. It ingests real-time signals, verifies claims through Cyclic RAG, and produces transparent, auditable credibility reports.' },
    { q: 'Who is Salinig built for?', a: 'Salinig serves government agencies, investigative newsrooms, intelligence units, and enterprises that need to quickly assess the credibility of public claims, track narrative shifts, and monitor sentiment at scale.' },
    { q: 'How quickly can I get started?', a: 'Most teams are operational within a day. The ingestion layer connects to your existing data sources via API or webhook. No infrastructure changes are required.' },
    { q: 'Is there a free tier?', a: 'We offer a pilot program for qualifying organizations. Contact us to discuss access terms and data scope.' },
  ],
  'AI & RAG': [
    { q: 'What is Cyclic RAG and why does it matter?', a: 'Standard RAG retrieves evidence once and generates from that snapshot. Cyclic RAG iterates — each pass surfaces more precise, higher-confidence evidence until a threshold is met. This dramatically reduces hallucination risk for contested or evolving claims.' },
    { q: 'How does the multi-agent system coordinate?', a: 'Each agent owns a discrete role: ingestion, routing, retrieval, verification, synthesis, and learning. A routing agent dispatches tasks based on query type and priority, enabling parallel execution with a shared evidence graph.' },
    { q: 'What does "self-learning" mean in practice?', a: 'When analysts correct outputs or verified truths emerge, the Learning Agent updates retrieval weights and routing rules live — no full retraining. The system measurably improves from operational data with every cycle.' },
  ],
  'Data & Security': [
    { q: 'What sources does Salinig verify against?', a: 'Salinig cross-references live news APIs, government data repositories, academic citation networks, fact-checking databases, and indexed web archives. Source authority is scored dynamically based on domain reputation and historical accuracy.' },
    { q: 'How is the credibility score calculated?', a: 'Each claim receives a score from four dimensions: source authority, corroboration depth, temporal consistency, and logical coherence. All factors are fully auditable and exposed in the report output.' },
    { q: 'Can Salinig be integrated with existing systems?', a: 'Yes. Salinig exposes a REST API and structured webhook events. Outputs include JSON credibility reports, sentiment maps, and evidence graphs — compatible with SIEM platforms, newsroom tools, and government dashboards.' },
  ],
};
