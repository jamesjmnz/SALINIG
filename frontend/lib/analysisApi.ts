export type AnalysisMode = 'fast_draft' | 'full';
export type MonitoringWindow = 'past 24 hours' | 'past 7 days' | 'past 30 days';
export type AnalysisStatus = 'loading-cache' | 'idle' | 'running' | 'error';
export type AnalysisProgressType = 'status' | 'final' | 'error';

export interface SentimentSourceSignal {
  source: string;
  title: string;
  url?: string | null;
  summary: string;
  sentiment: 'Positive' | 'Neutral' | 'Negative';
  verification: 'verified' | 'unverified';
  credibility: 'High' | 'Moderate' | 'Low' | 'Unverified';
  credibility_score: number;
}

export interface SentimentReportMetrics {
  negative_pct: number;
  neutral_pct: number;
  positive_pct: number;
  credibility_pct: number;
  verified_pct: number;
  misinfo_risk_pct: number;
  signal_count: number;
}

export interface SentimentReport {
  updated_at: string;
  updated_label: string;
  overall_label: string;
  overview: string;
  source_signals: SentimentSourceSignal[];
  metrics: SentimentReportMetrics;
  actionable_insights: string[];
}

export interface QualityResult {
  score: number;
  breakdown: Record<string, number>;
  passed: boolean;
  feedback: string;
  knowledge_gaps: string[];
  blocking_issues: string[];
}

export interface AnalysisResponse {
  channel: 'web_search';
  monitoring_window: MonitoringWindow;
  prioritize_themes: string[];
  focus_terms: string[];
  place: string;
  analysis_mode: AnalysisMode;
  final_report: string;
  sentiment_report?: SentimentReport | null;
  iteration: number;
  max_iterations: number;
  quality: QualityResult;
  memory_saved: boolean;
  memory_duplicate: boolean;
  quality_score: number;
  quality_breakdown: Record<string, number>;
  quality_passed: boolean;
  quality_feedback: string;
  knowledge_gaps: string[];
  blocking_issues: string[];
}

export interface AnalysisOptions {
  default_place: string;
  supported_locations: string[];
  categories: string[];
  default_categories: string[];
  max_themes: number;
  max_focus_terms: number;
  monitoring_windows: MonitoringWindow[];
  analysis_modes: AnalysisMode[];
  fetching_mode: 'cached_on_load_manual_refresh' | string;
}

export interface LatestAnalysisResponse {
  cached: boolean;
  updated_at?: string | null;
  report_id?: string | null;
  analysis?: AnalysisResponse | null;
}

export interface SavedAnalysisSummary {
  report_id: string;
  saved_at: string;
  title: string;
  place: string;
  monitoring_window: MonitoringWindow;
  analysis_mode: AnalysisMode;
  overall_label: string;
  quality_score: number;
  quality_passed: boolean;
  signal_count: number;
  prioritize_themes: string[];
}

export interface SavedAnalysisRecord {
  report_id: string;
  saved_at: string;
  analysis: AnalysisResponse;
}

export interface SavedAnalysisListResponse {
  reports: SavedAnalysisSummary[];
}

export interface AnalyzePayload {
  place: string;
  monitoring_window: MonitoringWindow;
  prioritize_themes: string[];
  focus_terms: string[];
  analysis_mode: AnalysisMode;
}

export interface AnalysisProgressEvent {
  type: AnalysisProgressType;
  node?: string;
  label?: string;
  message?: string;
  iteration?: number;
  max_iterations?: number;
  source_count?: number;
  signal_count?: number;
  quality_score?: number;
  quality_passed?: boolean;
  analysis?: AnalysisResponse;
}

const API_BASE = process.env.NEXT_PUBLIC_SALINIG_PROXY_BASE ?? '/api';

function headers() {
  return { 'Content-Type': 'application/json' };
}

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...headers(),
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const detail = await response.text();
    if (detail) {
      let message = detail;
      try {
        const parsed = JSON.parse(detail) as { detail?: string };
        if (parsed.detail) message = parsed.detail;
      } catch {}
      throw new Error(message);
    }
    throw new Error(`Request failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function fetchAnalysisOptions() {
  return apiJson<AnalysisOptions>('/analysis/options');
}

export function fetchLatestAnalysis() {
  return apiJson<LatestAnalysisResponse>('/analysis/latest');
}

export function fetchSavedReports() {
  return apiJson<SavedAnalysisListResponse>('/analysis/saved');
}

export function fetchSavedReport(reportId: string) {
  return apiJson<SavedAnalysisRecord>(`/analysis/saved/${reportId}`);
}

export function saveAnalysisReport(analysis: AnalysisResponse) {
  return apiJson<SavedAnalysisRecord>('/analysis/saved', {
    method: 'POST',
    body: JSON.stringify(analysis),
  });
}

export function runAnalysis(payload: AnalyzePayload) {
  return apiJson<AnalysisResponse>('/analysis', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

function parseSseBlock(block: string): AnalysisProgressEvent | null {
  const lines = block.replace(/\r/g, '').split('\n');
  let eventType: AnalysisProgressType | null = null;
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith('event:')) {
      const value = line.slice(6).trim();
      if (value === 'status' || value === 'final' || value === 'error') eventType = value;
    }
    if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
  }

  if (!dataLines.length) return null;
  const parsed = JSON.parse(dataLines.join('\n')) as AnalysisProgressEvent;
  return { ...parsed, type: parsed.type ?? eventType ?? 'status' };
}

export async function streamAnalysis(
  payload: AnalyzePayload,
  onEvent: (event: AnalysisProgressEvent) => void,
) {
  const response = await fetch(`${API_BASE}/analysis/stream`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Request failed with ${response.status}`);
  }
  if (!response.body) {
    throw new Error('Streaming is unavailable for this browser.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalAnalysis: AnalysisResponse | null = null;
  let streamedError: Error | null = null;

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const blocks = buffer.split('\n\n');
    buffer = blocks.pop() ?? '';

    for (const block of blocks) {
      if (!block.trim()) continue;
      const event = parseSseBlock(block);
      if (!event) continue;
      onEvent(event);
      if (event.type === 'final' && event.analysis) finalAnalysis = event.analysis;
      if (event.type === 'error') streamedError = new Error(event.message || event.label || 'Analysis failed.');
    }

    if (done) break;
  }

  if (buffer.trim()) {
    const event = parseSseBlock(buffer);
    if (event) {
      onEvent(event);
      if (event.type === 'final' && event.analysis) finalAnalysis = event.analysis;
      if (event.type === 'error') streamedError = new Error(event.message || event.label || 'Analysis failed.');
    }
  }

  if (streamedError) throw streamedError;
  if (!finalAnalysis) throw new Error('Analysis stream ended before a final report was received.');
  return finalAnalysis;
}
