import { SOURCES } from '@/lib/consoleData';

export default function SourcesView() {
  return (
    <div className="fade-in">
      <div className="panel" style={{marginBottom:16}}>
        <div className="panel-head">
          <span className="panel-title">Sample Connected Sources · {SOURCES.filter(s => s.status === 'online').length}/{SOURCES.length} online</span>
          <span className="panel-action">demo data</span>
        </div>
        <div className="source-grid">
          {SOURCES.map((s, i) => (
            <div className="source-card" key={i}>
              <div className="source-name">{s.name}</div>
              <div className="source-type">{s.type}</div>
              <div className="source-stat">
                <span className={`source-dot ${s.status === 'offline' ? 'offline' : ''}`}></span>
                {s.status === 'online' ? s.rate + ' ingested' : 'Offline'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
