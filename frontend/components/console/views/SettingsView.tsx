'use client';

import { useState } from 'react';

export default function SettingsView() {
  const [thresh, setThresh] = useState(75);

  return (
    <div className="fade-in" style={{ maxWidth: 640 }}>
      {[
        {
          label: 'Credibility Threshold',
          desc: 'Signals below this score are flagged automatically.',
          control: (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input type="range" min={0} max={100} value={thresh} onChange={e => setThresh(Number(e.target.value))}
                style={{ flex: 1, accentColor: 'var(--rust)' }} />
              <span style={{ fontFamily: 'var(--font-dm-mono), monospace', fontSize: 14, color: 'var(--text)', width: 36 }}>{thresh}</span>
            </div>
          ),
        },
        {
          label: 'RAG Cycle Limit',
          desc: 'Maximum number of retrieval cycles per claim.',
          control: (
            <select style={{ padding: '7px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--white)', fontFamily: 'var(--font-dm-sans), sans-serif', fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}>
              <option>3 cycles</option>
              <option>5 cycles</option>
              <option>Auto</option>
            </select>
          ),
        },
        {
          label: 'Alert on Contradiction',
          desc: 'Send alert when cross-source contradictions are detected.',
          control: (
            <div style={{ width: 40, height: 24, borderRadius: 12, background: 'var(--green)', position: 'relative', cursor: 'pointer' }}>
              <div style={{ position: 'absolute', top: 3, right: 3, width: 18, height: 18, borderRadius: '50%', background: 'white' }}></div>
            </div>
          ),
        },
        {
          label: 'Learning Feedback Loop',
          desc: 'Allow the system to update weights from analyst corrections.',
          control: (
            <div style={{ width: 40, height: 24, borderRadius: 12, background: 'var(--green)', position: 'relative', cursor: 'pointer' }}>
              <div style={{ position: 'absolute', top: 3, right: 3, width: 18, height: 18, borderRadius: '50%', background: 'white' }}></div>
            </div>
          ),
        },
      ].map((s, i) => (
        <div className="panel" key={i} style={{ marginBottom: 12, padding: '18px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 32 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>{s.desc}</div>
          </div>
          <div style={{ flexShrink: 0, minWidth: 160 }}>{s.control}</div>
        </div>
      ))}
    </div>
  );
}
