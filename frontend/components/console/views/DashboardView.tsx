'use client';

import { useState, useEffect } from 'react';
import type { AnalysisProgressEvent, AnalysisResponse, AnalysisStatus } from '@/lib/analysisApi';

function LiveCounter({ target, suffix }: { target: number; suffix: string }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let cur = 0;
    const step = Math.ceil(target / 40);
    const iv = setInterval(() => {
      cur = Math.min(cur + step, target);
      setVal(cur);
      if (cur >= target) clearInterval(iv);
    }, 20);
    return () => clearInterval(iv);
  }, [target]);
  return <>{val.toLocaleString()}{suffix}</>;
}

interface TrendPoint {
  label: string;
  value: number;
}

function MiniChart({ points }: { points: TrendPoint[] }) {
  const max = Math.max(...points.map(point => point.value), 1);
  return (
    <div className="mini-chart">
      <div style={{fontSize:11, fontFamily:'var(--font-dm-mono), monospace', color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:12}}>Credibility per signal · latest run</div>
      <div className="chart-bars">
        {points.map((point, i) => (
          <div key={i} className={`chart-bar ${i === points.length - 1 ? 'active' : ''}`}
            style={{height:`${(point.value/max)*100}%`}} title={`${point.label}: ${point.value}`}></div>
        ))}
      </div>
      <div className="chart-labels">
        {points.map((point, i) => i % 2 === 0
          ? <span key={i} className="chart-label">{point.label}</span>
          : <span key={i} className="chart-label"></span>
        )}
      </div>
    </div>
  );
}

