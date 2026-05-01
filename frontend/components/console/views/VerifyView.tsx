import type { AnalysisResponse, SentimentSourceSignal } from '@/lib/analysisApi';

interface VerifyViewProps {
  analysis: AnalysisResponse | null;
}

interface VerificationRow {
  id: string;
  title: string;
  source: string;
  priority: 'high' | 'medium' | 'low';
  status: string;
  score: number;
  reason: string;
  nextAction: string;
  missingProof: string;
  url?: string | null;
}

function scoreClass(score: number) {
  if (score >= 75) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

function priorityForSignal(signal: SentimentSourceSignal): 'high' | 'medium' | 'low' {
  if (signal.verification === 'unverified' && signal.credibility_score < 50) return 'high';
  if (signal.verification === 'unverified' || signal.credibility === 'Low') return 'medium';
  return 'low';
}

function reasonForSignal(signal: SentimentSourceSignal) {
  if (signal.verification === 'unverified' && signal.credibility === 'Low') {
    return 'Single-source or weak-source claim that still lacks strong corroboration.';
  }
  if (signal.verification === 'unverified') {
    return 'The claim appears plausible, but the run has not yet matched it to enough independent evidence.';
  }
  if (signal.credibility === 'Moderate') {
    return 'Verified enough for inclusion, but still worth checking against an official or primary source.';
  }
  return 'Backed by credible evidence and mainly included here for spot-check review.';
}

function nextActionForSignal(signal: SentimentSourceSignal) {
  if (signal.verification === 'unverified' && signal.source.toLowerCase().includes('facebook')) {
    return 'Look for a government, hospital, or newsroom source before escalation.';
  }
  if (signal.verification === 'unverified') {
    return 'Find at least one independent confirmation and compare timestamps.';
  }
  if (signal.credibility === 'Moderate') {
    return 'Attach a primary reference or archive snapshot to strengthen the claim.';
  }
  return 'No urgent action. Keep for periodic QA sampling.';
}

function missingProofForSignal(signal: SentimentSourceSignal) {
  if (signal.verification === 'unverified') return 'Independent corroboration';
  if (signal.credibility === 'Moderate') return 'Primary-source confirmation';
  return 'No critical gap';
}

function liveVerificationRows(analysis: AnalysisResponse | null): VerificationRow[] {
  const sourceSignals = analysis?.sentiment_report?.source_signals ?? [];
  if (!sourceSignals.length) return [];

  return sourceSignals
    .map((signal, index) => ({
      id: `${signal.source || 'signal'}-${index}`,
      title: signal.title || signal.summary || 'Evidence-backed public signal',
      source: signal.source || 'Unknown source',
      priority: priorityForSignal(signal),
      status: signal.verification === 'verified' ? 'spot check' : 'needs verification',
      score: signal.credibility_score ?? 0,
      reason: reasonForSignal(signal),
      nextAction: nextActionForSignal(signal),
      missingProof: missingProofForSignal(signal),
      url: signal.url,
    }))
    .filter(row => row.status === 'needs verification' || row.score < 85)
    .sort((a, b) => a.score - b.score);
}

function demoVerificationRows(): VerificationRow[] {
  return [
    {
      id: 'water-contamination',
      title: 'Water supply contamination in northern districts',
      source: 'Twitter/X',
      priority: 'high',
      status: 'needs verification',
      score: 38,
      reason: 'The claim is viral, but the source is informal and no independent evidence is attached yet.',
      nextAction: 'Check local utility advisories, health office posts, and one newsroom confirmation.',
      missingProof: 'Official advisory or lab-backed source',
    },
    {
      id: 'hospital-capacity',
      title: 'Hospital capacity at 140% in three major cities',
      source: 'Facebook',
      priority: 'high',
      status: 'needs verification',
      score: 44,
      reason: 'High public impact claim with unclear origin and no visible hospital or government attribution.',
      nextAction: 'Verify against hospital bulletins, DOH-style dashboards, or local emergency statements.',
      missingProof: 'Named hospital system or public health dashboard',
    },
    {
      id: 'gdp-hearing',
      title: 'Senator quotes outdated GDP figures in budget hearing',
      source: 'C-SPAN',
      priority: 'medium',
      status: 'spot check',
      score: 61,
      reason: 'The hearing exists, but the quoted figure should be compared with the latest official release.',
      nextAction: 'Match the statement against the latest statistics office publication.',
      missingProof: 'Current official macroeconomic release',
    },
  ];
}

function compactNumber(value: number) {
  return String(Math.max(0, value));
}

export default function VerifyView({ analysis }: VerifyViewProps) {
  const liveRows = liveVerificationRows(analysis);
  const usingLiveData = liveRows.length > 0;
  const rows = usingLiveData ? liveRows : demoVerificationRows();
  const metrics = analysis?.sentiment_report?.metrics;
  const blockingIssues = analysis?.quality?.blocking_issues?.length
    ? analysis.quality.blocking_issues
    : analysis?.blocking_issues ?? [];
  const knowledgeGaps = analysis?.quality?.knowledge_gaps?.length
    ? analysis.quality.knowledge_gaps
    : analysis?.knowledge_gaps ?? [];

  const totalSignals = metrics?.signal_count ?? rows.length;
  const reviewQueue = rows.filter(row => row.status === 'needs verification').length;
  const spotChecks = rows.length - reviewQueue;

  return (
    <div className="fade-in">
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
          marginBottom: 16,
        }}
      >
        {[
          { label: 'Signals checked', value: compactNumber(totalSignals), hint: 'current run coverage' },
          { label: 'Need verification', value: compactNumber(reviewQueue), hint: 'claims waiting on proof' },
          { label: 'Spot checks', value: compactNumber(spotChecks), hint: 'verified but worth sampling' },
          { label: 'Open blockers', value: compactNumber(blockingIssues.length), hint: 'issues before escalation' },
        ].map(card => (
          <div className="panel" key={card.label} style={{ padding: '16px 18px' }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)' }}>{card.label}</div>
            <div style={{ fontSize: 28, marginTop: 8, fontFamily: 'var(--font-instrument-serif), serif', color: 'var(--text)' }}>{card.value}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>{card.hint}</div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.55fr) minmax(280px, 0.95fr)',
          gap: 16,
          alignItems: 'start',
        }}
      >
        <section className="panel">
          <div className="panel-head">
            <span className="panel-title">{usingLiveData ? 'Verification Workspace' : 'Verification Workspace Sample'}</span>
            <span className="panel-action">{usingLiveData ? 'backend data' : 'demo data'}</span>
          </div>
          <div style={{ padding: '0 20px 16px', color: 'var(--muted)', fontSize: 13, lineHeight: 1.6 }}>
            This page works best as a decision layer between live signals and saved reports: not just what arrived, but why a claim is still questionable and what the reviewer should do next.
          </div>
          {rows.map(row => (
            <div className="signal-item" key={row.id} style={{ padding: '18px 20px', alignItems: 'flex-start' }}>
              <div className={`signal-dot ${row.priority}`}></div>
              <div className="signal-content">
                <div className="signal-text" style={{ whiteSpace: 'normal', fontSize: 14, lineHeight: 1.55 }}>{row.title}</div>
                <div className="signal-meta" style={{ marginTop: 6, flexWrap: 'wrap', gap: 8 }}>
                  <span className="signal-source">{row.source}</span>
                  <span className="signal-time">{row.status}</span>
                  <span
                    style={{
                      fontFamily: 'var(--font-dm-mono), monospace',
                      fontSize: 10,
                      background: 'var(--bg2)',
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      padding: '2px 7px',
                      color: 'var(--muted)',
                      textTransform: 'uppercase',
                    }}
                  >
                    missing: {row.missingProof}
                  </span>
                </div>
                <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>
                  <strong style={{ fontWeight: 600 }}>Why it is here:</strong> {row.reason}
                </div>
                <div style={{ marginTop: 8, fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
                  <strong style={{ color: 'var(--text)', fontWeight: 600 }}>Next best action:</strong> {row.nextAction}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end', flexShrink: 0 }}>
                <div className={`signal-score ${scoreClass(row.score)}`} style={{ fontSize: 18, fontFamily: 'var(--font-instrument-serif), serif' }}>{row.score}/100</div>
                {row.url ? (
                  <a
                    href={row.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      padding: '5px 12px',
                      borderRadius: 6,
                      border: '1px solid var(--border)',
                      background: 'transparent',
                      color: 'var(--rust)',
                      fontSize: 12,
                      cursor: 'pointer',
                      fontFamily: 'var(--font-dm-sans), sans-serif',
                      fontWeight: 500,
                      textDecoration: 'none',
                    }}
                  >
                    Open source
                  </a>
                ) : (
                  <button
                    style={{
                      padding: '5px 12px',
                      borderRadius: 6,
                      border: 'none',
                      background: 'var(--rust)',
                      color: 'white',
                      fontSize: 12,
                      cursor: 'pointer',
                      fontFamily: 'var(--font-dm-sans), sans-serif',
                      fontWeight: 500,
                    }}
                  >
                    Review next
                  </button>
                )}
              </div>
            </div>
          ))}
        </section>

        <div style={{ display: 'grid', gap: 16 }}>
          <section className="panel" style={{ paddingBottom: 10 }}>
            <div className="panel-head">
              <span className="panel-title">Gaps And Blockers</span>
              <span className="panel-action">what still needs proof</span>
            </div>
            <div style={{ padding: '0 20px 18px' }}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: 8 }}>Blocking issues</div>
                {blockingIssues.length ? (
                  <div className="report-note-list">
                    {blockingIssues.map(issue => <div className="report-note-item" key={issue}>{issue}</div>)}
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
                    {usingLiveData ? 'No active blocking issues on the current run.' : 'Demo mode: use this area for hard blockers such as missing official confirmation or contradictory source timelines.'}
                  </div>
                )}
              </div>
              <div>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: 8 }}>Knowledge gaps</div>
                {knowledgeGaps.length ? (
                  <div className="report-note-list">
                    {knowledgeGaps.map(gap => <div className="report-note-item" key={gap}>{gap}</div>)}
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
                    {usingLiveData ? 'No evaluator gaps were returned for this run.' : 'Demo mode: list missing timestamps, unnamed sources, missing locations, and unsupported quantitative claims.'}
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="panel" style={{ paddingBottom: 10 }}>
            <div className="panel-head">
              <span className="panel-title">Verification Rules</span>
              <span className="panel-action">keep this page non-redundant</span>
            </div>
            <div style={{ padding: '0 20px 18px', display: 'grid', gap: 10, fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>
              <div><strong>Do not repeat live feed output.</strong> Signals already shows incoming items; verification should explain why a claim is questionable.</div>
              <div><strong>Do not repeat report prose.</strong> Reports already stores conclusions; verification should sit before that decision and expose uncertainty.</div>
              <div><strong>Center the reviewer action.</strong> Every queued claim should have one missing proof field and one next action field.</div>
              <div><strong>Use confidence carefully.</strong> Show credibility score as support for triage, not as the final truth label by itself.</div>
            </div>
          </section>

          <section className="panel" style={{ paddingBottom: 10 }}>
            <div className="panel-head">
              <span className="panel-title">Coverage Snapshot</span>
              <span className="panel-action">run-level verification</span>
            </div>
            <div style={{ padding: '0 20px 18px', display: 'grid', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--muted)' }}>Verified evidence rate</span>
                <strong>{metrics?.verified_pct ?? (usingLiveData ? 0 : 42)}%</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--muted)' }}>Credibility average</span>
                <strong>{metrics?.credibility_pct ?? (usingLiveData ? 0 : 58)}%</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--muted)' }}>Misinformation risk</span>
                <strong>{metrics?.misinfo_risk_pct ?? (usingLiveData ? 0 : 63)}%</strong>
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
                Useful ito kapag gusto mong makita kung ang problema ba ay isolated claims lang o mababa talaga ang verification quality ng buong run.
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
