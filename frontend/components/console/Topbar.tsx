'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { icons } from './icons';
import { VIEW_TITLES } from '@/lib/consoleData';

function useClock() {
  const [time, setTime] = useState('');
  useEffect(() => {
    function tick() {
      setTime(new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit' }).format(new Date()));
    }
    tick();
    const id = setInterval(tick, 10_000);
    return () => clearInterval(id);
  }, []);
  return time;
}

interface TopbarProps {
  view: string;
  onNewReport: () => void;
}

export default function Topbar({ view, onNewReport }: TopbarProps) {
  const time = useClock();

  return (
    <div className="topbar">
      <div className="topbar-left">
        <div className="topbar-title">{VIEW_TITLES[view]}</div>
      </div>
      <div className="topbar-right">
        <div className="topbar-search">
          {icons.search}
          <span>Search signals, reports…</span>
          <span className="topbar-search-kbd">⌘K</span>
        </div>
        <div className="topbar-status">
          <div className="agent-status-dot idle" style={{ width: 7, height: 7 }}></div>
          Console ready
          {time ? <span className="topbar-time">{time}</span> : null}
        </div>
        <Link href="/" className="topbar-btn">← Back to site</Link>
        <button className="topbar-btn primary" onClick={onNewReport}>Analyze / Refresh</button>
      </div>
    </div>
  );
}
