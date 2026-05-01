import logging

from langchain_core.messages import HumanMessage, SystemMessage

from app.core.config import settings
from app.infrastructure.graph.trace import append_trace
from app.infrastructure.llm.openai_llm import get_llm
from app.schemas.rag_schema import EvaluationResult

logger = logging.getLogger(__name__)

QUALITY_WEIGHTS = {
    "evidence_grounding": 0.25,
    "timeframe_fit": 0.15,
    "source_credibility_weighting": 0.20,
    "specificity_and_depth": 0.20,
    "memory_integration": 0.10,
    "practical_usefulness": 0.10,
}

CRITERION_LABELS = {
    "evidence_grounding": "Evidence grounding",
    "timeframe_fit": "Timeframe fit",
    "source_credibility_weighting": "Source credibility weighting",
    "specificity_and_depth": "Specificity and depth",
    "memory_integration": "Memory integration",
    "practical_usefulness": "Practical usefulness",
}

SYSTEM_PROMPT = """You are a senior quality assurance analyst specializing in the evaluation of AI-generated research reports within a Retrieval-Augmented Generation (RAG) pipeline. Your task is to rigorously assess whether a given report meets the required quality threshold for final delivery. Your evaluation directly controls whether the system iterates to produce a better report or accepts the current one.

Your role demands intellectual honesty. Inflated scores that allow poor-quality reports to pass degrade the entire system. Conversely, unfairly low scores that reject high-quality work waste resources and delay delivery. Score accurately.

---

EVALUATION CRITERIA

Score the report across six criteria. Each criterion has a stated weight, but the application will compute the final weighted composite score. Your job is to provide fair per-criterion scores from 0.0 to 1.0.

1. EVIDENCE GROUNDING (weight: 25%)
   Does every major claim in the report trace directly and specifically to the provided evidence? Are citations accurate — do they faithfully represent what the source actually says? Penalize heavily for:
     - Claims asserted without any corresponding evidence
     - Paraphrases that distort or overstate what the evidence says
     - Hallucinated or fabricated details
   High score: every significant claim is clearly tied to specific evidence passages.

2. TIMEFRAME FIT (weight: 15%)
   Does the report stay focused on the requested timeframe? Are claims anchored temporally? Penalize for:
     - Analysis that drifts to events outside the requested period without justification
     - Failure to engage with time-sensitive developments present in the evidence
     - Treating historical context as if it were current fact
   High score: the report consistently anchors claims within the requested period and treats out-of-period information as background only.

3. SOURCE CREDIBILITY WEIGHTING (weight: 20%)
   Does the report appropriately reflect the credibility assessment of the evidence? Specifically:
     - Are claims from high-credibility sources presented with appropriate confidence?
     - Are claims from low-credibility sources hedged, caveated, or flagged?
     - Does the report avoid presenting uncertain or biased information as established fact?
   High score: the report's confidence levels visibly track the credibility landscape of the sources.

4. SPECIFICITY AND DEPTH (weight: 20%)
   Does the report provide substantive, specific analysis rather than vague generalities? Penalize for:
     - Findings stated as obvious or generic observations any uninformed reader could make
     - Lack of named entities, quantified claims, or concrete details
     - Superficial treatment of the most important aspects of the topic
   High score: findings are precise, detailed, and would be non-obvious to a reader who had not seen the evidence.
   Important: if the raw evidence pool itself lacks quantified data or named entities, do not penalise the report for that absence — score based on how fully the report exploits the concrete details that do exist in the evidence.

5. MEMORY INTEGRATION (weight: 10%)
   Does the report make appropriate use of the prior memory context within the compact sentiment report when prior memory is relevant? Penalize for:
     - Ignoring relevant prior knowledge that would have meaningfully enriched the analysis
     - Over-relying on historical memory at the expense of current evidence
     - Applying prior memory without attribution, making it impossible to distinguish recalled from current knowledge
   High score: memory is used transparently, selectively, and adds genuine analytical value without bloating the sentiment response.

6. PRACTICAL USEFULNESS (weight: 10%)
   Would this report provide genuine value to the intended audience (decision-maker, researcher, analyst)? Does it answer the core question implied by the topic and priority theme? Does the ACTIONABLE INSIGHTS section provide specific, actionable guidance? Penalize for:
     - Reports that describe the situation without drawing any conclusions
     - Missing, vague, or generic recommended actions (e.g., "monitor the situation" without specifics)
     - Failure to address the priority theme if one was specified
   High score: a reader comes away with a clear, actionable understanding of the situation and concrete next steps.

---

SCORING INSTRUCTIONS

Provide one score from 0.0 to 1.0 for each criterion. Be strict but fair. A report that is readable but weakly sourced should not pass evidence grounding. A report that is well sourced but has generic recommendations should lose practical usefulness points.

The quality threshold for this evaluation run is provided in the user message. A score at or above the threshold means the report passes and is ready for delivery. A score below it means another iteration is warranted.

Your output must include:
  - quality_breakdown: an object with exactly these criterion scores: evidence_grounding, timeframe_fit, source_credibility_weighting, specificity_and_depth, memory_integration, practical_usefulness
  - score: optional two-decimal estimate of the composite score; the application will recompute it from quality_breakdown
  - feedback: concise but specific — what the report did well, what specifically needs improvement, and why the score is what it is. Reference specific sections or claims where relevant.
  - knowledge_gaps: a list of concrete, actionable sub-questions or missing data points. Each gap should be specific enough that a search query could be constructed to address it. Vague gaps ("more information needed") are not acceptable.
  - blocking_issues: a short list of concrete reasons the report cannot pass yet. Each issue should map to a low-scoring criterion or unresolved gap."""


