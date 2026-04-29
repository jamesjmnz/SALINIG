'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/console/Sidebar';
import Topbar from '@/components/console/Topbar';
import ConsoleTweaks from '@/components/console/ConsoleTweaks';
import DashboardView from '@/components/console/views/DashboardView';
import SignalsView from '@/components/console/views/SignalsView';
import VerifyView from '@/components/console/views/VerifyView';
import SentimentView from '@/components/console/views/SentimentView';
import ReportsView from '@/components/console/views/ReportsView';
import SourcesView from '@/components/console/views/SourcesView';
import AgentsView from '@/components/console/views/AgentsView';
import SettingsView from '@/components/console/views/SettingsView';
import { TWEAK_DEFAULTS, TweakState } from '@/lib/consoleData';

export default function ConsolePage() {
  const [view, setView] = useState('dashboard');
  const [tweaks, setTweakState] = useState<TweakState>(TWEAK_DEFAULTS);
  const [tweaksOpen, setTweaksOpen] = useState(false);

  const setTweak = (k: string, v: string) => setTweakState(prev => ({ ...prev, [k]: v }));

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === '__activate_edit_mode') setTweaksOpen(true);
      if (e.data?.type === '__deactivate_edit_mode') setTweaksOpen(false);
    };
    window.addEventListener('message', onMsg);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', onMsg);
  }, []);

  const views: Record<string, React.ReactNode> = {
    dashboard: <DashboardView />,
    signals:   <SignalsView />,
    verify:    <VerifyView />,
    sentiment: <SentimentView />,
    reports:   <ReportsView />,
    sources:   <SourcesView />,
    agents:    <AgentsView />,
    settings:  <SettingsView />,
  };

  return (
    <div className="app">
      <Sidebar view={view} setView={setView} />
      <div className="main">
        <Topbar view={view} />
        <div className="content">{views[view]}</div>
      </div>
      <ConsoleTweaks
        tweaks={tweaks}
        setTweak={setTweak}
        visible={tweaksOpen}
        onClose={() => {
          setTweaksOpen(false);
          window.parent.postMessage({ type: '__edit_mode_dismissed' }, '*');
        }}
      />
    </div>
  );
}
