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

function classifyInsightTone(value: string, index: number) {
  const normalized = value.toLowerCase();
  if (normalized.includes('urgent') || normalized.includes('immediately') || normalized.includes('escalat')) {
    return 'urgent';
  }
  if (normalized.includes('monitor') || normalized.includes('track') || normalized.includes('watch')) {
    return 'watch';
  }
  if (normalized.includes('expand') || normalized.includes('opportunity') || normalized.includes('partner')) {
    return 'opportunity';
  }
  return index === 0 ? 'urgent' : index === 1 ? 'watch' : 'opportunity';
}

function qualityTone(score: number) {
  if (score >= 85) return 'strong';
  if (score >= 65) return 'watch';
  return 'weak';
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
            <SavedReportDetail report={selectedDetail} summary={selectedSummary} />
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
  summary: SavedAnalysisSummary;
}

function SavedReportDetail({ report, summary }: SavedReportDetailProps) {
  const analysis = report.analysis;
  const latestScore = Math.round((analysis.quality?.score ?? analysis.quality_score ?? 0) * 100);
  const sentimentReport = analysis.sentiment_report;
  const metrics = sentimentReport?.metrics;
  const breakdown = Object.entries(analysis.quality?.breakdown ?? analysis.quality_breakdown ?? {});
  const knowledgeGaps = analysis.quality?.knowledge_gaps?.length
    ? analysis.quality.knowledge_gaps
    : analysis.knowledge_gaps;
  const blockingIssues = analysis.quality?.blocking_issues?.length
    ? analysis.quality.blocking_issues
    : analysis.blocking_issues;
  const scoreState = qualityTone(latestScore);
  const sentimentRows = [
    { label: 'Positive', value: metrics?.positive_pct ?? 0, tone: 'positive' },
    { label: 'Neutral', value: metrics?.neutral_pct ?? 0, tone: 'neutral' },
    { label: 'Negative', value: metrics?.negative_pct ?? 0, tone: 'negative' },
  ];

  return (
    <div className="saved-report-detail-inner">
      <section className="panel report-spotlight-panel">
        <div className="report-spotlight">
          <div className="report-spotlight-main">
            <div className="report-spotlight-kicker">
              <span>{analysis.place}</span>
              <span>{analysis.monitoring_window}</span>
              <span>{formatUpdatedAt(report.saved_at)}</span>
            </div>
            <h1>{sentimentReport?.overall_label ?? 'Saved Intelligence Report'}</h1>
            <p className="report-spotlight-summary">
              {sentimentReport?.overview || 'This saved report is available for review below.'}
            </p>

            <div className="report-spotlight-grid">
              <div className="report-story-card">
                <span className="report-section-label">Priority themes</span>
                <div className="report-chip-row">
                  {analysis.prioritize_themes.map(theme => (
                    <span className="category-chip active" key={theme}>{theme}</span>
                  ))}
                </div>
              </div>

              <div className="report-story-card">
                <span className="report-section-label">Saved context</span>
                <p className="report-story-note">
                  {summary.title} was saved to your archive and can be reopened here any time.
                </p>
              </div>
            </div>
          </div>

          <aside className="report-spotlight-rail">
            <div className={`report-score-card ${scoreState}`}>
              <div className="report-score-topline">
                <span className={`report-status-pill ${analysis.quality.passed ? 'verified' : 'pending'}`}>
                  {analysis.quality.passed ? 'saved run' : 'needs review'}
                </span>
                <span className="report-score-caption">quality score</span>
              </div>
              <div className="report-score-value">{latestScore}</div>
              <p>{analysis.quality.feedback || analysis.quality_feedback}</p>
            </div>

            <div className="report-quickfacts-card">
              <div className="report-quickfact">
                <span>Saved at</span>
                <strong>{formatUpdatedAt(report.saved_at)}</strong>
              </div>
              <div className="report-quickfact">
                <span>Signals reviewed</span>
                <strong>{metrics?.signal_count ?? 0}</strong>
              </div>
              <div className="report-quickfact">
                <span>Verified evidence</span>
                <strong>{metrics?.verified_pct ?? 0}%</strong>
              </div>
              <div className="report-quickfact">
                <span>Run mode</span>
                <strong>{analysis.analysis_mode.replace('_', ' ')}</strong>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <div className="report-editorial-grid">
        <div className="report-main-column">
          <section className="panel report-module">
            <div className="panel-head">
              <span className="panel-title">Executive Brief</span>
              <span className="panel-action">iteration {analysis.iteration}/{analysis.max_iterations}</span>
            </div>
            <div className="report-brief-grid">
              <article className="report-brief-card">
                <span className="report-section-label">What happened</span>
                <p>{sentimentReport?.overview || 'No structured overview was returned for this report.'}</p>
              </article>
              <article className="report-brief-card accent">
                <span className="report-section-label">Why it matters</span>
                <p>
                  {analysis.quality.feedback || analysis.quality_feedback || 'Quality feedback will appear here after a completed run.'}
                </p>
              </article>
            </div>
          </section>

          {sentimentReport?.actionable_insights?.length ? (
            <section className="panel report-module">
              <div className="panel-head">
                <span className="panel-title">Action Agenda</span>
                <span className="panel-action">{sentimentReport.actionable_insights.length} recommendations</span>
              </div>
              <div className="action-agenda-grid">
                {sentimentReport.actionable_insights.map((insight, index) => (
                  <article className={`action-agenda-card ${classifyInsightTone(insight, index)}`} key={index}>
                    <div className="action-agenda-head">
                      <span className="action-agenda-index">0{index + 1}</span>
                      <span className="action-agenda-tag">{classifyInsightTone(insight, index)}</span>
                    </div>
                    <p>{insight}</p>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {sentimentReport?.source_signals?.length ? (
            <section className="panel report-module">
              <div className="panel-head">
                <span className="panel-title">Evidence Ledger</span>
                <span className="panel-action">linked sources</span>
              </div>
              <div className="evidence-ledger">
                {sentimentReport.source_signals.map((signal, index) => (
                  <article className="evidence-card" key={`${signal.source}-${index}`}>
                    <div className="evidence-card-head">
                      <div>
                        <h3>{signal.title || signal.source}</h3>
                        <p>{signal.summary}</p>
                      </div>
                      <span className={`report-status-pill ${signal.verification === 'verified' ? 'verified' : 'flagged'}`}>
                        {signal.verification}
                      </span>
                    </div>
                    <div className="evidence-card-meta">
                      <span className={`evidence-chip ${signal.sentiment.toLowerCase()}`}>{signal.sentiment}</span>
                      <span className="evidence-chip">{signal.credibility}</span>
                      <span className="evidence-chip">{signal.credibility_score}/100 credibility</span>
                    </div>
                    <div className="evidence-card-footer">
                      <span className="evidence-source-name">{signal.source}</span>
                      {signal.url ? (
                        <a className="topbar-btn" href={signal.url} target="_blank" rel="noreferrer">Open source</a>
                      ) : (
                        <span className="report-status-pill pending">no link</span>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {(blockingIssues.length || knowledgeGaps.length) ? (
            <section className="panel report-module">
              <div className="panel-head">
                <span className="panel-title">Risks And Gaps</span>
                <span className="panel-action">review before escalation</span>
              </div>
              <div className="report-risk-grid">
                <article className="report-risk-card critical">
                  <span className="report-section-label">Blocking issues</span>
                  {blockingIssues.length ? (
                    <div className="report-note-list">
                      {blockingIssues.map(issue => (
                        <div className="report-note-item" key={issue}>{issue}</div>
                      ))}
                    </div>
                  ) : (
                    <p className="report-story-note">No blocking issues were flagged for this run.</p>
                  )}
                </article>
                <article className="report-risk-card">
                  <span className="report-section-label">Knowledge gaps</span>
                  {knowledgeGaps.length ? (
                    <div className="report-note-list">
                      {knowledgeGaps.map(gap => (
                        <div className="report-note-item" key={gap}>{gap}</div>
                      ))}
                    </div>
                  ) : (
                    <p className="report-story-note">No knowledge gaps were returned by the evaluator.</p>
                  )}
                </article>
              </div>
            </section>
          ) : null}

          <section className="panel report-module">
            <div className="panel-head">
              <span className="panel-title">Full Generated Report</span>
              <span className="panel-action">raw output</span>
            </div>
            <div className="report-fulltext-wrap">
              <pre className="analysis-report-text">{analysis.final_report}</pre>
            </div>
          </section>
        </div>

        <div className="report-side-column">
          <section className="panel report-side-panel">
            <div className="panel-head">
              <span className="panel-title">Sentiment Mix</span>
              <span className="panel-action">distribution</span>
            </div>
            <div className="report-balance">
              {sentimentRows.map(row => (
                <div className="report-balance-row" key={row.label}>
                  <div className="report-balance-label">
                    <span>{row.label}</span>
                    <strong>{row.value}%</strong>
                  </div>
                  <div className="report-balance-track">
                    <div className={`report-balance-fill ${row.tone}`} style={{ width: `${row.value}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="panel report-side-panel">
            <div className="panel-head">
              <span className="panel-title">Score Breakdown</span>
              <span className="panel-action">evaluator</span>
            </div>
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
          </section>

          <section className="panel report-side-panel">
            <div className="panel-head">
              <span className="panel-title">Run Facts</span>
              <span className="panel-action">system state</span>
            </div>
            <div className="report-facts-list">
              <div className="report-fact-row">
                <span>Saved at</span>
                <strong>{formatUpdatedAt(report.saved_at)}</strong>
              </div>
              <div className="report-fact-row">
                <span>Monitoring window</span>
                <strong>{analysis.monitoring_window}</strong>
              </div>
              <div className="report-fact-row">
                <span>Memory write</span>
                <strong>{analysis.memory_saved ? 'saved' : analysis.memory_duplicate ? 'duplicate' : 'skipped'}</strong>
              </div>
              <div className="report-fact-row">
                <span>Misinformation risk</span>
                <strong>{metrics?.misinfo_risk_pct ?? 0}%</strong>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
