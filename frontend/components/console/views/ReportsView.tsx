import { REPORTS } from '@/lib/consoleData';

export default function ReportsView() {
  return (
    <div className="fade-in">
      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">All Reports · Today</span>
          <span className="panel-action">Export</span>
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
