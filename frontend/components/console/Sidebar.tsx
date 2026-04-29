import { icons } from './icons';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge: string | null;
  badgeClass?: string;
}

interface SidebarProps {
  view: string;
  setView: (view: string) => void;
}

export default function Sidebar({ view, setView }: SidebarProps) {
  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard',    icon: icons.dashboard, badge: null },
    { id: 'signals',   label: 'Signals',      icon: icons.signals,   badge: '41' },
    { id: 'verify',    label: 'Verification', icon: icons.verify,    badge: '6', badgeClass: 'green' },
    { id: 'sentiment', label: 'Sentiment',    icon: icons.sentiment, badge: null },
    { id: 'reports',   label: 'Reports',      icon: icons.reports,   badge: null },
    { id: 'sources',   label: 'Sources',      icon: icons.sources,   badge: null },
    { id: 'agents',    label: 'Agents',       icon: icons.agents,    badge: null },
  ];

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
            {item.label}
            {item.badge && <span className={`sb-badge ${item.badgeClass || ''}`}>{item.badge}</span>}
          </button>
        ))}
      </div>

      <div className="sb-section" style={{marginTop:'auto', paddingBottom:8}}>
        <div className="sb-section-label">System</div>
        <button className={`sb-item ${view === 'settings' ? 'active' : ''}`} onClick={() => setView('settings')}>
          {icons.settings} Settings
        </button>
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
  );
}
