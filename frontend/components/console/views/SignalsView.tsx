'use client';

import { useState } from 'react';
import { SIGNALS } from '@/lib/consoleData';

export default function SignalsView() {
  const [filter, setFilter] = useState('all');
  const filtered = filter === 'all' ? SIGNALS : SIGNALS.filter(s => s.priority === filter);

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
        <span style={{marginLeft:'auto', fontFamily:'var(--font-dm-mono), monospace', fontSize:11, color:'var(--muted)', display:'flex', alignItems:'center'}}>{filtered.length} signals</span>
      </div>
      <div className="panel">
        {filtered.map(s => (
          <div className="signal-item" key={s.id} style={{padding:'16px 20px'}}>
            <div className={`signal-dot ${s.priority}`}></div>
            <div className="signal-content">
              <div className="signal-text" style={{whiteSpace:'normal', fontSize:14}}>{s.text}</div>
              <div className="signal-meta" style={{marginTop:6}}>
                <span className="signal-source">{s.source}</span>
                <span className="signal-time">{s.time}</span>
                <span style={{fontFamily:'var(--font-dm-mono), monospace', fontSize:10, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:4, padding:'2px 7px', color:'var(--muted)', textTransform:'uppercase'}}>{s.priority}</span>
              </div>
            </div>
            <div style={{display:'flex', flexDirection:'column', alignItems:'flex-end', gap:8, flexShrink:0}}>
              <div className={`signal-score ${s.scoreClass}`} style={{fontSize:18, fontFamily:'var(--font-instrument-serif), serif'}}>{s.score}</div>
              <button style={{padding:'4px 10px', borderRadius:5, border:'1px solid var(--border)', background:'transparent', fontSize:11, color:'var(--rust)', cursor:'pointer', fontFamily:'var(--font-dm-sans), sans-serif'}}>Verify →</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
