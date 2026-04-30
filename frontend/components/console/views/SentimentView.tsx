'use client';

import { useMemo, useState } from 'react';
import type {
  AnalysisMode,
  AnalysisOptions,
  AnalysisProgressEvent,
  AnalysisResponse,
  AnalysisStatus,
  AnalyzePayload,
  MonitoringWindow,
} from '@/lib/analysisApi';

interface SentimentViewProps {
  analysis: AnalysisResponse | null;
  options: AnalysisOptions | null;
  latestUpdatedAt: string | null;
  status: AnalysisStatus;
  progress: AnalysisProgressEvent | null;
  error: string | null;
  onAnalyze: (payload: AnalyzePayload) => Promise<void>;
}

function formatUpdatedAt(value: string | null) {
  if (!value) return 'No cached report';
  try {
    return new Intl.DateTimeFormat('en', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return 'Cached report';
  }
}

function parseFocusTerms(value: string, maxTerms: number) {
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, maxTerms);
}

function progressPercent(progress: AnalysisProgressEvent | null) {
  const stages: Record<string, number> = {
    queued: 5,
    query_gen: 16,
    research: 35,
    analysis: 52,
    insight: 68,
    citation_validation: 78,
    evaluate: 88,
    learn: 92,
    save: 96,
    complete: 96,
    finalize: 96,
    analysis_service: 100,
  };
  if (!progress) return 0;
  if (progress.type === 'final') return 100;
  return stages[progress.node ?? ''] ?? 10;
}

export default function SentimentView(props: SentimentViewProps) {
  const options = props.options;
  const optionsKey = options
    ? [
        options.default_place,
        options.monitoring_windows.join('|'),
        options.analysis_modes.join('|'),
        options.default_categories.join('|'),
        options.max_themes,
        options.max_focus_terms,
      ].join('::')
    : 'fallback';

  return <SentimentViewContent key={optionsKey} {...props} />;
}

