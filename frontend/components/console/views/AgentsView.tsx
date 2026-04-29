'use client';

import { useState, useEffect } from 'react';
import { AGENTS } from '@/lib/consoleData';

export default function AgentsView() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 1800);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="fade-in">
      <div className="stats-row">
        {[
          { label: 'Running',      val: '4',                             cls: 'green' },
          { label: 'Busy',         val: '2',                             cls: '' },
          { label: 'Total cycles', val: (4789 + tick).toLocaleString(),  cls: '' },
          { label: 'Avg latency',  val: '8.2s',                          cls: '' },
        ].map((s, i) => (
          <div className="stat-card" key={i}>
            <div className="stat-label">{s.label}</div>
            <div className={`stat-val ${s.cls}`} style={{ fontSize: 28 }}>{s.val}</div>
          </div>
        ))}
      </div>
      <div className="panel">
        <div className="panel-head"><span className="panel-title">Agent Runtime</span></div>
        <div style={{ padding: '4px 0' }}>
          {AGENTS.map((a, i) => (
            <div className="agent-item" key={i} style={{ padding: '14px 20px', gap: 14 }}>
              <div className={`agent-status-dot ${a.status}`} style={{ width: 9, height: 9 }}></div>
              <div style={{ flex: 2 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>{a.name}</div>
                <div className="agent-task" style={{ whiteSpace: 'normal', overflow: 'visible' }}>{a.task}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontFamily: 'var(--font-dm-mono), monospace', fontSize: 13, color: 'var(--text2)', marginBottom: 3 }}>{parseInt(a.cycles) + (tick * (i + 1))}</div>
                <div style={{ fontFamily: 'var(--font-dm-mono), monospace', fontSize: 10, color: 'var(--muted)' }}>cycles</div>
              </div>
              <span style={{
                fontFamily: 'var(--font-dm-mono), monospace', fontSize: 10, padding: '3px 9px',
                borderRadius: 4, flexShrink: 0,
                background: a.status === 'running' ? 'var(--green-bg)' : a.status === 'busy' ? 'var(--amber-bg)' : 'var(--bg3)',
                color: a.status === 'running' ? 'var(--green)' : a.status === 'busy' ? 'var(--amber)' : 'var(--muted)',
              }}>{a.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