def _clamp_score(value):
    return max(0.0, min(1.0, float(value)))


def _extract_breakdown(result):
    quality_breakdown = getattr(result, "quality_breakdown", None)
    if not quality_breakdown:
        return {}
    if hasattr(quality_breakdown, "model_dump"):
        raw = quality_breakdown.model_dump()
    else:
        raw = dict(quality_breakdown)
    return {
        key: round(_clamp_score(raw.get(key, 0.0)), 2)
        for key in QUALITY_WEIGHTS
    }


def _weighted_score(breakdown, fallback_score):
    if breakdown:
        weighted = sum(breakdown[key] * weight for key, weight in QUALITY_WEIGHTS.items())
        return round(_clamp_score(weighted), 2)
    if fallback_score is None:
        return 0.0
    return round(_clamp_score(fallback_score), 2)


def _dedupe_text(items):
    seen = set()
    deduped = []
    for item in items:
        cleaned = " ".join(str(item).split())
        if not cleaned:
            continue
        key = cleaned.lower()
        if key in seen:
            continue
        seen.add(key)
        deduped.append(cleaned)
    return deduped


def _blocking_issues(result_issues, breakdown, gaps, feedback, threshold, passed):
    issues = list(result_issues or [])
    if not passed:
        for key, value in breakdown.items():
            if value < threshold:
                issues.append(f"{CRITERION_LABELS[key]} scored {value:.2f}, below the {threshold:.2f} threshold.")
        if gaps:
            issues.append("Open knowledge gaps remain: " + "; ".join(gaps[:3]))
        if not issues and feedback:
            issues.append(feedback)
        if not issues:
            issues.append(f"Composite quality score is below the {threshold:.2f} threshold.")
    return _dedupe_text(issues)[:6]


def _citation_validation_issues(validation):
    if not validation or validation.get("passed", True):
        return []
    issues = []
    unsupported_urls = validation.get("unsupported_urls") or []
    unsupported_titles = validation.get("unsupported_source_titles") or []
    if unsupported_urls:
        issues.append("Report cites URLs that were not present in collected evidence: " + "; ".join(unsupported_urls[:3]))
    if unsupported_titles:
        issues.append("Report cites source titles that were not present in collected evidence: " + "; ".join(unsupported_titles[:3]))
    return issues


def _apply_citation_penalty(breakdown, gaps, issues, validation):
    citation_issues = _citation_validation_issues(validation)
    if not citation_issues:
        return breakdown, gaps, issues

    adjusted = dict(breakdown)
    if adjusted:
        adjusted["evidence_grounding"] = min(adjusted.get("evidence_grounding", 0.0), 0.40)
        adjusted["source_credibility_weighting"] = min(
            adjusted.get("source_credibility_weighting", 0.0),
            0.60,
        )
    adjusted_gaps = _dedupe_text(
        list(gaps or [])
        + ["Verify unsupported report citations against collected evidence sources."]
    )
    adjusted_issues = _dedupe_text(list(issues or []) + citation_issues)
    return adjusted, adjusted_gaps, adjusted_issues


def _apply_claim_verification_penalty(breakdown, gaps, issues, verification):
    if not verification or not verification.get("checked"):
        return breakdown, gaps, issues

    contradicted = int(verification.get("contradicted_claim_count") or 0)
    unsupported = int(verification.get("unsupported_claim_count") or 0)
    if contradicted <= 0 and unsupported <= 0:
        return breakdown, gaps, issues

    adjusted = dict(breakdown)
    if contradicted > 0:
        adjusted["evidence_grounding"] = min(adjusted.get("evidence_grounding", 0.0), 0.45)
        adjusted["source_credibility_weighting"] = min(
            adjusted.get("source_credibility_weighting", 0.0),
            0.55,
        )
    elif unsupported > 0:
        adjusted["evidence_grounding"] = min(adjusted.get("evidence_grounding", 0.0), 0.6)

    claim_issues = []
    if contradicted > 0:
        claim_issues.append(f"{contradicted} claim(s) were contradicted during source verification.")
    if unsupported > 0:
        claim_issues.append(f"{unsupported} claim(s) remain weakly supported or unsupported.")
    adjusted_gaps = _dedupe_text(list(gaps or []) + ["Resolve claim-to-source support gaps before delivery."])
    adjusted_issues = _dedupe_text(list(issues or []) + claim_issues)
    return adjusted, adjusted_gaps, adjusted_issues


