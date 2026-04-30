'use client';

import { useState, useEffect } from 'react';
import { SIGNALS, AGENTS, CHART_DATA, CHART_LABELS } from '@/lib/consoleData';
import type { AnalysisResponse, AnalysisStatus } from '@/lib/analysisApi';

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

function MiniChart() {
  const max = Math.max(...CHART_DATA);
  return (
    <div className="mini-chart">
      <div style={{fontSize:11, fontFamily:'var(--font-dm-mono), monospace', color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:12}}>Avg credibility score · 12 days</div>
      <div className="chart-bars">
        {CHART_DATA.map((v, i) => (
          <div key={i} className={`chart-bar ${i === CHART_DATA.length-1 ? 'active' : ''}`}
            style={{height:`${(v/max)*100}%`}} title={`${CHART_LABELS[i]}: ${v}`}></div>
        ))}
      </div>
      <div className="chart-labels">
        {CHART_DATA.map((_, i) => i % 3 === 0
          ? <span key={i} className="chart-label">{CHART_LABELS[i].split(' ')[1]}</span>
          : <span key={i} className="chart-label"></span>
        )}
      </div>
    </div>
  );
}

function ScoreRing({ credibilityPct, qualityScore }: { credibilityPct: number; qualityScore: number }) {
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
          <div className="score-ring-label">Cached credibility</div>
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

interface DashboardViewProps {
  analysis: AnalysisResponse | null;
  latestUpdatedAt: string | null;
  status: AnalysisStatus;
}

export default function DashboardView({ analysis, latestUpdatedAt, status }: DashboardViewProps) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t+1), 3000);
    return () => clearInterval(iv);
  }, []);

  const report = analysis?.sentiment_report;
  const metrics = report?.metrics;
  const signalCount = metrics?.signal_count ?? 0;
  const credibilityPct = metrics?.credibility_pct ?? 87;
  const qualityScore = analysis?.quality?.score ?? 0.87;
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
    : SIGNALS.slice(0, 5);

  return (
    <div className="fade-in">
      <div className="stats-row">
        {[
          { label:'Cached signals',     val:analysis ? signalCount : 2847 + tick, suffix:'',     cls:'',      delta:cacheLabel, up:true  },
          { label:'Verified share',     val:metrics?.verified_pct ?? 100,         suffix:'%',     cls:'green', delta:analysis?.place ?? 'Philippines',  up:true  },
          { label:'Misinfo risk',       val:metrics?.misinfo_risk_pct ?? 41,      suffix:'%',     cls:'rust',  delta:analysis?.monitoring_window ?? 'past 7 days',   up:false },
          { label:'Credibility',        val:credibilityPct,                      suffix:'/100', cls:'',      delta:analysis?.analysis_mode ?? 'fast draft',up:true  },
        ].map((s, i) => (
          <div className="stat-card" key={i}>
            <div className="stat-label">{s.label}</div>
            <div className={`stat-val ${s.cls}`}><LiveCounter target={s.val} suffix={s.suffix} /></div>
            <div className="stat-delta">
              <span className={s.up ? 'delta-up' : 'delta-dn'}>{s.up ? '↑' : '↑'} {s.delta}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="dash-grid">
        <div style={{display:'flex', flexDirection:'column', gap:16}}>
          <div className="panel">
            <div className="panel-head">
              <span className="panel-title">{analysis ? 'Cached Signal Feed' : 'Sample Signal Feed'}</span>
              <span className="panel-action">{analysis ? 'cached' : 'sample'}</span>
            </div>
            <div className="signal-feed">
              {liveSignals.map(s => {
                const sourceUrl = 'url' in s && typeof s.url === 'string' ? s.url : null;
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
              })}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <span className="panel-title">Sample Credibility Trend</span>
              <span className="panel-action">demo</span>
            </div>
            <MiniChart />
          </div>
        </div>

        <div style={{display:'flex', flexDirection:'column', gap:16}}>
          <div className="panel">
            <div className="panel-head">
              <span className="panel-title">Credibility Score</span>
            </div>
            <ScoreRing credibilityPct={credibilityPct} qualityScore={qualityScore} />
          </div>

          <div className="panel">
            <div className="panel-head">
              <span className="panel-title">Sample Agent Status</span>
              <span className="panel-action">demo</span>
            </div>
            {AGENTS.map((a, i) => (
              <div className="agent-item" key={i}>
                <div className={`agent-status-dot ${a.status}`}></div>
                <span className="agent-name">{a.name.replace(' Agent', '')}</span>
                <span className="agent-task">{a.task}</span>
                <span className="agent-cycles">{a.cycles}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
