'use client';

import { useMemo, useState } from 'react';
import {
  submitAnalystFeedback,
  type AnalysisResponse,
  type ClaimEvidenceLink,
  type ReportClaim,
} from '@/lib/analysisApi';

interface VerifyViewProps {
  analysis: AnalysisResponse | null;
  savedReportId: string | null;
}

interface VerificationRow {
  claimId: string;
  title: string;
  source: string;
  priority: 'high' | 'medium' | 'low';
  status: string;
  score: number;
  reason: string;
  nextAction: string;
  missingProof: string;
  supportStatus: string;
  links: ClaimEvidenceLink[];
}

function scoreClass(score: number) {
  if (score >= 75) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

function priorityForClaim(claim: ReportClaim): 'high' | 'medium' | 'low' {
  if (claim.support_status === 'contradicted' || claim.support_status === 'unsupported') return 'high';
  if (claim.support_status === 'mixed') return 'medium';
  return 'low';
}

function reasonForClaim(claim: ReportClaim) {
  if (claim.support_status === 'contradicted') {
    return 'At least one mapped source appears to conflict with the way this claim is phrased.';
  }
  if (claim.support_status === 'unsupported') {
    return 'The report generated this claim, but it still lacks enough mapped evidence links.';
  }
  if (claim.support_status === 'mixed') {
    return 'The claim has partial support, but the evidence base is still uneven or ambiguous.';
  }
  return 'This claim is supported, but it still belongs in the reviewer workspace for QA sampling.';
}

function nextActionForClaim(claim: ReportClaim) {
  if (claim.support_status === 'contradicted') {
    return 'Rewrite or narrow the claim before escalation, then compare the conflicting sources side by side.';
  }
  if (claim.support_status === 'unsupported') {
    return 'Find a corroborating source or downgrade the confidence of the claim.';
  }
  if (claim.support_status === 'mixed') {
    return 'Check timestamps, named entities, and publication context to resolve the ambiguity.';
  }
  return 'No urgent fix needed. Keep this as a spot-check candidate.';
}

function missingProofForClaim(claim: ReportClaim) {
  if (claim.support_status === 'contradicted') return 'Consistent evidence';
  if (claim.support_status === 'unsupported') return 'Mapped supporting sources';
  if (claim.support_status === 'mixed') return 'Clear corroboration';
  return 'No critical gap';
}

function supportScore(claim: ReportClaim) {
  if (!claim.evidence_links.length) return 0;
  const best = Math.max(...claim.evidence_links.map(link => Math.round(link.support_score * 100)));
  return Math.max(0, best);
}

function sourceLabel(claim: ReportClaim) {
  const titles = claim.evidence_links.map(link => link.title).filter(Boolean);
  if (!titles.length) return 'No mapped source';
  if (titles.length === 1) return titles[0];
  return `${titles[0]} +${titles.length - 1} more`;
}

function verificationRows(analysis: AnalysisResponse | null): VerificationRow[] {
  const claims = analysis?.diagnostics?.claim_verification?.claims ?? [];
  return claims
    .map(claim => ({
      claimId: claim.claim_id,
      title: claim.text,
      source: sourceLabel(claim),
      priority: priorityForClaim(claim),
      status: claim.support_status.replace('_', ' '),
      score: supportScore(claim),
      reason: reasonForClaim(claim),
      nextAction: nextActionForClaim(claim),
      missingProof: missingProofForClaim(claim),
      supportStatus: claim.support_status,
      links: claim.evidence_links,
    }))
    .filter(row => row.supportStatus !== 'supported' || row.score < 90)
    .sort((left, right) => left.score - right.score);
}

function compactNumber(value: number) {
  return String(Math.max(0, value));
}

function toneForStatus(status: AnalysisResponse['analysis_status'] | undefined) {
  return status === 'insufficient_evidence' ? 'flagged' : 'verified';
}

export default function VerifyView({ analysis, savedReportId }: VerifyViewProps) {
  const sourceSignals = analysis?.sentiment_report?.source_signals ?? [];
  const diagnostics = analysis?.diagnostics;
  const claimVerification = diagnostics?.claim_verification;
  const evidenceSufficiency = diagnostics?.evidence_sufficiency;
  const contradictions = claimVerification?.contradictions ?? [];
  const rows = verificationRows(analysis);
  const hasAnalysis = Boolean(analysis);
  const hasVerification = Boolean(claimVerification?.checked);
  const blockingIssues = analysis?.quality?.blocking_issues?.length
    ? analysis.quality.blocking_issues
    : analysis?.blocking_issues ?? [];
  const knowledgeGaps = analysis?.quality?.knowledge_gaps?.length
    ? analysis.quality.knowledge_gaps
    : analysis?.knowledge_gaps ?? [];
  const [selectedClaimIds, setSelectedClaimIds] = useState<string[]>([]);
  const [score, setScore] = useState(4);
  const [useful, setUseful] = useState(true);
  const [accurate, setAccurate] = useState(true);
  const [notes, setNotes] = useState('');
  const [feedbackStatus, setFeedbackStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const reviewQueue = rows.filter(row => row.supportStatus === 'contradicted' || row.supportStatus === 'unsupported').length;
  const workspaceDescription = !hasAnalysis
    ? 'Run an analysis and this workspace will surface weak claims, contradictions, evidence sufficiency, and the exact items analysts should flag.'
    : analysis?.analysis_status === 'insufficient_evidence'
      ? 'This run stopped early because the evidence base was too thin. Use the sufficiency panel below to see what needs to improve before another pass.'
      : hasVerification
        ? 'This workspace now reflects mapped report claims instead of only raw signals, so reviewers can see what the system actually asserted and how well each claim is grounded.'
        : 'Verification details appear when the analysis is run with diagnostics enabled.';
  const emptyState = !hasAnalysis
    ? {
        title: 'No verification queue yet',
        description: 'Run an analysis or open a fresh report to build the reviewer workspace.',
      }
    : analysis?.analysis_status === 'insufficient_evidence'
      ? {
          title: 'Synthesis was intentionally skipped',
          description: 'The backend returned an insufficient-evidence result instead of forcing a weak report.',
        }
      : hasVerification
        ? {
            title: 'Queue is clear',
            description: 'The current run does not have unsupported or contradicted claims waiting on review.',
          }
        : {
            title: 'No claim verification payload',
            description: 'The current analysis did not include claim-to-evidence verification data.',
          };

  const selectedClaimSet = useMemo(() => new Set(selectedClaimIds), [selectedClaimIds]);

  const toggleClaim = (claimId: string) => {
    setSelectedClaimIds(previous => (
      previous.includes(claimId)
        ? previous.filter(item => item !== claimId)
        : [...previous, claimId]
    ));
  };

  const submitFeedback = async () => {
    if (!analysis) return;
    setFeedbackStatus('saving');
    setFeedbackMessage(null);
    try {
      await submitAnalystFeedback({
        report_id: savedReportId,
        score,
        useful,
        accurate,
        notes: notes.trim() || null,
        flagged_claim_ids: selectedClaimIds,
        tags: [
          analysis.analysis_status,
          useful ? 'useful' : 'not_useful',
          accurate ? 'accurate' : 'inaccurate',
        ],
      });
      setFeedbackStatus('saved');
      setFeedbackMessage('Analyst feedback saved for future evaluation and fine-tuning readiness tracking.');
    } catch (error) {
      setFeedbackStatus('error');
      setFeedbackMessage(error instanceof Error ? error.message : 'Unable to save analyst feedback.');
    }
  };

  return (
    <div className="fade-in">
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
          marginBottom: 16,
        }}
      >
        {[
          { label: 'Claims checked', value: compactNumber(claimVerification?.claims.length ?? 0), hint: 'mapped report assertions' },
          { label: 'Need review', value: compactNumber(reviewQueue), hint: 'unsupported or contradicted' },
          { label: 'Contradictions', value: compactNumber(contradictions.length), hint: 'highest-risk findings' },
        ].map(card => (
          <div className="panel" key={card.label} style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)' }}>{card.label}</div>
            <div style={{ fontSize: 26, marginTop: 6, fontFamily: 'var(--font-instrument-serif), serif', color: 'var(--text)' }}>{card.value}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{card.hint}</div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.55fr) minmax(300px, 0.95fr)',
          gap: 16,
          alignItems: 'start',
        }}
      >
        <section className="panel">
          <div className="panel-head">
            <span className="panel-title">Verification Workspace</span>
            <span className="panel-action">{hasVerification ? 'claim map' : hasAnalysis ? 'current run' : 'waiting for analysis'}</span>
          </div>
          <div style={{ padding: '0 20px 16px', color: 'var(--muted)', fontSize: 13, lineHeight: 1.6 }}>
            {workspaceDescription}
          </div>
          {analysis?.analysis_status === 'insufficient_evidence' ? (
            <div style={{ padding: '0 20px 20px' }}>
              <div className={`report-status-pill ${toneForStatus(analysis.analysis_status)}`} style={{ marginBottom: 12 }}>
                insufficient evidence
              </div>
              <div className="report-note-list">
                {(evidenceSufficiency?.reasons ?? []).map(reason => (
                  <div className="report-note-item" key={reason}>{reason}</div>
                ))}
              </div>
            </div>
          ) : rows.length ? (
            rows.map(row => (
              <div className="signal-item" key={row.claimId} style={{ padding: '18px 20px', alignItems: 'flex-start' }}>
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
                  {row.links.length ? (
                    <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
                      {row.links.map(link => (
                        <div key={`${row.claimId}-${link.source_index}`} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', background: 'var(--white)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12 }}>
                            <strong style={{ color: 'var(--text)' }}>{link.title}</strong>
                            <span style={{ color: 'var(--muted)', textTransform: 'uppercase' }}>
                              {link.support_label} · {Math.round(link.support_score * 100)}
                            </span>
                          </div>
                          <div style={{ marginTop: 6, fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>{link.rationale}</div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end', flexShrink: 0 }}>
                  <div className={`signal-score ${scoreClass(row.score)}`} style={{ fontSize: 18, fontFamily: 'var(--font-instrument-serif), serif' }}>{row.score}/100</div>
                  <button
                    onClick={() => toggleClaim(row.claimId)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 6,
                      border: '1px solid var(--border)',
                      background: selectedClaimSet.has(row.claimId) ? 'var(--text)' : 'transparent',
                      color: selectedClaimSet.has(row.claimId) ? 'var(--bg)' : 'var(--rust)',
                      fontSize: 12,
                      cursor: 'pointer',
                      fontFamily: 'var(--font-dm-sans), sans-serif',
                      fontWeight: 500,
                    }}
                  >
                    {selectedClaimSet.has(row.claimId) ? 'Flagged' : 'Flag claim'}
                  </button>
                  {row.links[0]?.url ? (
                    <a
                      href={row.links[0].url}
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
                  ) : null}
                </div>
              </div>
            ))
          ) : (
            <div className="empty" style={{ padding: '40px 20px' }}>
              <div className="empty-title">{emptyState.title}</div>
              <div className="empty-desc">{emptyState.description}</div>
            </div>
          )}
        </section>

        <div style={{ display: 'grid', gap: 16 }}>
          <section className="panel" style={{ paddingBottom: 10 }}>
            <div className="panel-head">
              <span className="panel-title">Evidence Sufficiency</span>
              <span className="panel-action">{evidenceSufficiency?.checked ? (evidenceSufficiency.passed ? 'passed' : 'hold') : 'waiting'}</span>
            </div>
            <div style={{ padding: '0 20px 18px', display: 'grid', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--muted)' }}>Ranked sources</span>
                <strong>{evidenceSufficiency?.source_count ?? sourceSignals.length}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--muted)' }}>Unique domains</span>
                <strong>{evidenceSufficiency?.unique_domain_count ?? 0}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--muted)' }}>Official sources</span>
                <strong>{evidenceSufficiency?.official_source_count ?? 0}</strong>
              </div>
              {(evidenceSufficiency?.reasons ?? []).length ? (
                <div className="report-note-list">
                  {evidenceSufficiency?.reasons.map(reason => (
                    <div className="report-note-item" key={reason}>{reason}</div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
                  {hasAnalysis ? 'The evidence gate allowed this run to continue.' : 'Evidence sufficiency will appear here after the first run.'}
                </div>
              )}
            </div>
          </section>

          <section className="panel" style={{ paddingBottom: 10 }}>
            <div className="panel-head">
              <span className="panel-title">Contradictions And Gaps</span>
              <span className="panel-action">review before escalation</span>
            </div>
            <div style={{ padding: '0 20px 18px', display: 'grid', gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: 8 }}>Contradictions</div>
                {contradictions.length ? (
                  <div className="report-note-list">
                    {contradictions.map(item => (
                      <div className="report-note-item" key={`${item.claim_id}-${item.source_index}`}>
                        {item.claim_text} ({item.source_title} · {Math.round(item.confidence * 100)})
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
                    {hasAnalysis ? 'No explicit claim contradictions were returned for this run.' : 'Contradictions will appear here when a claim conflicts with mapped evidence.'}
                  </div>
                )}
              </div>
              <div>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: 8 }}>Blocking issues</div>
                {blockingIssues.length ? (
                  <div className="report-note-list">
                    {blockingIssues.map(issue => <div className="report-note-item" key={issue}>{issue}</div>)}
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
                    {hasAnalysis ? 'No active blocking issues on the current run.' : 'Blocking issues will appear once a run flags unresolved risks.'}
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
                    {hasAnalysis ? 'No evaluator gaps were returned for this run.' : 'Knowledge gaps will appear here once the evaluator identifies missing proof.'}
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="panel" style={{ paddingBottom: 10 }}>
            <div className="panel-head">
              <span className="panel-title">Analyst Feedback</span>
              <span className="panel-action">label today, tune later</span>
            </div>
            <div style={{ padding: '0 20px 18px', display: 'grid', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 8 }}>
                {[1, 2, 3, 4, 5].map(value => (
                  <button
                    key={value}
                    onClick={() => setScore(value)}
                    style={{
                      padding: '10px 0',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      background: score === value ? 'var(--text)' : 'var(--white)',
                      color: score === value ? 'var(--bg)' : 'var(--text)',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-dm-sans), sans-serif',
                      fontWeight: 600,
                    }}
                  >
                    {value}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {[
                  { label: useful ? 'Useful' : 'Not useful', value: useful, setter: setUseful },
                  { label: accurate ? 'Accurate' : 'Inaccurate', value: accurate, setter: setAccurate },
                ].map(control => (
                  <button
                    key={control.label}
                    onClick={() => control.setter(!control.value)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 999,
                      border: '1px solid var(--border)',
                      background: control.value ? 'var(--text)' : 'transparent',
                      color: control.value ? 'var(--bg)' : 'var(--text)',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {control.label}
                  </button>
                ))}
              </div>
              <textarea
                value={notes}
                onChange={event => setNotes(event.target.value)}
                placeholder="Add reviewer notes about grounding, contradictions, or what the model missed."
                style={{
                  minHeight: 96,
                  resize: 'vertical',
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  padding: '12px 14px',
                  fontSize: 13,
                  fontFamily: 'var(--font-dm-sans), sans-serif',
                  background: 'var(--white)',
                  color: 'var(--text)',
                }}
              />
              <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
                {selectedClaimIds.length
                  ? `${selectedClaimIds.length} claim(s) flagged for follow-up.`
                  : 'Optional: flag one or more claims above before saving feedback.'}
              </div>
              <button
                onClick={() => { void submitFeedback(); }}
                disabled={!analysis || feedbackStatus === 'saving'}
                style={{
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'var(--rust)',
                  color: 'white',
                  cursor: !analysis || feedbackStatus === 'saving' ? 'not-allowed' : 'pointer',
                  opacity: !analysis || feedbackStatus === 'saving' ? 0.6 : 1,
                  fontWeight: 600,
                }}
              >
                {feedbackStatus === 'saving' ? 'Saving feedback...' : 'Save analyst feedback'}
              </button>
              {feedbackMessage ? (
                <div style={{ fontSize: 12, color: feedbackStatus === 'error' ? 'var(--rust)' : 'var(--green)', lineHeight: 1.6 }}>
                  {feedbackMessage}
                </div>
              ) : null}
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
