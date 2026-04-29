import Link from 'next/link';
import { icons } from './icons';
import { VIEW_TITLES } from '@/lib/consoleData';

interface TopbarProps {
  view: string;
}

export default function Topbar({ view }: TopbarProps) {
  return (
    <div className="topbar">
      <div className="topbar-title">{VIEW_TITLES[view]}</div>
      <div className="topbar-right">
        <div className="topbar-search">
          {icons.search}
          <span>Search signals, reports…</span>
        </div>
        <div className="topbar-status">
          <div className="agent-status-dot running" style={{width:7, height:7}}></div>
          Pipeline live
        </div>
        <Link href="/" className="topbar-btn">← Back to site</Link>
        <button className="topbar-btn primary">New report</button>
      </div>
    </div>
  );
}
