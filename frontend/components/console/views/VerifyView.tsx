import { SIGNALS } from '@/lib/consoleData';

export default function VerifyView() {
  return (
    <div className="fade-in">
      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">Verification Queue · 6 pending</span>
          <span className="panel-action">Run all</span>
        </div>
        {SIGNALS.filter(s => s.scoreClass !== 'high').map((s, i) => (
          <div className="signal-item" key={i} style={{ padding: '16px 20px' }}>
            <div className={`signal-dot ${s.priority}`}></div>
            <div className="signal-content">
              <div className="signal-text" style={{ whiteSpace: 'normal', fontSize: 14 }}>{s.text}</div>
              <div className="signal-meta" style={{ marginTop: 6 }}>
                <span className="signal-source">{s.source}</span>
                <span className="signal-time">{s.time}</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end', flexShrink: 0 }}>
              <div className={`signal-score ${s.scoreClass}`} style={{ fontSize: 18, fontFamily: 'var(--font-instrument-serif), serif' }}>{s.score}/100</div>
              <button style={{ padding: '5px 12px', borderRadius: 6, border: 'none', background: 'var(--rust)', color: 'white', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-dm-sans), sans-serif', fontWeight: 500 }}>Verify now</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
