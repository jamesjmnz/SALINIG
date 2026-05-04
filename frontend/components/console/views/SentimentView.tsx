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
  SpikeDetectionResult,
} from '@/lib/analysisApi';

interface SentimentViewProps {
  analysis: AnalysisResponse | null;
  options: AnalysisOptions | null;
  latestUpdatedAt: string | null;
  status: AnalysisStatus;
  progress: AnalysisProgressEvent | null;
  error: string | null;
  onAnalyze: (payload: AnalyzePayload) => Promise<void>;
  onSaveReport: () => Promise<void>;
  saveStatus: 'idle' | 'saving' | 'error';
  saveError: string | null;
  savedReportId: string | null;
}

function formatUpdatedAt(value: string | null) {
  if (!value) return 'No saved report';
  try {
    const formatted = new Intl.DateTimeFormat('en', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
    return `Saved ${formatted}`;
  } catch {
    return 'Saved report';
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
    evidence_gate: 43,
    analysis: 52,
    insight: 68,
    claim_verification: 74,
    citation_validation: 78,
    evaluate: 88,
    learn: 92,
    save: 96,
    complete: 96,
    finalize: 96,
    insufficient_evidence: 100,
    analysis_service: 100,
  };
  if (!progress) return 0;
  if (progress.type === 'final') return 100;
  return stages[progress.node ?? ''] ?? 10;
}

function SpikeBanner({ spike }: { spike: SpikeDetectionResult }) {
  const isActive = spike.spike_level === 'ACTIVE_SPIKE';
  const color = isActive ? 'var(--rust)' : '#d97706';
  const bg = isActive ? 'rgba(196,69,69,0.07)' : 'rgba(217,119,6,0.07)';
  const label = isActive ? 'ACTIVE SPIKE' : 'RISING SIGNAL';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '9px 16px', marginBottom: 12,
      background: bg, border: `1px solid ${color}`,
      borderRadius: 8, fontSize: 12,
    }}>
      <span style={{
        padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 700,
        background: color, color: '#fff', letterSpacing: '0.05em',
        fontFamily: 'var(--font-dm-mono), monospace',
      }}>{label}</span>
      <span style={{ color: 'var(--fg)', fontWeight: 600 }}>
        Score {Math.round(spike.spike_score * 100)}
      </span>
      <span style={{ color: 'var(--muted)' }}>·</span>
      <span style={{ color: 'var(--muted)' }}>{spike.history_count} historical notes</span>
      <span style={{ color: 'var(--muted)' }}>·</span>
      <span style={{ color: 'var(--muted)' }}>{spike.recent_note_count} recent</span>
      {!spike.velocity_available && (
        <>
          <span style={{ color: 'var(--muted)' }}>·</span>
          <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>velocity signal pending data</span>
        </>
      )}
    </div>
  );
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
  onSaveReport,
  saveStatus,
  saveError,
  savedReportId,
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
  const diagnostics = analysis?.diagnostics;
  const evidenceSufficiency = diagnostics?.evidence_sufficiency;
  const claimVerification = diagnostics?.claim_verification;
  const spike = analysis?.spike_detection ?? diagnostics?.spike_detection ?? null;
  const showSpike = spike && spike.spike_level !== 'BASELINE';
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
  const saveDisabled = !analysis || running || saveStatus === 'saving';
  const saveLabel = savedReportId
    ? 'Open Saved Report'
    : saveStatus === 'saving'
    ? 'Saving...'
    : 'Save Report';
  const saveHint = savedReportId
    ? 'This run is already in your saved archive.'
    : analysis && !analysis.quality.passed
    ? 'This run can still be saved. It will be marked as review in the archive.'
    : saveError;
  const progressMeta = [
    typeof progress?.iteration === 'number' && typeof progress?.max_iterations === 'number'
      ? `cycle ${progress.iteration}/${progress.max_iterations}`
      : null,
    typeof progress?.source_count === 'number' ? `${progress.source_count} sources` : null,
    typeof progress?.signal_count === 'number' ? `${progress.signal_count} signals` : null,
  ].filter(Boolean).join(' · ');

  return (
    <div className="fade-in">
      {showSpike && spike ? <SpikeBanner spike={spike} /> : null}
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
            {error || (running ? (progress?.label ?? 'Running cyclic RAG analysis') : analysis ? `${analysis.place} · ${analysis.monitoring_window} · ${analysis.analysis_status.replace('_', ' ')}` : 'Saved report detail will appear here after a successful run')}
          </div>
          <div className="analysis-run-actions">
            {analysis ? (
              <button
                className="topbar-btn"
                onClick={() => {
                  void onSaveReport();
                }}
                disabled={saveDisabled}
                title={saveHint ?? undefined}
              >
                {saveLabel}
              </button>
            ) : null}
            <button className="topbar-btn primary" onClick={submit} disabled={running || selectedCategories.length === 0}>
              {running ? 'Analyzing...' : 'Analyze / Refresh'}
            </button>
          </div>
        </div>
        {saveHint ? <div className="analysis-save-note">{saveHint}</div> : null}
        {analysis?.analysis_status === 'insufficient_evidence' && evidenceSufficiency?.reasons?.length ? (
          <div className="analysis-save-note" style={{ color: 'var(--rust)' }}>
            {evidenceSufficiency.reasons.join(' ')}
          </div>
        ) : null}
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

      {analysis && (
        <div className="dash-grid" style={{ marginTop: 16 }}>
          <div className="panel">
            <div className="panel-head">
              <span className="panel-title">Evidence Gate</span>
              <span className="panel-action">{evidenceSufficiency?.checked ? (evidenceSufficiency.passed ? 'passed' : 'hold') : 'waiting'}</span>
            </div>
            <div style={{ padding: '0 20px 18px', display: 'grid', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--muted)' }}>Ranked sources</span>
                <strong>{evidenceSufficiency?.source_count ?? 0}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--muted)' }}>Unique domains</span>
                <strong>{evidenceSufficiency?.unique_domain_count ?? 0}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--muted)' }}>Official sources</span>
                <strong>{evidenceSufficiency?.official_source_count ?? 0}</strong>
              </div>
              {(evidenceSufficiency?.reasons?.length ?? 0) > 0 ? (
                <div className="report-note-list">
                  {evidenceSufficiency?.reasons.map(reason => (
                    <div className="report-note-item" key={reason}>{reason}</div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
                  The backend now checks whether the run has enough source depth before generating the report.
                </div>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <span className="panel-title">Claim Verification</span>
              <span className="panel-action">{claimVerification?.checked ? claimVerification.model : 'waiting'}</span>
            </div>
            <div style={{ padding: '0 20px 18px', display: 'grid', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--muted)' }}>Claims checked</span>
                <strong>{claimVerification?.claims.length ?? 0}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--muted)' }}>Verified</span>
                <strong>{claimVerification?.verified_claim_count ?? 0}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--muted)' }}>Unsupported</span>
                <strong>{claimVerification?.unsupported_claim_count ?? 0}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--muted)' }}>Contradicted</span>
                <strong>{claimVerification?.contradicted_claim_count ?? 0}</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {analysis && report && report.source_signals.length ? (
        <div className="panel" style={{ marginTop: 16 }}>
          <div className="panel-head">
            <span className="panel-title">Source-Level Signals</span>
            <span className="panel-action">{report.source_signals.length} signals</span>
          </div>
          {report.source_signals.map((signal, index) => (
            <div className="signal-item" key={`${signal.source}-${index}`} style={{ padding: '14px 20px' }}>
              <div className={`signal-dot ${signal.verification === 'unverified' ? 'high' : signal.sentiment === 'Negative' ? 'medium' : 'low'}`}></div>
              <div className="signal-content">
                <div className="signal-text" style={{ whiteSpace: 'normal', fontSize: 13 }}>{signal.summary}</div>
                <div className="signal-meta" style={{ marginTop: 5 }}>
                  {signal.url
                    ? <a className="source-link" href={signal.url} target="_blank" rel="noreferrer">{signal.source}</a>
                    : <span className="signal-source">{signal.source}</span>
                  }
                  <span className="signal-time">S{signal.source_index}</span>
                  <span className="signal-time">{signal.sentiment}</span>
                  <span className="signal-time">{signal.credibility ?? 'Unverified'} · {signal.credibility_score ?? 0}/100</span>
                  <span className={`report-badge ${signal.verification === 'verified' ? 'verified' : 'flagged'}`}>{signal.verification}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

    </div>
  );
}