function SentimentViewContent({
  analysis,
  options,
  latestUpdatedAt,
  status,
  progress,
  error,
  onAnalyze,
}: SentimentViewProps) {
  const fallbackCategories = [
    'Governance & Public Services',
    'Transportation & Infrastructure',
    'Disaster, Climate & Environment',
  ];
  const categories = options?.categories ?? fallbackCategories;
  const defaultCategories = options?.default_categories ?? fallbackCategories;
  const locations = options?.supported_locations ?? ['Philippines', 'NCR', 'Luzon', 'Visayas', 'Mindanao'];
  const monitoringWindows: MonitoringWindow[] = options?.monitoring_windows ?? ['past 7 days', 'past 24 hours', 'past 30 days'];
  const analysisModes: AnalysisMode[] = options?.analysis_modes ?? ['fast_draft', 'full'];
  const maxThemes = options?.max_themes ?? 5;
  const maxFocusTerms = options?.max_focus_terms ?? 5;
  const defaultMonitoringWindow = monitoringWindows.includes('past 7 days')
    ? 'past 7 days'
    : monitoringWindows[0] ?? 'past 7 days';
  const defaultAnalysisMode = analysisModes.includes('fast_draft')
    ? 'fast_draft'
    : analysisModes[0] ?? 'fast_draft';

  const [place, setPlace] = useState(options?.default_place ?? 'Philippines');
  const [monitoringWindow, setMonitoringWindow] = useState<MonitoringWindow>(defaultMonitoringWindow);
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>(defaultAnalysisMode);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(defaultCategories.slice(0, maxThemes));
  const [focusInput, setFocusInput] = useState('');

  const report = analysis?.sentiment_report;
  const metrics = report?.metrics;
  const selectedThemeNames = useMemo(
    () => (analysis?.prioritize_themes?.length ? analysis.prioritize_themes : selectedCategories),
    [analysis?.prioritize_themes, selectedCategories],
  );
  const sentimentRows = [
    {label:'Positive', val:metrics?.positive_pct ?? 0, cls:'pos'},
    {label:'Negative', val:metrics?.negative_pct ?? 0, cls:'neg'},
    {label:'Neutral',  val:metrics?.neutral_pct ?? 0, cls:'neu'},
  ];

  const toggleCategory = (category: string) => {
    setSelectedCategories(prev => {
      if (prev.includes(category)) {
        return prev.length === 1 ? prev : prev.filter(item => item !== category);
      }
      return prev.length >= maxThemes ? prev : [...prev, category];
    });
  };

  const submit = () => {
    onAnalyze({
      place,
      monitoring_window: monitoringWindow,
      prioritize_themes: selectedCategories,
      focus_terms: parseFocusTerms(focusInput, maxFocusTerms),
      analysis_mode: analysisMode,
    });
  };

  const running = status === 'running';
  const progressMeta = [
    typeof progress?.iteration === 'number' && typeof progress?.max_iterations === 'number'
      ? `cycle ${progress.iteration}/${progress.max_iterations}`
      : null,
    typeof progress?.source_count === 'number' ? `${progress.source_count} sources` : null,
    typeof progress?.signal_count === 'number' ? `${progress.signal_count} signals` : null,
  ].filter(Boolean).join(' · ');

  return (
    <div className="fade-in">
      <div className="stats-row" style={{gridTemplateColumns:'repeat(3,1fr)', marginBottom:16}}>
        {[
          {label:'Overall sentiment', val:report?.overall_label ?? 'No report', cls:'green'},
          {label:'Negative signals',  val:`${metrics?.negative_pct ?? 0}%`,   cls:'rust'},
          {label:'Topics tracked',    val:String(analysis?.prioritize_themes.length ?? selectedCategories.length),     cls:''},
        ].map((s, i) => (
          <div className="stat-card" key={i}>
            <div className="stat-label">{s.label}</div>
            <div className={`stat-val ${s.cls}`} style={{fontSize:28}}>{s.val}</div>
          </div>
        ))}
      </div>

      <div className="panel analysis-run-panel">
        <div className="panel-head">
          <span className="panel-title">Philippines Intelligence Run</span>
          <span className="panel-action">{formatUpdatedAt(latestUpdatedAt)}</span>
        </div>
        <div className="analysis-controls">
          <label className="analysis-field">
            <span>Location</span>
            <select value={place} onChange={event => setPlace(event.target.value)}>
              {locations.map(location => <option key={location} value={location}>{location}</option>)}
            </select>
          </label>
          <label className="analysis-field">
            <span>Timeframe</span>
            <select value={monitoringWindow} onChange={event => setMonitoringWindow(event.target.value as MonitoringWindow)}>
              {monitoringWindows.map(window => <option key={window} value={window}>{window}</option>)}
            </select>
          </label>
          <label className="analysis-field">
            <span>Mode</span>
            <select value={analysisMode} onChange={event => setAnalysisMode(event.target.value as AnalysisMode)}>
              {analysisModes.map(mode => <option key={mode} value={mode}>{mode.replace('_', ' ')}</option>)}
            </select>
          </label>
          <label className="analysis-field focus">
            <span>Focus terms</span>
            <input
              value={focusInput}
              onChange={event => setFocusInput(event.target.value)}
              placeholder="optional: floods, jeepney fare, power outage"
            />
          </label>
        </div>
        <div className="category-grid">
          {categories.map(category => (
            <button
              key={category}
              className={`category-chip ${selectedCategories.includes(category) ? 'active' : ''}`}
              onClick={() => toggleCategory(category)}
            >
              {category}
            </button>
          ))}
        </div>
        <div className="analysis-run-footer">
          <div className="analysis-status-text">
            {error || (running ? (progress?.label ?? 'Running cyclic RAG analysis') : analysis ? `${analysis.place} · ${analysis.monitoring_window}` : 'Cached report will appear here')}
          </div>
          <button className="topbar-btn primary" onClick={submit} disabled={running || selectedCategories.length === 0}>
            {running ? 'Analyzing...' : 'Analyze / Refresh'}
          </button>
        </div>
        {running && (
          <div className="analysis-progress">
            <div className="analysis-progress-track">
              <div className="analysis-progress-fill" style={{width:`${progressPercent(progress)}%`}}></div>
            </div>
            <div className="analysis-progress-meta">
              <span>{progress?.node?.replace('_', ' ') ?? 'starting'}</span>
              <span>{progressMeta || 'streaming updates'}</span>
            </div>
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">Selected Category Context</span>
          <span className="panel-action">{report ? 'backend metrics' : 'waiting for run'}</span>
        </div>
        <div className="sentiment-map">
          <div className="sentiment-topic">
            <div className="sent-title">{report?.overall_label ?? 'Awaiting backend sentiment'}</div>
            {report ? (
              <div className="sent-bars">
                {sentimentRows.map((row, j) => (
                  <div className="sent-row" key={j}>
                    <span className="sent-label">{row.label}</span>
                    <div className="sent-bar"><div className={`sent-fill ${row.cls}`} style={{width:`${row.val}%`}}></div></div>
                    <span className="sent-pct">{row.val}%</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-desc" style={{textAlign:'left'}}>Run an analysis or load a cached report to populate the backend sentiment distribution.</div>
            )}
          </div>
          <div className="sentiment-topic">
            <div className="sent-title">Categories sent to analysis</div>
            <div className="category-grid" style={{padding:0}}>
              {selectedThemeNames.map(theme => (
                <span className="category-chip active" key={theme}>{theme}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {analysis && report && (
        <div className="dash-grid" style={{marginTop:16}}>
          <div className="panel">
            <div className="panel-head">
              <span className="panel-title">Source-Level Signals</span>
              <span className="panel-action">{report.source_signals.length} signals</span>
            </div>
            {report.source_signals.map((signal, index) => (
              <div className="signal-item" key={`${signal.source}-${index}`} style={{padding:'16px 20px'}}>
                <div className={`signal-dot ${signal.verification === 'unverified' ? 'high' : signal.sentiment === 'Negative' ? 'medium' : 'low'}`}></div>
                <div className="signal-content">
                  <div className="signal-text" style={{whiteSpace:'normal', fontSize:14}}>{signal.summary}</div>
                  <div className="signal-meta" style={{marginTop:6}}>
                    {signal.url
                      ? <a className="source-link" href={signal.url} target="_blank" rel="noreferrer">{signal.source}</a>
                      : <span className="signal-source">{signal.source}</span>
                    }
                    <span className="signal-time">{signal.sentiment}</span>
                    <span className="signal-time">{signal.credibility ?? 'Unverified'} · {signal.credibility_score ?? 0}/100</span>
                    <span className={`report-badge ${signal.verification === 'verified' ? 'verified' : 'flagged'}`}>{signal.verification}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="panel">
            <div className="panel-head">
              <span className="panel-title">Quality Gate</span>
              <span className={`report-badge ${analysis.quality.passed ? 'verified' : 'pending'}`}>
                {Math.round(analysis.quality.score * 100)}
              </span>
            </div>
            <div className="analysis-report-body">
              <div className="analysis-overview">{report.overview}</div>
              {report.actionable_insights.map((insight, index) => (
                <div className="analysis-insight" key={index}>{insight}</div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
