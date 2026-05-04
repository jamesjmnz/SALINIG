'use client';

import { useEffect, useState } from 'react';
import type { AnalysisResponse, SavedAnalysisRecord, SavedAnalysisSummary } from '@/lib/analysisApi';
import { fetchSavedReport, fetchSavedReports } from '@/lib/analysisApi';

function formatUpdatedAt(value: string | null) {
  if (!value) return 'No saved timestamp';
  try {
    return new Intl.DateTimeFormat('en', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return 'Saved report';
  }
}

function formatBreakdownLabel(value: string) {
  return value
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}


interface ReportsViewProps {
  analysis: AnalysisResponse | null;
  latestUpdatedAt: string | null;
  focusedReportId: string | null;
  onFocusReport: (reportId: string | null) => void;
}

export default function ReportsView({ analysis, latestUpdatedAt, focusedReportId, onFocusReport }: ReportsViewProps) {
  const [reports, setReports] = useState<SavedAnalysisSummary[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<SavedAnalysisRecord | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const selectedId = focusedReportId ?? reports[0]?.report_id ?? null;

  useEffect(() => {
    let cancelled = false;

    async function loadReports() {
      setListLoading(true);
      setError(null);
      try {
        const response = await fetchSavedReports();
        if (cancelled) return;
        setReports(response.reports);
        if (focusedReportId && !response.reports.some(report => report.report_id === focusedReportId)) {
          onFocusReport(response.reports[0]?.report_id ?? null);
        }
        if (!response.reports.length) setSelectedRecord(null);
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load saved reports.');
        setReports([]);
        onFocusReport(null);
        setSelectedRecord(null);
      } finally {
        if (!cancelled) setListLoading(false);
      }
    }

    loadReports();
    return () => { cancelled = true; };
  }, [analysis, latestUpdatedAt, focusedReportId, onFocusReport]);

  useEffect(() => {
    let cancelled = false;

    async function loadDetail(reportId: string) {
      setError(null);
      try {
        const record = await fetchSavedReport(reportId);
        if (cancelled) return;
        setSelectedRecord(record);
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load saved report detail.');
        setSelectedRecord(null);
      }
    }

    if (!selectedId) {
      return () => { cancelled = true; };
    }

    if (selectedRecord?.report_id === selectedId) {
      return () => { cancelled = true; };
    }

    loadDetail(selectedId);
    return () => { cancelled = true; };
  }, [selectedId, selectedRecord?.report_id]);

  const selectedSummary = reports.find(report => report.report_id === selectedId) ?? null;
  const selectedDetail = selectedRecord?.report_id === selectedId ? selectedRecord : null;

  return (
    <div className="fade-in reports-page">
      <section className="panel saved-reports-shell">
        <div className="saved-reports-sidebar">
          <div className="panel-head">
            <span className="panel-title">Saved Reports</span>
            <span className="panel-action">{reports.length} stored</span>
          </div>
          <div className="saved-reports-sidebar-body">
            <div className="saved-reports-intro">
              <h2>Archive of analyst-selected runs</h2>
              <p>Save any run from Sentiment, then open it here later for review, comparison, and sharing.</p>
            </div>

            {error ? <div className="saved-reports-error">{error}</div> : null}

            <div className="saved-report-list">
              {listLoading ? (
                <div className="saved-reports-placeholder">Loading saved reports...</div>
              ) : reports.length ? (
                reports.map(report => {
                  const score = Math.round(report.quality_score * 100);
                  return (
                    <button
                      className={`saved-report-item ${selectedId === report.report_id ? 'active' : ''}`}
                      key={report.report_id}
                      onClick={() => onFocusReport(report.report_id)}
                    >
                      <div className="saved-report-item-head">
                        <span className={`report-status-pill ${report.quality_passed ? 'verified' : 'pending'}`}>
                          {report.quality_passed ? 'saved' : 'review'}
                        </span>
                        <strong>{score}</strong>
                      </div>
                      <div className="saved-report-item-title">{report.title}</div>
                      <div className="saved-report-item-label">{report.overall_label || 'Saved intelligence report'}</div>
                      <div className="saved-report-item-meta">
                        <span>{report.place}</span>
                        <span>{report.monitoring_window}</span>
                      </div>
                      <div className="saved-report-item-footer">
                        <span>{formatUpdatedAt(report.saved_at)}</span>
                        <span>{report.signal_count} signals</span>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="saved-reports-placeholder">
                  No saved reports yet. Save a run to add it to this archive.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="saved-reports-detail">
          {selectedId && !selectedDetail ? (
            <div className="report-empty-state">
              <span className="report-empty-kicker">Loading</span>
              <h2>Preparing saved report detail</h2>
              <p>The selected report is being loaded from the archive.</p>
            </div>
          ) : selectedDetail && selectedSummary ? (
            <SavedReportDetail report={selectedDetail} />
          ) : (
            <div className="report-empty-state">
              <span className="report-empty-kicker">Saved Reports</span>
              <h2>No report selected</h2>
              <p>Select a saved run from the archive to inspect its full detail, evidence, and evaluator notes.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

interface SavedReportDetailProps {
  report: SavedAnalysisRecord;
}

function SavedReportDetail({ report }: SavedReportDetailProps) {
  const analysis = report.analysis;
  const latestScore = Math.round((analysis.quality?.score ?? analysis.quality_score ?? 0) * 100);
  const sentimentReport = analysis.sentiment_report;
  const metrics = sentimentReport?.metrics;
  const diagnostics = analysis.diagnostics;
  const evidenceSufficiency = diagnostics?.evidence_sufficiency;
  const claimVerification = diagnostics?.claim_verification;
  const breakdown = Object.entries(analysis.quality?.breakdown ?? analysis.quality_breakdown ?? {});
  const knowledgeGaps = analysis.quality?.knowledge_gaps?.length
    ? analysis.quality.knowledge_gaps
    : analysis.knowledge_gaps;
  const blockingIssues = analysis.quality?.blocking_issues?.length
    ? analysis.quality.blocking_issues
    : analysis.blocking_issues;
  const sentimentRows = [
    { label: 'Pos', value: metrics?.positive_pct ?? 0, tone: 'positive' },
    { label: 'Neu', value: metrics?.neutral_pct ?? 0, tone: 'neutral' },
    { label: 'Neg', value: metrics?.negative_pct ?? 0, tone: 'negative' },
  ];

  return (
    <div className="saved-report-detail-inner">

      {/* Compact header */}
      <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span className={`report-status-pill ${analysis.quality.passed ? 'verified' : 'pending'}`}>
                {analysis.quality.passed ? 'saved' : 'review'}
              </span>
              <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                {analysis.place} · {analysis.monitoring_window} · {formatUpdatedAt(report.saved_at)}
              </span>
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.3, color: 'var(--text)', margin: 0 }}>
              {sentimentReport?.overall_label ?? 'Saved Intelligence Report'}
            </h2>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6, lineHeight: 1.5 }}>
              {sentimentReport?.overview || 'This saved report is available for review below.'}
            </p>
            <div className="report-chip-row" style={{ marginTop: 10 }}>
              {analysis.prioritize_themes.map(theme => (
                <span className="category-chip active" key={theme}>{theme}</span>
              ))}
            </div>
          </div>
          <div style={{ flexShrink: 0, textAlign: 'right' }}>
            <div style={{ fontSize: 32, fontFamily: 'var(--font-instrument-serif), serif', lineHeight: 1, color: 'var(--text)' }}>{latestScore}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>quality score</div>
          </div>
        </div>
      </div>

      {/* Body: main + sidebar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 220px', gap: 0 }}>

        {/* Main column */}
        <div style={{ borderRight: '1px solid var(--border)', minWidth: 0 }}>

          {/* Insights */}
          {sentimentReport?.actionable_insights?.length ? (
            <div style={{ borderBottom: '1px solid var(--border)', padding: '16px 24px' }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: 10 }}>
                Recommendations
              </div>
              <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
                {sentimentReport.actionable_insights.map((insight, index) => (
                  <li key={index} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 10, fontFamily: 'var(--font-dm-mono), monospace', color: 'var(--muted)', paddingTop: 2, flexShrink: 0, minWidth: 16 }}>
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{insight}</span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          {/* Sources */}
          {sentimentReport?.source_signals?.length ? (
            <div style={{ borderBottom: '1px solid var(--border)' }}>
              <div style={{ padding: '12px 24px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)' }}>Sources</span>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>{sentimentReport.source_signals.length}</span>
              </div>
              {sentimentReport.source_signals.map((signal, index) => (
                <div className="signal-item" key={`${signal.source}-${index}`} style={{ padding: '10px 24px' }}>
                  <div className={`signal-dot ${signal.verification === 'unverified' ? 'high' : signal.sentiment === 'Negative' ? 'medium' : 'low'}`}></div>
                  <div className="signal-content">
                    <div className="signal-text" style={{ fontSize: 13, whiteSpace: 'normal' }}>{signal.summary}</div>
                    <div className="signal-meta" style={{ marginTop: 4 }}>
                      {signal.url
                        ? <a className="source-link" href={signal.url} target="_blank" rel="noreferrer">{signal.source}</a>
                        : <span className="signal-source">{signal.source}</span>
                      }
                      <span className="signal-time">{signal.sentiment}</span>
                      <span className="signal-time">{signal.credibility_score ?? 0}/100</span>
                      <span className={`report-badge ${signal.verification === 'verified' ? 'verified' : 'flagged'}`}>{signal.verification}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {/* Risks & gaps — only if present */}
          {(blockingIssues.length || knowledgeGaps.length) ? (
            <div style={{ borderBottom: '1px solid var(--border)', padding: '16px 24px', display: 'grid', gap: 12 }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)' }}>Risks & Gaps</div>
              {blockingIssues.length ? (
                <div className="report-note-list">
                  {blockingIssues.map(issue => <div className="report-note-item" key={issue}>{issue}</div>)}
                </div>
              ) : null}
              {knowledgeGaps.length ? (
                <div className="report-note-list">
                  {knowledgeGaps.map(gap => <div className="report-note-item" key={gap}>{gap}</div>)}
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Raw report */}
          <div style={{ padding: '16px 24px' }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: 10 }}>
              Full Report
            </div>
            <pre className="analysis-report-text" style={{ maxHeight: 320, overflow: 'auto' }}>{analysis.final_report}</pre>
          </div>
        </div>

        {/* Sidebar — single panel, no separate sub-panels */}
        <div style={{ padding: '16px', display: 'grid', gap: 20, alignContent: 'start' }}>

          {/* Sentiment bars */}
          <div>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: 8 }}>Sentiment</div>
            <div style={{ display: 'grid', gap: 6 }}>
              {sentimentRows.map(row => (
                <div key={row.label} style={{ display: 'grid', gridTemplateColumns: '28px 1fr 28px', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>{row.label}</span>
                  <div style={{ height: 4, background: 'var(--bg3)', borderRadius: 2, overflow: 'hidden' }}>
                    <div className={`report-balance-fill ${row.tone}`} style={{ width: `${row.value}%`, height: '100%' }}></div>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text)', textAlign: 'right' }}>{row.value}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Score breakdown */}
          {breakdown.length ? (
            <div>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: 8 }}>Score Breakdown</div>
              <div className="score-breakdown">
                {breakdown.map(([key, value]) => {
                  const percent = Math.round(value * 100);
                  return (
                    <div className="score-row" key={key}>
                      <span className="score-row-label">{formatBreakdownLabel(key)}</span>
                      <div className="score-row-bar">
                        <div className="score-row-fill" style={{ width: `${percent}%` }}></div>
                      </div>
                      <span className="score-row-val">{percent}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* Contradictions */}
          {claimVerification?.contradictions?.length ? (
            <div>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: 8 }}>Contradictions</div>
              <div className="report-note-list">
                {claimVerification.contradictions.map(item => (
                  <div className="report-note-item" key={`${item.claim_id}-${item.source_index}`} style={{ fontSize: 11 }}>
                    {item.claim_text} ({item.source_title})
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Run metadata */}
          <div>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: 8 }}>Run Info</div>
            <div style={{ display: 'grid', gap: 6 }}>
              {[
                { label: 'Mode', value: analysis.analysis_mode.replace('_', ' ') },
                { label: 'Signals', value: String(metrics?.signal_count ?? 0) },
                { label: 'Verified', value: `${metrics?.verified_pct ?? 0}%` },
                { label: 'Misinfo risk', value: `${metrics?.misinfo_risk_pct ?? 0}%` },
                { label: 'Evidence gate', value: evidenceSufficiency?.checked ? (evidenceSufficiency.passed ? 'passed' : 'hold') : 'n/a' },
                { label: 'Memory', value: analysis.memory_saved ? 'saved' : analysis.memory_duplicate ? 'duplicate' : 'skipped' },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: 'var(--muted)' }}>{row.label}</span>
                  <strong style={{ fontWeight: 500 }}>{row.value}</strong>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
