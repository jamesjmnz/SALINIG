export interface Signal {
  id: number;
  text: string;
  source: string;
  time: string;
  priority: string;
  score: string;
  scoreClass: string;
}

export interface Agent {
  name: string;
  status: string;
  task: string;
  cycles: string;
}

export interface Report {
  title: string;
  status: string;
  time: string;
  score: string;
}

export interface Source {
  name: string;
  type: string;
  rate: string;
  status: string;
}

export interface SentimentTopic {
  topic: string;
  pos: number;
  neg: number;
  neu: number;
}

export interface TweakState {
  theme: string;
  density: string;
  dataStyle: string;
}

export const TWEAK_DEFAULTS: TweakState = {
  theme: 'light',
  density: 'spacious',
  dataStyle: 'operational',
};

export const SIGNALS: Signal[] = [
  { id: 1, text: 'Finance minister denies budget shortfall allegations in press conference', source: 'Reuters', time: 'Just now', priority: 'high', score: '91', scoreClass: 'high' },
  { id: 2, text: 'Opposition party claims new infrastructure bill bypasses environmental review', source: 'AP News', time: '2m ago', priority: 'medium', score: '72', scoreClass: 'medium' },
  { id: 3, text: 'Social media viral post: water supply contamination in northern districts', source: 'Twitter/X', time: '4m ago', priority: 'high', score: '38', scoreClass: 'low' },
  { id: 4, text: 'Independent audit confirms 12% increase in government procurement costs', source: 'Gov. DB', time: '7m ago', priority: 'low', score: '95', scoreClass: 'high' },
  { id: 5, text: 'Unverified claim: hospital capacity at 140% in three major cities', source: 'Facebook', time: '9m ago', priority: 'high', score: '44', scoreClass: 'low' },
  { id: 6, text: 'Trade union announces 72-hour strike at national ports next week', source: 'AFP', time: '12m ago', priority: 'medium', score: '88', scoreClass: 'high' },
  { id: 7, text: 'Senator quotes outdated GDP figures in budget hearing session', source: 'C-SPAN', time: '15m ago', priority: 'medium', score: '61', scoreClass: 'medium' },
  { id: 8, text: 'Confirmed: Election commission certifies regional ballot results', source: 'EC Portal', time: '18m ago', priority: 'low', score: '99', scoreClass: 'high' },
];

export const AGENTS: Agent[] = [
  { name: 'Ingestion Agent',    status: 'running', task: 'Processing 214 live feeds',       cycles: '2,847' },
  { name: 'Routing Agent',      status: 'busy',    task: 'Classifying 312 events/min',       cycles: '1,204' },
  { name: 'Retrieval Agent',    status: 'running', task: 'Cyclic RAG — cycle 2/3',           cycles: '441' },
  { name: 'Verification Agent', status: 'busy',    task: 'Cross-referencing 18 sources',     cycles: '189' },
  { name: 'Synthesis Agent',    status: 'running', task: 'Generating report #2847',          cycles: '94' },
  { name: 'Learning Agent',     status: 'idle',    task: 'Awaiting feedback batch',          cycles: '12' },
];

export const REPORTS: Report[] = [
  { title: 'Infrastructure bill budget claim — Finance Ministry', status: 'verified', time: '09:14 · Today', score: '87' },
  { title: 'Northern water contamination social media chain',      status: 'flagged',  time: '09:08 · Today', score: '38' },
  { title: 'Trade union port strike announcement',                  status: 'verified', time: '08:51 · Today', score: '92' },
  { title: 'Hospital capacity claims — 3 cities',                  status: 'flagged',  time: '08:33 · Today', score: '44' },
  { title: 'Election commission ballot certification',              status: 'verified', time: '08:12 · Today', score: '99' },
  { title: 'GDP figure discrepancy — Senate hearing',               status: 'pending',  time: '07:58 · Today', score: '61' },
];

export const SOURCES: Source[] = [
  { name: 'Reuters Wire',             type: 'News API',   rate: '340/hr',  status: 'online' },
  { name: 'Associated Press',         type: 'News API',   rate: '280/hr',  status: 'online' },
  { name: 'Government Open Data',     type: 'Database',   rate: '120/hr',  status: 'online' },
  { name: 'Twitter/X Firehose',       type: 'Social',     rate: '12k/hr',  status: 'online' },
  { name: 'Facebook CrowdTangle',     type: 'Social',     rate: '8.2k/hr', status: 'online' },
  { name: 'Academic Citation Network',type: 'Research',   rate: '42/hr',   status: 'online' },
  { name: 'Wayback Machine',          type: 'Archive',    rate: '18/hr',   status: 'online' },
  { name: 'Global Fact DB',           type: 'Fact-check', rate: '64/hr',   status: 'online' },
  { name: 'AFP International',        type: 'News API',   rate: '190/hr',  status: 'offline' },
];

export const SENTIMENT_TOPICS: SentimentTopic[] = [
  { topic: 'Infrastructure Bill', pos: 48, neg: 32, neu: 20 },
  { topic: 'Water Supply Crisis', pos: 12, neg: 71, neu: 17 },
  { topic: 'Election Results',    pos: 54, neg: 28, neu: 18 },
  { topic: 'Economic Policy',     pos: 33, neg: 44, neu: 23 },
];

export const CHART_DATA: number[] = [62, 75, 58, 81, 74, 88, 91, 79, 85, 87, 92, 84];
export const CHART_LABELS: string[] = ['Apr 18', 'Apr 19', 'Apr 20', 'Apr 21', 'Apr 22', 'Apr 23', 'Apr 24', 'Apr 25', 'Apr 26', 'Apr 27', 'Apr 28', 'Apr 29'];

export const VIEW_TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  signals:   'Live Signals',
  verify:    'Verification Queue',
  sentiment: 'Sentiment Analysis',
  reports:   'Intelligence Reports',
  sources:   'Data Sources',
  agents:    'Agent Monitor',
  settings:  'Settings',
};