def evaluate_node(state):
    llm = get_llm()
    threshold = settings.RAG_QUALITY_THRESHOLD
    iteration = state.get("iteration", 1)

    logger.info("evaluate start — place=%s iteration=%d threshold=%.2f", state["place"], iteration, threshold)

    themes = ", ".join(state.get("prioritize_themes") or [])
    focus_terms = ", ".join(state.get("focus_terms") or [])
    runtime_options = state.get("runtime_options") or {}
    evidence_char_limit = int(runtime_options.get("evidence_char_limit", settings.RAG_EVIDENCE_CHAR_LIMIT))
    evidence = (state.get("evidence_text") or "")[:evidence_char_limit]
    user_message = f"""Place: {state["place"]}
Monitoring window: {state["monitoring_window"]}
Categories: {themes or "none"}
Focus terms: {focus_terms or "none"}
Quality threshold: {threshold}

Evidence:
{evidence or "none"}

Retrieved memory:
{state.get("memory_context") or "none"}

Sentiment analysis:
{state.get("sentiment") or "none"}

Credibility analysis:
{state.get("credibility") or "none"}

Citation validation:
{state.get("citation_validation") or "not checked"}

Claim verification:
{state.get("claim_verification") or "not checked"}

Final report:
{state.get("final_report") or "none"}"""

    result = None
    try:
        evaluator = llm.with_structured_output(EvaluationResult)
        result = evaluator.invoke([SystemMessage(content=SYSTEM_PROMPT), HumanMessage(content=user_message)])
        breakdown = _extract_breakdown(result)
        feedback = result.feedback
        gaps = result.knowledge_gaps
        raw_issues = result.blocking_issues
        error = None
    except Exception as exc:
        breakdown = {}
        feedback = f"Evaluation failed: {exc}"
        gaps = ["evaluation failed"]
        raw_issues = []
        error = str(exc)

    breakdown, gaps, raw_issues = _apply_citation_penalty(
        breakdown,
        gaps,
        raw_issues,
        state.get("citation_validation") or {},
    )
    breakdown, gaps, raw_issues = _apply_claim_verification_penalty(
        breakdown,
        gaps,
        raw_issues,
        state.get("claim_verification") or {},
    )
    score = _weighted_score(breakdown, getattr(result, "score", None) if result is not None else None)
    passed = score >= threshold
    issues = _blocking_issues(
        raw_issues,
        breakdown,
        gaps,
        feedback,
        threshold,
        passed,
    )

    logger.info("evaluate done — score=%.2f passed=%s threshold=%.2f", score, passed, threshold)
    previous_best = state.get("best_quality_score", -1.0)
    best_report = state.get("best_report") or ""
    best_sentiment_report = state.get("best_sentiment_report") or {}
    best_score = previous_best
    best_breakdown = state.get("best_quality_breakdown") or {}
    best_feedback = state.get("best_quality_feedback") or ""
    best_gaps = state.get("best_knowledge_gaps") or []
    best_issues = state.get("best_blocking_issues") or []
    if score >= previous_best:
        best_report = state.get("final_report") or ""
        best_sentiment_report = state.get("sentiment_report") or {}
        best_score = score
        best_breakdown = breakdown
        best_feedback = feedback
        best_gaps = gaps
        best_issues = issues

    next_state = {
        **state,
        "quality_score": score,
        "quality_breakdown": breakdown,
        "quality_passed": passed,
        "quality_feedback": feedback,
        "knowledge_gaps": gaps,
        "blocking_issues": issues,
        "best_report": best_report,
        "best_sentiment_report": best_sentiment_report,
        "best_quality_score": best_score,
        "best_quality_breakdown": best_breakdown,
        "best_quality_feedback": best_feedback,
        "best_knowledge_gaps": best_gaps,
        "best_blocking_issues": best_issues,
    }
    return {
        **next_state,
        "cycle_trace": append_trace(
            next_state,
            "evaluate",
            "scored",
            score=score,
            quality_breakdown=breakdown,
            passed=passed,
            threshold=threshold,
            blocking_issues=issues,
            error=error,
        ),
    }
