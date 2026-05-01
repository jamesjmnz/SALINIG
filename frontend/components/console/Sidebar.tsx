import { icons } from './icons';
import type { AnalysisProgressEvent, AnalysisResponse } from '@/lib/analysisApi';
import { SIGNALS } from '@/lib/consoleData';

interface NavItem {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  badge: string | null;
  badgeClass?: string;
}

interface SidebarProps {
  view: string;
  setView: (view: string) => void;
  analysis: AnalysisResponse | null;
  progress: AnalysisProgressEvent | null;
}

function signalBadgeCount(analysis: AnalysisResponse | null, progress: AnalysisProgressEvent | null) {
  if (typeof progress?.signal_count === 'number') return progress.signal_count;
  if (typeof analysis?.sentiment_report?.metrics?.signal_count === 'number') {
    return analysis.sentiment_report.metrics.signal_count;
  }
  if (analysis?.sentiment_report?.source_signals?.length) return analysis.sentiment_report.source_signals.length;
  return SIGNALS.length;
}

function verificationBadgeCount(analysis: AnalysisResponse | null) {
  const sourceSignals = analysis?.sentiment_report?.source_signals;
  if (sourceSignals?.length) {
    return sourceSignals.filter(signal => signal.verification !== 'verified').length;
  }
  return 2;
}

export default function Sidebar({ view, setView, analysis, progress }: SidebarProps) {
  const signalCount = signalBadgeCount(analysis, progress);
  const verificationCount = verificationBadgeCount(analysis);
  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard',     description: 'Daily snapshot',   icon: icons.dashboard, badge: null },
    { id: 'signals',   label: 'Signals',       description: 'Live chatter',     icon: icons.signals,   badge: String(signalCount) },
    { id: 'verify',    label: 'Verification',  description: 'Check claims',     icon: icons.verify,    badge: String(verificationCount), badgeClass: 'green' },
    { id: 'sentiment', label: 'Sentiment',     description: 'Mood shifts',      icon: icons.sentiment, badge: null },
    { id: 'reports',   label: 'Saved Reports', description: 'Past briefings',   icon: icons.reports,   badge: null },
  ];

  const settingsDescription = 'System preferences';

  return (
    <div className="sidebar">
      <div className="sb-logo">
        <div className="sb-logo-mark">{icons.wave}</div>
        <div>
          <div className="sb-logo-text">Salinig</div>
          <div className="sb-logo-sub">Console</div>
        </div>
      </div>

      <div className="sb-section">
        <div className="sb-section-label">Intelligence</div>
        {navItems.map(item => (
          <button key={item.id} className={`sb-item ${view === item.id ? 'active' : ''}`} onClick={() => setView(item.id)}>
            {item.icon}
            <div className="sb-item-copy">
              <span className="sb-item-label">{item.label}</span>
              <span className="sb-item-desc">{item.description}</span>
            </div>
            {item.badge && <span className={`sb-badge ${item.badgeClass || ''}`}>{item.badge}</span>}
          </button>
        ))}
      </div>

      <div className="sb-footer">
        <div className="sb-section sb-system-section">
          <div className="sb-section-label">System</div>
          <button className={`sb-item ${view === 'settings' ? 'active' : ''}`} onClick={() => setView('settings')}>
            {icons.settings}
            <div className="sb-item-copy">
              <span className="sb-item-label">Settings</span>
              <span className="sb-item-desc">{settingsDescription}</span>
            </div>
          </button>
          <div className="sb-info-card">
            <div className="sb-info-title">Philippines Watch</div>
            <p>
              Spot early narrative shifts from local news, social posts, and public forums to support faster response planning across Philippines.
            </p>
          </div>
        </div>

        <div className="sb-bottom">
          <div className="sb-user">
            <div className="sb-avatar">AL</div>
            <div>
              <div className="sb-user-name">Alex Lim</div>
              <div className="sb-user-role">Analyst · Admin</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
