import { REPORTS } from '@/lib/consoleData';
import type { AnalysisResponse } from '@/lib/analysisApi';

function formatUpdatedAt(value: string | null) {
  if (!value) return 'No cached run';
  try {
    return new Intl.DateTimeFormat('en', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return 'Cached run';
  }
}

interface ReportsViewProps {
  analysis: AnalysisResponse | null;
  latestUpdatedAt: string | null;
}

export default function ReportsView({ analysis, latestUpdatedAt }: ReportsViewProps) {
  const latestScore = Math.round((analysis?.quality?.score ?? 0) * 100);
  const report = analysis?.sentiment_report;
  const metrics = report?.metrics;
  return (
    <div className="fade-in">
      {analysis && (
        <div className="panel latest-report-panel">
          <div className="panel-head">
            <span className="panel-title">Latest Cached Intelligence Report</span>
            <span className={`report-badge ${analysis.quality.passed ? 'verified' : 'pending'}`}>
              {analysis.quality.passed ? 'verified' : 'review'}
            </span>
          </div>
          <div className="latest-report-body">
            <div className="latest-report-hero">
              <div>
                <div className="latest-report-kicker">{analysis.place} · {analysis.monitoring_window}</div>
                <h2>{report?.overall_label ?? 'Generated Intelligence Report'}</h2>
                <p>{report?.overview || 'The generated report is available below. Run a refresh to populate structured sentiment, source, and action data.'}</p>
              </div>
              <div className="latest-report-score">
                <span>{latestScore}</span>
                <small>quality score</small>
              </div>
            </div>

            <div className="report-summary-grid">
              <div className="report-summary-item">
                <span>Signals</span>
                <strong>{metrics?.signal_count ?? 0}</strong>
              </div>
              <div className="report-summary-item">
                <span>Credibility</span>
                <strong>{metrics?.credibility_pct ?? 0}%</strong>
              </div>
              <div className="report-summary-item">
                <span>Verified</span>
                <strong>{metrics?.verified_pct ?? 0}%</strong>
              </div>
              <div className="report-summary-item">
                <span>Updated</span>
                <strong>{formatUpdatedAt(latestUpdatedAt)}</strong>
              </div>
            </div>

            <div className="report-section">
              <div className="report-section-title">Themes</div>
              <div className="report-chip-row">
                {analysis.prioritize_themes.map(theme => (
                  <span className="category-chip active" key={theme}>{theme}</span>
                ))}
              </div>
            </div>

            {report?.actionable_insights?.length ? (
              <div className="report-section">
                <div className="report-section-title">Recommended Actions</div>
                <div className="recommendation-list">
                  {report.actionable_insights.map((insight, index) => (
                    <div className="recommendation-item" key={index}>
                      <span>{index + 1}</span>
                      <p>{insight}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {report?.source_signals?.length ? (
              <div className="report-section">
                <div className="report-section-title">Linked Sources</div>
                <div className="linked-source-list">
                  {report.source_signals.map((signal, index) => (
                    <div className="linked-source-item" key={`${signal.source}-${index}`}>
                      <div>
                        <div className="linked-source-title">{signal.title || signal.source}</div>
                        <div className="linked-source-meta">
                          {signal.sentiment} · {signal.credibility} · {signal.credibility_score}/100
                        </div>
                      </div>
                      {signal.url ? (
                        <a className="topbar-btn" href={signal.url} target="_blank" rel="noreferrer">Open source</a>
                      ) : (
                        <span className="report-badge pending">no link</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <details className="full-report-details">
              <summary>Full generated report</summary>
              <pre className="analysis-report-text">{analysis.final_report}</pre>
            </details>
          </div>
        </div>
      )}
      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">Sample Report Archive</span>
          <span className="panel-action">demo data</span>
        </div>
        {REPORTS.map((r, i) => (
          <div className="report-item" key={i}>
            <div className={`report-icon ${r.status}`}>
              {r.status === 'verified' ? '✓' : r.status === 'flagged' ? '⚠' : '…'}
            </div>
            <div className="report-body">
              <div className="report-title">{r.title}</div>
              <div className="report-meta">{r.time} · Score: {r.score}/100</div>
            </div>
            <span className={`report-badge ${r.status}`}>{r.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