function ScoreRing({
  credibilityPct,
  qualityScore,
  hasAnalysis,
}: {
  credibilityPct: number;
  qualityScore: number;
  hasAnalysis: boolean;
}) {
  const credibilityRatio = Math.max(0, Math.min(1, credibilityPct / 100));
  const qualityPct = Math.round(Math.max(0, Math.min(1, qualityScore)) * 100);
  return (
    <>
      <div className="score-ring-wrap">
        <svg width="80" height="80" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="32" fill="none" stroke="var(--border)" strokeWidth="7"/>
          <circle cx="40" cy="40" r="32" fill="none" stroke="var(--green)" strokeWidth="7"
            strokeDasharray={`${credibilityRatio * 2 * Math.PI * 32} ${2 * Math.PI * 32}`}
            strokeLinecap="round" strokeDashoffset={2*Math.PI*32*0.25}
            style={{transition:'stroke-dasharray 1s ease'}}/>
          <text x="40" y="44" textAnchor="middle" fontFamily="var(--font-instrument-serif), serif" fontSize="18" fill="var(--text)">{credibilityPct}</text>
        </svg>
        <div className="score-ring-info">
          <div className="score-ring-val">{credibilityPct}<span style={{fontSize:18, color:'var(--muted)'}}>/100</span></div>
          <div className="score-ring-label">{hasAnalysis ? 'Current credibility' : 'Waiting for first run'}</div>
        </div>
      </div>
      <div className="score-breakdown">
        {[
          {label:'Quality gate',           val:qualityPct, pct:String(qualityPct)},
          {label:'Verified signals',       val:credibilityPct, pct:String(credibilityPct)},
          {label:'Source weighting',       val:credibilityPct, pct:String(credibilityPct)},
          {label:'Memory readiness',       val:qualityPct, pct:String(qualityPct)},
        ].map((r, i) => (
          <div className="score-row" key={i}>
            <span className="score-row-label">{r.label}</span>
            <div className="score-row-bar"><div className="score-row-fill" style={{width:`${r.val}%`}}></div></div>
            <span className="score-row-val">{r.pct}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function scoreClass(score: number) {
  if (score >= 75) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

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

function chartPointsFromAnalysis(analysis: AnalysisResponse | null): TrendPoint[] {
  const sourceSignals = analysis?.sentiment_report?.source_signals ?? [];
  return sourceSignals.slice(0, 12).map((signal, index) => ({
    label: `S${index + 1}`,
    value: Math.max(0, signal.credibility_score ?? 0),
  }));
}

interface DashboardViewProps {
  analysis: AnalysisResponse | null;
  latestUpdatedAt: string | null;
  status: AnalysisStatus;
  progress: AnalysisProgressEvent | null;
}

export default function DashboardView({ analysis, latestUpdatedAt, status, progress }: DashboardViewProps) {
  const report = analysis?.sentiment_report;
  const metrics = report?.metrics;
  const diagnostics = analysis?.diagnostics;
  const evidenceSufficiency = diagnostics?.evidence_sufficiency;
  const claimVerification = diagnostics?.claim_verification;
  const hasAnalysis = Boolean(analysis);
  const analysisPlace = analysis?.place ?? 'Awaiting analyzed location';
  const monitoringWindow = analysis?.monitoring_window ?? 'No monitoring window yet';
  const analysisModeLabel = analysis?.analysis_mode ? analysis.analysis_mode.replace('_', ' ') : 'Run mode not started';
  const qualityPassed = analysis?.quality?.passed ?? false;
  const qualityFeedback = analysis?.quality?.feedback || 'Quality review finished';
  const qualityScoreLabel = `${Math.round((analysis?.quality?.score ?? 0) * 100)}/100`;
  const memorySaved = analysis?.memory_saved ?? false;
  const memoryDuplicate = analysis?.memory_duplicate ?? false;
  const signalCount = progress?.signal_count ?? metrics?.signal_count ?? 0;
  const credibilityPct = metrics?.credibility_pct ?? Math.round((progress?.quality_score ?? 0) * 100);
  const qualityScore = analysis?.quality?.score ?? progress?.quality_score ?? 0;
  const runStatusLabel = analysis?.analysis_status === 'insufficient_evidence' ? 'Evidence hold' : 'Grounded run';
  const cacheLabel = status === 'loading-cache'
    ? 'Loading cache'
    : status === 'running'
      ? 'Analysis running'
      : analysis
        ? formatUpdatedAt(latestUpdatedAt)
        : 'No cached run';
  const liveSignals = report?.source_signals?.length
    ? report.source_signals.map((signal, index) => ({
        id: index + 1,
        text: signal.summary || signal.title || 'Evidence-backed public signal',
        source: signal.source || 'source',
        url: signal.url,
        time: report.updated_label || 'latest',
        priority: signal.verification === 'unverified' ? 'high' : signal.sentiment === 'Negative' ? 'medium' : 'low',
        score: String(signal.credibility_score ?? credibilityPct),
        scoreClass: scoreClass(signal.credibility_score ?? credibilityPct),
      }))
    : [];
  const chartPoints = chartPointsFromAnalysis(analysis);
  const runStatusRows = [
    {
      name: 'Cache',
      status: status === 'loading-cache' ? 'busy' : hasAnalysis ? 'running' : 'idle',
      task: status === 'loading-cache'
        ? 'Checking for the latest saved run'
        : hasAnalysis
          ? `Cached ${formatUpdatedAt(latestUpdatedAt)}`
          : 'No cached run found yet',
      cycles: hasAnalysis ? `${metrics?.signal_count ?? liveSignals.length} signals` : 'Waiting',
    },
    {
      name: 'Analysis',
      status: status === 'running' ? 'busy' : hasAnalysis ? 'running' : 'idle',
      task: status === 'running'
        ? (progress?.label ?? 'Preparing analysis')
        : hasAnalysis
          ? `${analysisPlace} · ${monitoringWindow} · ${runStatusLabel}`
          : 'No analysis started',
      cycles: status === 'running'
        ? `${progress?.iteration ?? 0}/${progress?.max_iterations ?? 0}`
        : hasAnalysis
          ? analysisModeLabel
          : 'Standby',
    },
    {
      name: 'Quality',
      status: hasAnalysis ? (qualityPassed ? 'running' : 'busy') : 'idle',
      task: hasAnalysis
        ? qualityFeedback
        : 'Waiting for evaluator output',
      cycles: hasAnalysis ? qualityScoreLabel : 'Pending',
    },
    {
      name: 'Memory',
      status: hasAnalysis ? (memorySaved ? 'running' : 'busy') : 'idle',
      task: hasAnalysis
        ? (memorySaved ? 'Saved to memory layer' : analysis?.analysis_status === 'insufficient_evidence' ? 'Held before synthesis' : 'Ready to save as report')
        : 'No report materialized yet',
      cycles: hasAnalysis ? (memoryDuplicate ? 'duplicate' : 'new') : 'Waiting',
    },
  ] as const;
  const stats = [
    {
      label: 'Cached signals',
      val: signalCount,
      suffix: '',
      cls: '',
      delta: cacheLabel,
      tone: 'neutral' as const,
    },
    {
      label: 'Verified share',
      val: claimVerification?.checked
        ? Math.max(
            0,
            Math.round(
              (claimVerification.verified_claim_count / Math.max(claimVerification.claims.length, 1)) * 100,
            ),
          )
        : metrics?.verified_pct ?? 0,
      suffix: '%',
      cls: 'green',
      delta: analysisPlace,
      tone: 'up' as const,
    },
    {
      label: 'Misinfo risk',
      val: metrics?.misinfo_risk_pct ?? 0,
      suffix: '%',
      cls: 'rust',
      delta: monitoringWindow,
      tone: 'down' as const,
    },
    {
      label: 'Credibility',
      val: evidenceSufficiency?.checked ? evidenceSufficiency.source_count : credibilityPct,
      suffix: evidenceSufficiency?.checked ? '' : '/100',
      cls: '',
      delta: evidenceSufficiency?.checked
        ? `${evidenceSufficiency.unique_domain_count} domains`
        : analysisModeLabel,
      tone: 'neutral' as const,
    },
  ];

  return (
    <div className="fade-in">
      <div className="stats-row">
        {stats.map((s, i) => (
          <div className="stat-card" key={i}>
            <div className="stat-label">{s.label}</div>
            <div className={`stat-val ${s.cls}`}><LiveCounter target={s.val} suffix={s.suffix} /></div>
            <div className="stat-delta">
              {s.tone === 'up' ? <span className="delta-up">↑ {s.delta}</span> : null}
              {s.tone === 'down' ? <span className="delta-dn">↓ {s.delta}</span> : null}
              {s.tone === 'neutral' ? <span>{s.delta}</span> : null}
            </div>
          </div>
        ))}
      </div>

      <div className="dash-grid">
        <div style={{display:'flex', flexDirection:'column', gap:16}}>
          <div className="panel">
            <div className="panel-head">
              <span className="panel-title">Cached Signal Feed</span>
              <span className="panel-action">{liveSignals.length ? 'cached' : hasAnalysis ? 'current run' : 'waiting for analysis'}</span>
            </div>
            <div className="signal-feed">
              {liveSignals.length ? (
                liveSignals.map(s => {
                  const sourceUrl = typeof s.url === 'string' ? s.url : null;
                  return (
                    <div className="signal-item" key={s.id}>
                      <div className={`signal-dot ${s.priority}`}></div>
                      <div className="signal-content">
                        <div className="signal-text">{s.text}</div>
                        <div className="signal-meta">
                          {sourceUrl
                            ? <a className="source-link" href={sourceUrl} target="_blank" rel="noreferrer">{s.source}</a>
                            : <span className="signal-source">{s.source}</span>
                          }
                          <span className="signal-time">{s.time}</span>
                        </div>
                      </div>
                      <div className={`signal-score ${s.scoreClass}`}>{s.score}</div>
                    </div>
                  );
                })
              ) : (
                <div className="empty" style={{ padding: '40px 20px' }}>
                  <div className="empty-title">{hasAnalysis ? 'No source signals in cache' : 'No cached signal feed yet'}</div>
                  <div className="empty-desc">
                    {hasAnalysis
                      ? 'The latest run did not return signal rows for the dashboard feed.'
                      : 'Run an analysis first and the latest evidence queue will appear here.'}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <span className="panel-title">Signal Credibility Spread</span>
              <span className="panel-action">{chartPoints.length ? 'current run' : 'waiting for signals'}</span>
            </div>
            {chartPoints.length ? (
              <MiniChart points={chartPoints} />
            ) : (
              <div className="empty" style={{ padding: '40px 20px' }}>
                <div className="empty-title">No credibility spread yet</div>
                <div className="empty-desc">This panel will chart per-signal credibility once a run returns evidence.</div>
              </div>
            )}
          </div>
        </div>

        <div style={{display:'flex', flexDirection:'column', gap:16}}>
          <div className="panel">
            <div className="panel-head">
              <span className="panel-title">Credibility Score</span>
            </div>
            <ScoreRing credibilityPct={credibilityPct} qualityScore={qualityScore} hasAnalysis={hasAnalysis} />
          </div>

          <div className="panel">
            <div className="panel-head">
              <span className="panel-title">Run Status</span>
              <span className="panel-action">{status.replace('-', ' ')}</span>
            </div>
            {runStatusRows.map((a, i) => (
              <div className="agent-item" key={i}>
                <div className={`agent-status-dot ${a.status}`}></div>
                <span className="agent-name">{a.name}</span>
                <span className="agent-task">{a.task}</span>
                <span className="agent-cycles">{a.cycles}</span>
              </div>
            ))}
          </div>

          <div className="panel">
            <div className="panel-head">
              <span className="panel-title">Grounding Snapshot</span>
              <span className="panel-action">{analysis?.analysis_status ?? 'idle'}</span>
            </div>
            <div style={{ padding: '0 20px 18px', display: 'grid', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--muted)' }}>Evidence gate</span>
                <strong>{evidenceSufficiency?.checked ? (evidenceSufficiency.passed ? 'pass' : 'hold') : 'waiting'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--muted)' }}>Claims verified</span>
                <strong>{claimVerification?.verified_claim_count ?? 0}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--muted)' }}>Unsupported claims</span>
                <strong>{claimVerification?.unsupported_claim_count ?? 0}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--muted)' }}>Contradictions</span>
                <strong>{claimVerification?.contradicted_claim_count ?? 0}</strong>
              </div>
              {(evidenceSufficiency?.reasons?.length ?? 0) > 0 ? (
                <div className="report-note-list">
                  {evidenceSufficiency?.reasons.map(reason => (
                    <div className="report-note-item" key={reason}>{reason}</div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
                  {hasAnalysis ? 'This panel tracks whether the run had enough evidence before synthesis and how well the generated claims were grounded.' : 'Run an analysis to populate grounding diagnostics.'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
