export type AnalysisMode = 'fast_draft' | 'full';
export type MonitoringWindow = 'past 24 hours' | 'past 7 days' | 'past 30 days';
export type AnalysisStatus = 'loading-cache' | 'idle' | 'running' | 'error';
export type AnalysisProgressType = 'status' | 'final' | 'error';
export type AnalysisRunStatus = 'completed' | 'insufficient_evidence';
export type ClaimSupportLabel = 'supported' | 'mixed' | 'contradicted' | 'unclear';

export interface SentimentSourceSignal {
  source_index: number;
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

export interface RankedEvidenceSource {
  source_index: number;
  title: string;
  url?: string | null;
  published?: string | null;
  score?: number | string | null;
  content_preview?: string | null;
  domain: string;
  official: boolean;
  rerank_score?: number | null;
}

export interface EvidenceSufficiencyResult {
  checked: boolean;
  passed: boolean;
  source_count: number;
  unique_domain_count: number;
  official_source_count: number;
  reasons: string[];
  ranked_sources: RankedEvidenceSource[];
}

export interface ClaimEvidenceLink {
  source_index: number;
  title: string;
  url?: string | null;
  domain: string;
  support_label: ClaimSupportLabel;
  support_score: number;
  rationale: string;
}

export interface ReportClaim {
  claim_id: string;
  text: string;
  claim_type: 'overview' | 'signal' | 'insight' | 'finding';
  source_indexes: number[];
  support_status: 'supported' | 'mixed' | 'contradicted' | 'unsupported';
  evidence_links: ClaimEvidenceLink[];
}

export interface ContradictionAlert {
  claim_id: string;
  claim_text: string;
  source_index: number;
  source_title: string;
  url?: string | null;
  label: ClaimSupportLabel;
  confidence: number;
  rationale: string;
}

export interface ClaimVerificationSummary {
  checked: boolean;
  verified_claim_count: number;
  contradicted_claim_count: number;
  unsupported_claim_count: number;
  model: string;
  claims: ReportClaim[];
  contradictions: ContradictionAlert[];
}

export interface SpikeSignal {
  signal_type: 'density' | 'velocity' | 'nli_coherence';
  score: number;
  weight: number;
  note: string;
}

export interface SpikeDetectionResult {
  detected: boolean;
  spike_level: 'ACTIVE_SPIKE' | 'RISING_SIGNAL' | 'BASELINE';
  spike_score: number;
  signals: SpikeSignal[];
  history_count: number;
  recent_note_count: number;
  velocity_available: boolean;
  error?: string | null;
}

export interface AnalysisDiagnostics {
  search_queries: string[];
  collected_sources: Array<{
    title: string;
    url?: string | null;
    published?: string | null;
    score?: number | string | null;
    content_preview?: string | null;
  }>;
  retrieved_memories: Array<{
    content: string;
    metadata: Record<string, unknown>;
    score?: number | null;
  }>;
  cycle_trace: Array<Record<string, unknown>>;
  learning_note: string;
  learning_citations: string[];
  memory_error?: string | null;
  memory_save_error?: string | null;
  evidence_sufficiency: EvidenceSufficiencyResult;
  claim_verification: ClaimVerificationSummary;
  citation_validation: {
    checked: boolean;
    passed: boolean;
    unsupported_urls: string[];
    unsupported_source_titles: string[];
  };
  spike_detection?: SpikeDetectionResult | null;
}

export interface AnalysisResponse {
  channel: 'web_search';
  monitoring_window: MonitoringWindow;
  prioritize_themes: string[];
  focus_terms: string[];
  place: string;
  analysis_mode: AnalysisMode;
  analysis_status: AnalysisRunStatus;
  final_report: string;
  sentiment_report?: SentimentReport | null;
  iteration: number;
  max_iterations: number;
  quality: QualityResult;
  memory_saved: boolean;
  memory_duplicate: boolean;
  diagnostics?: AnalysisDiagnostics | null;
  spike_detection?: SpikeDetectionResult | null;
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
  include_diagnostics?: boolean;
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

export interface AnalystFeedbackPayload {
  report_id?: string | null;
  score: number;
  useful: boolean;
  accurate: boolean;
  notes?: string | null;
  flagged_claim_ids: string[];
  tags: string[];
}

export interface AnalystFeedbackRecord extends AnalystFeedbackPayload {
  feedback_id: string;
  created_at: string;
}

export interface AnalystFeedbackListResponse {
  feedback: AnalystFeedbackRecord[];
}

export interface AnalystFeedbackExportResponse {
  summary: {
    total_feedback: number;
    useful_positive_count: number;
    inaccurate_count: number;
    average_score: number;
    ready_for_fine_tuning: boolean;
    recommendation: string;
    most_flagged_claim_ids: string[];
  };
  feedback: AnalystFeedbackRecord[];
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
    body: JSON.stringify({ ...payload, include_diagnostics: payload.include_diagnostics ?? true }),
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
    body: JSON.stringify({ ...payload, include_diagnostics: payload.include_diagnostics ?? true }),
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

export function submitAnalystFeedback(payload: AnalystFeedbackPayload) {
  return apiJson<AnalystFeedbackRecord>('/analysis/feedback', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function fetchAnalystFeedback() {
  return apiJson<AnalystFeedbackListResponse>('/analysis/feedback');
}

export function fetchAnalystFeedbackExport() {
  return apiJson<AnalystFeedbackExportResponse>('/analysis/feedback/export');
}
