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
import SettingsView from '@/components/console/views/SettingsView';
import { TWEAK_DEFAULTS, TweakState } from '@/lib/consoleData';
import {
  AnalysisOptions,
  AnalysisProgressEvent,
  AnalysisResponse,
  AnalysisStatus,
  AnalyzePayload,
  fetchAnalysisOptions,
  fetchLatestAnalysis,
  saveAnalysisReport,
  streamAnalysis,
} from '@/lib/analysisApi';

export default function ConsolePage() {
  const [view, setView] = useState('dashboard');
  const [tweaks, setTweakState] = useState<TweakState>(TWEAK_DEFAULTS);
  const [tweaksOpen, setTweaksOpen] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [analysisOptions, setAnalysisOptions] = useState<AnalysisOptions | null>(null);
  const [latestUpdatedAt, setLatestUpdatedAt] = useState<string | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>('loading-cache');
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState<AnalysisProgressEvent | null>(null);
  const [savedReportId, setSavedReportId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

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

  useEffect(() => {
    let cancelled = false;

    async function loadCachedAnalysis() {
      setAnalysisStatus('loading-cache');
      setAnalysisError(null);
      setAnalysisProgress(null);
      try {
        const [options, latest] = await Promise.all([
          fetchAnalysisOptions(),
          fetchLatestAnalysis(),
        ]);
        if (cancelled) return;
        setAnalysisOptions(options);
        if (latest.cached && latest.analysis) {
          setAnalysis(latest.analysis);
          setLatestUpdatedAt(latest.updated_at ?? null);
          setSavedReportId(latest.report_id ?? null);
        }
        setAnalysisStatus('idle');
      } catch (error) {
        if (cancelled) return;
        setAnalysisStatus('error');
        setAnalysisError(error instanceof Error ? error.message : 'Unable to load SALINIG analysis state.');
        setAnalysisProgress(null);
      }
    }

    loadCachedAnalysis();
    return () => { cancelled = true; };
  }, []);

  const handleAnalyze = async (payload: AnalyzePayload) => {
    setAnalysisStatus('running');
    setAnalysisError(null);
    setAnalysisProgress({ type: 'status', node: 'queued', label: 'Preparing analysis' });
    setSavedReportId(null);
    setSaveStatus('idle');
    setSaveError(null);
    try {
      const result = await streamAnalysis(payload, event => {
        setAnalysisProgress(event);
      });
      setAnalysis(result);
      setAnalysisStatus('idle');
    } catch (error) {
      setAnalysisStatus('error');
      setAnalysisError(error instanceof Error ? error.message : 'Analysis failed.');
      setAnalysisProgress(null);
    }
  };

  const openSavedReport = (reportId: string) => {
    setSavedReportId(reportId);
    setView('reports');
  };

  const handleSaveReport = async () => {
    if (!analysis) return;
    if (savedReportId) {
      openSavedReport(savedReportId);
      return;
    }

    setSaveStatus('saving');
    setSaveError(null);
    try {
      const saved = await saveAnalysisReport(analysis);
      setSavedReportId(saved.report_id);
      setLatestUpdatedAt(saved.saved_at);
      setSaveStatus('idle');
      openSavedReport(saved.report_id);
    } catch (error) {
      setSaveStatus('error');
      setSaveError(error instanceof Error ? error.message : 'Unable to save report.');
    }
  };

  const views: Record<string, React.ReactNode> = {
    dashboard: <DashboardView analysis={analysis} latestUpdatedAt={latestUpdatedAt} status={analysisStatus} />,
    signals:   <SignalsView analysis={analysis} />,
    verify:    <VerifyView analysis={analysis} />,
    sentiment: (
      <SentimentView
        analysis={analysis}
        options={analysisOptions}
        latestUpdatedAt={latestUpdatedAt}
        status={analysisStatus}
        progress={analysisProgress}
        error={analysisError}
        onAnalyze={handleAnalyze}
        onSaveReport={handleSaveReport}
        saveStatus={saveStatus}
        saveError={saveError}
        savedReportId={savedReportId}
      />
    ),
    reports:   (
      <ReportsView
        analysis={analysis}
        latestUpdatedAt={latestUpdatedAt}
        focusedReportId={savedReportId}
        onFocusReport={setSavedReportId}
      />
    ),
    settings:  <SettingsView />,
  };

  return (
    <div className="app">
      <Sidebar view={view} setView={setView} analysis={analysis} progress={analysisProgress} />
      <div className="main">
        <Topbar view={view} onNewReport={() => setView('sentiment')} />
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
