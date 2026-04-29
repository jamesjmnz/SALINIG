'use client';

import { useState, useEffect } from 'react';
import { SIGNALS, AGENTS, CHART_DATA, CHART_LABELS } from '@/lib/consoleData';

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

function ScoreRing() {
  return (
    <>
      <div className="score-ring-wrap">
        <svg width="80" height="80" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="32" fill="none" stroke="var(--border)" strokeWidth="7"/>
          <circle cx="40" cy="40" r="32" fill="none" stroke="var(--green)" strokeWidth="7"
            strokeDasharray={`${0.87 * 2 * Math.PI * 32} ${2 * Math.PI * 32}`}
            strokeLinecap="round" strokeDashoffset={2*Math.PI*32*0.25}
            style={{transition:'stroke-dasharray 1s ease'}}/>
          <text x="40" y="44" textAnchor="middle" fontFamily="var(--font-instrument-serif), serif" fontSize="18" fill="var(--text)">87</text>
        </svg>
        <div className="score-ring-info">
          <div className="score-ring-val">87<span style={{fontSize:18, color:'var(--muted)'}}>/100</span></div>
          <div className="score-ring-label">Avg credibility today</div>
        </div>
      </div>
      <div className="score-breakdown">
        {[
          {label:'Source authority',      val:91, pct:'91'},
          {label:'Corroboration',          val:85, pct:'85'},
          {label:'Temporal consistency',   val:88, pct:'88'},
          {label:'Logical coherence',      val:82, pct:'82'},
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

export default function DashboardView() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t+1), 3000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="fade-in">
      <div className="stats-row">
        {[
          { label:'Signals today',      val:2847 + tick, suffix:'',     cls:'',      delta:'+12%', up:true  },
          { label:'Verified claims',    val:1204,         suffix:'',     cls:'green', delta:'+8%',  up:true  },
          { label:'Flagged (low cred)', val:41,           suffix:'',     cls:'rust',  delta:'+2',   up:false },
          { label:'Avg credibility',    val:87,           suffix:'/100', cls:'',      delta:'+3pts',up:true  },
        ].map((s, i) => (
          <div className="stat-card" key={i}>
            <div className="stat-label">{s.label}</div>
            <div className={`stat-val ${s.cls}`}><LiveCounter target={s.val} suffix={s.suffix} /></div>
            <div className="stat-delta">
              <span className={s.up ? 'delta-up' : 'delta-dn'}>{s.up ? '↑' : '↑'} {s.delta}</span>
              <span style={{color:'var(--muted)', fontSize:11}}>vs yesterday</span>
            </div>
          </div>
        ))}
      </div>

      <div className="dash-grid">
        <div style={{display:'flex', flexDirection:'column', gap:16}}>
          <div className="panel">
            <div className="panel-head">
              <span className="panel-title">Live Signal Feed</span>
              <span className="panel-action">View all →</span>
            </div>
            <div className="signal-feed">
              {SIGNALS.slice(0, 5).map(s => (
                <div className="signal-item" key={s.id}>
                  <div className={`signal-dot ${s.priority}`}></div>
                  <div className="signal-content">
                    <div className="signal-text">{s.text}</div>
                    <div className="signal-meta">
                      <span className="signal-source">{s.source}</span>
                      <span className="signal-time">{s.time}</span>
                    </div>
                  </div>
                  <div className={`signal-score ${s.scoreClass}`}>{s.score}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><span className="panel-title">Credibility Trend</span></div>
            <MiniChart />
          </div>
        </div>

        <div style={{display:'flex', flexDirection:'column', gap:16}}>
          <div className="panel">
            <div className="panel-head">
              <span className="panel-title">Credibility Score</span>
            </div>
            <ScoreRing />
          </div>

          <div className="panel">
            <div className="panel-head">
              <span className="panel-title">Agent Status</span>
              <span className="panel-action">Monitor →</span>
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
