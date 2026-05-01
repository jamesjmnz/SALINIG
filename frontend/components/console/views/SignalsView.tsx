'use client';

import { useState } from 'react';
import type { AnalysisResponse, SentimentSourceSignal } from '@/lib/analysisApi';

type SignalPriority = 'high' | 'medium' | 'low';

interface SignalRow {
  id: string;
  text: string;
  source: string;
  url?: string | null;
  time: string;
  priority: SignalPriority;
  score: string;
  scoreClass: string;
  supportStatus: string;
  sourceIndex: number;
}

interface SignalsViewProps {
  analysis: AnalysisResponse | null;
}

function scoreClass(score: number) {
  if (score >= 75) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

function priorityForSignal(signal: SentimentSourceSignal): SignalPriority {
  if (signal.verification === 'unverified') return 'high';
  if (signal.sentiment === 'Negative') return 'medium';
  return 'low';
}

function liveSignalRows(analysis: AnalysisResponse | null): SignalRow[] {
  const report = analysis?.sentiment_report;
  const claimLookup = new Map(
    (analysis?.diagnostics?.claim_verification?.claims ?? [])
      .flatMap(claim => claim.evidence_links.map(link => [link.source_index, claim.support_status] as const)),
  );
  if (!report?.source_signals?.length) return [];
  return report.source_signals.map((signal, index) => ({
    id: `${signal.source || 'source'}-${index}`,
    text: signal.summary || signal.title || 'Evidence-backed public signal',
    source: signal.source || 'source',
    url: signal.url,
    time: `${signal.sentiment} · ${signal.credibility ?? 'Unverified'}`,
    priority: priorityForSignal(signal),
    score: String(signal.credibility_score ?? 0),
    scoreClass: scoreClass(signal.credibility_score ?? 0),
    supportStatus: claimLookup.get(signal.source_index) ?? 'unmapped',
    sourceIndex: signal.source_index ?? index + 1,
  }));
}

export default function SignalsView({ analysis }: SignalsViewProps) {
  const [filter, setFilter] = useState('all');
  const liveRows = liveSignalRows(analysis);
  const hasAnalysis = Boolean(analysis);
  const usingLiveSignals = liveRows.length > 0;
  const signals = liveRows;
  const filtered = filter === 'all' ? signals : signals.filter(s => s.priority === filter);
  const countLabel = usingLiveSignals ? 'live signals' : 'signals';
  const emptyState = usingLiveSignals
    ? {
        title: `No ${filter} priority signals`,
        description: 'Try another filter to inspect the rest of the current run.',
      }
    : hasAnalysis
      ? {
          title: 'No source signals returned',
          description: 'The current analysis completed without any queued evidence items.',
        }
      : {
          title: 'No live signals yet',
          description: 'Run an analysis or load a cached report to populate this queue.',
        };

  return (
    <div className="fade-in">
      <div style={{display:'flex', gap:8, marginBottom:16}}>
        {['all','high','medium','low'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding:'6px 14px', borderRadius:7, border:'1px solid var(--border)',
            background: filter === f ? 'var(--text)' : 'var(--white)',
            color: filter === f ? 'var(--bg)' : 'var(--muted)',
            fontSize:12, cursor:'pointer', fontFamily:'var(--font-dm-sans), sans-serif',
            fontWeight:500, textTransform:'capitalize',
          }}>{f === 'all' ? 'All signals' : f + ' priority'}</button>
        ))}
        <span style={{marginLeft:'auto', fontFamily:'var(--font-dm-mono), monospace', fontSize:11, color:'var(--muted)', display:'flex', alignItems:'center'}}>{filtered.length} {countLabel}</span>
      </div>
      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">Live Signal Queue</span>
          <span className="panel-action">{usingLiveSignals ? 'backend data' : hasAnalysis ? 'current run' : 'waiting for analysis'}</span>
        </div>
        {filtered.length ? (
          filtered.map(s => (
            <div className="signal-item" key={s.id} style={{padding:'16px 20px'}}>
              <div className={`signal-dot ${s.priority}`}></div>
              <div className="signal-content">
                <div className="signal-text" style={{whiteSpace:'normal', fontSize:14}}>{s.text}</div>
                <div className="signal-meta" style={{marginTop:6}}>
                  <span className="signal-source">{s.source}</span>
                  <span className="signal-time">{s.time}</span>
                  <span className="signal-time">S{s.sourceIndex}</span>
                  <span style={{fontFamily:'var(--font-dm-mono), monospace', fontSize:10, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:4, padding:'2px 7px', color:'var(--muted)', textTransform:'uppercase'}}>{s.supportStatus}</span>
                  <span style={{fontFamily:'var(--font-dm-mono), monospace', fontSize:10, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:4, padding:'2px 7px', color:'var(--muted)', textTransform:'uppercase'}}>{s.priority}</span>
                </div>
              </div>
              <div style={{display:'flex', flexDirection:'column', alignItems:'flex-end', gap:8, flexShrink:0}}>
                <div className={`signal-score ${s.scoreClass}`} style={{fontSize:18, fontFamily:'var(--font-instrument-serif), serif'}}>{s.score}</div>
                {s.url
                  ? <a href={s.url} target="_blank" rel="noreferrer" style={{padding:'4px 10px', borderRadius:5, border:'1px solid var(--border)', background:'transparent', fontSize:11, color:'var(--rust)', cursor:'pointer', fontFamily:'var(--font-dm-sans), sans-serif', textDecoration:'none'}}>Open →</a>
                  : <button style={{padding:'4px 10px', borderRadius:5, border:'1px solid var(--border)', background:'transparent', fontSize:11, color:'var(--rust)', cursor:'pointer', fontFamily:'var(--font-dm-sans), sans-serif'}}>Verify →</button>
                }
              </div>
            </div>
          ))
        ) : (
          <div className="empty" style={{padding:'40px 20px'}}>
            <div className="empty-title">{emptyState.title}</div>
            <div className="empty-desc">{emptyState.description}</div>
          </div>
        )}
      </div>
    </div>
  );
}
