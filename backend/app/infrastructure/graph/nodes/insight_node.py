import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlsplit

from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field

from app.core.config import settings
from app.infrastructure.graph.nodes.sentiment_ensemble import normalize_scores
from app.infrastructure.graph.trace import append_trace
from app.infrastructure.llm.openai_llm import get_llm

logger = logging.getLogger(__name__)

SENTIMENT_LABELS = ("negative", "neutral", "positive")
# 1-100 rubric for source-level credibility scores shown beside each signal.
# These scores also weight sentiment percentages, so weak/unverified signals do
# not count the same as stronger source-backed findings.
CREDIBILITY_SCORE_RUBRIC = {
    "High": 92,
    "Moderate": 70,
    "Low": 38,
    "Unverified": 25,
}
HIGH_AUTHORITY_DOMAINS = {
    "apnews.com",
    "bbc.com",
    "cnn.com",
    "pna.gov.ph",
    "reuters.com",
    "who.int",
    "worldbank.org",
}

SYSTEM_PROMPT = """You are a senior public-signal analyst. Create the content for an overall sentiment response from the supplied evidence, sentiment analysis, credibility analysis, and source catalog.

Return structured fields only. The application will render the final report, source brackets, metrics, and headings deterministically.

Required content:
- overall_label: Positive Sentiment, Neutral Sentiment, Negative Sentiment, or Mixed Sentiment.
- overview: 1 concise paragraph that synthesizes the overall situation.
- source_signals: optional draft hints only; if supplied, each hint must use source_index. Source-level signals are generated separately for every collected source and must not be capped by this response.
- actionable_insights: 3-5 short, specific next steps for analysts or local decision-makers.

Do not invent sources, URLs, dates, or claims. Use the requested monitoring window and priority themes. Treat MISINFO as review-needed misinformation risk, not proof that a claim is false."""

SOURCE_SIGNAL_PROMPT = """You are a source-level public-signal analyst. Create exactly one signal from the supplied source.

Return structured fields only:
- summary: one compact sentence supported only by this source.
- sentiment: Positive, Neutral, or Negative.
- credibility: High, Moderate, Low, or Unverified.
- verification: verified only when this source is official/high-authority or the supplied context says the claim is corroborated; otherwise unverified.

Do not invent facts, dates, URLs, or claims. If the source is thin, summarize cautiously and mark credibility as Low or Unverified."""


class SourceSignalDraft(BaseModel):
    source_index: int = Field(ge=1)
    summary: str = ""
    sentiment: str = "Neutral"
    verification: str = "unverified"
    credibility: str = "Unverified"


class SentimentReportDraft(BaseModel):
    overall_label: str = "Mixed Sentiment"
    overview: str = ""
    source_signals: list[SourceSignalDraft] = Field(default_factory=list)
    actionable_insights: list[str] = Field(default_factory=list)


class SourceSignalAnalysis(BaseModel):
    summary: str = ""
    sentiment: str = "Neutral"
    verification: str = "unverified"
    credibility: str = "Unverified"


def _clean_text(value: Any, max_chars: int | None = None) -> str:
    text = " ".join(str(value or "").split())
    if max_chars and len(text) > max_chars:
        return text[: max_chars - 3].rstrip() + "..."
    return text


def _source_url(item: Any) -> str | None:
    if not isinstance(item, dict):
        return None
    return item.get("url") or item.get("link") or item.get("source")


def _domain_from_url(url: str | None) -> str:
    if not url:
        return ""
    host = urlsplit(str(url)).netloc.lower()
    if host.startswith("www."):
        host = host[4:]
    return host


def _source_title(item: Any) -> str:
    if not isinstance(item, dict):
        return "Untitled source"
    return _clean_text(item.get("title") or item.get("name") or "Untitled source", 160)


def _source_content(item: Any) -> str:
    if not isinstance(item, dict):
        return _clean_text(item, 700)
    content = item.get("raw_content") or item.get("content") or item.get("snippet") or ""
    return _clean_text(content, 700)


def _source_catalog(items: list[Any]) -> list[dict[str, Any]]:
    catalog = []
    for index, item in enumerate(items or [], start=1):
        url = _source_url(item)
        domain = _domain_from_url(url)
        catalog.append(
            {
                "index": index,
                "title": _source_title(item),
                "url": url,
                "source": domain or _source_title(item),
                "published": item.get("published_date") or item.get("published") or item.get("date")
                if isinstance(item, dict)
                else None,
                "content_preview": _source_content(item),
            }
        )
    return catalog


def _format_source_catalog(catalog: list[dict[str, Any]]) -> str:
    if not catalog:
        return "No collected sources available."
    formatted = []
    for item in catalog:
        parts = [
            f"[{item['index']}] Source: {item['source']}",
            f"Title: {item['title']}",
        ]
        if item.get("url"):
            parts.append(f"URL: {item['url']}")
        if item.get("published"):
            parts.append(f"Published: {item['published']}")
        if item.get("content_preview"):
            parts.append(f"Preview: {item['content_preview']}")
        formatted.append("\n".join(parts))
    return "\n\n".join(formatted)


def _normalize_sentiment(value: Any) -> str:
    text = _clean_text(value).casefold()
    if text.startswith("pos"):
        return "Positive"
    if text.startswith("neg"):
        return "Negative"
    return "Neutral"


def _normalize_credibility(value: Any) -> str:
    text = _clean_text(value).casefold()
    if text.startswith("high"):
        return "High"
    if text.startswith("mod") or text.startswith("med"):
        return "Moderate"
    if text.startswith("low"):
        return "Low"
    return "Unverified"


def _is_high_authority_domain(domain: str) -> bool:
    domain = (domain or "").casefold()
    if not domain:
        return False
    if domain.endswith(".gov") or ".gov." in domain or domain.endswith(".gov.ph") or ".gov.ph" in domain:
        return True
    if domain.endswith(".edu") or ".edu." in domain:
        return True
    return any(domain == trusted or domain.endswith("." + trusted) for trusted in HIGH_AUTHORITY_DOMAINS)


def _verification_for_signal(draft: SourceSignalDraft | SourceSignalAnalysis, source: dict[str, Any], credibility: str) -> str:
    requested = _clean_text(draft.verification).casefold()
    if _is_high_authority_domain(source.get("source", "")):
        return "verified"
    if requested == "verified" and credibility in {"High", "Moderate"}:
        return "verified"
    return "unverified"


def _rounded_sentiment_percentages(raw: dict[str, float]) -> dict[str, int]:
    total = sum(max(0.0, float(raw.get(label, 0.0) or 0.0)) for label in SENTIMENT_LABELS)
    if total <= 0:
        return {"negative_pct": 0, "neutral_pct": 100, "positive_pct": 0}

    raw = {
        label: (max(0.0, float(raw.get(label, 0.0) or 0.0)) / total) * 100
        for label in SENTIMENT_LABELS
    }
    base = {label: int(raw[label]) for label in SENTIMENT_LABELS}
    remainder = 100 - sum(base.values())
    by_fraction = sorted(
        SENTIMENT_LABELS,
        key=lambda label: raw[label] - base[label],
        reverse=True,
    )
    for index in range(remainder):
        base[by_fraction[index % len(by_fraction)]] += 1

    return {
        "negative_pct": base["negative"],
        "neutral_pct": base["neutral"],
        "positive_pct": base["positive"],
    }


def _model_sentiment_percentages(scores: Any) -> dict[str, int]:
    if not scores:
        return {"negative_pct": 0, "neutral_pct": 100, "positive_pct": 0}
    return _rounded_sentiment_percentages(normalize_scores(scores))


def _source_signal_sentiment_percentages(source_signals: list[dict[str, Any]]) -> dict[str, int] | None:
    if not source_signals:
        return None

    weighted_counts = {label: 0.0 for label in SENTIMENT_LABELS}
    for signal in source_signals:
        sentiment = _normalize_sentiment(signal.get("sentiment")).casefold()
        weight = max(1, int(signal.get("credibility_score") or 0))
        weighted_counts[sentiment] += weight

    return _rounded_sentiment_percentages(weighted_counts)


def _overall_label_from_percentages(percentages: dict[str, int]) -> str:
    values = {
        "Negative": int(percentages.get("negative_pct") or 0),
        "Neutral": int(percentages.get("neutral_pct") or 0),
        "Positive": int(percentages.get("positive_pct") or 0),
    }
    ordered = sorted(values.items(), key=lambda item: item[1], reverse=True)
    top_label, top_value = ordered[0]
    second_value = ordered[1][1]
    if top_value < 45 or top_value - second_value < 15:
        return "Mixed Sentiment"
    return f"{top_label} Sentiment"


def _overall_label(state: dict[str, Any], draft: SentimentReportDraft) -> str:
    label = _clean_text(state.get("sentiment_label")) or _clean_text(draft.overall_label)
    if not label:
        label = "Mixed"
    if "sentiment" not in label.casefold():
        label = f"{label} Sentiment"
    return label


def _fallback_summary(source: dict[str, Any]) -> str:
    preview = _clean_text(source.get("content_preview"), 260)
    if preview:
        return preview
    return f"{source.get('title') or source.get('source') or 'This source'} was collected for review."


def _fallback_signal_from_source(state: dict[str, Any], source: dict[str, Any]) -> SourceSignalDraft:
    label = state.get("sentiment_label") or "Mixed"
    credibility_label = _overall_credibility_label(state.get("credibility"))
    return SourceSignalDraft(
        source_index=source["index"],
        summary=_fallback_summary(source),
        sentiment=_normalize_sentiment(label),
        verification="verified" if credibility_label in {"High", "Moderate"} else "unverified",
        credibility=credibility_label,
    )


def _fallback_draft(state: dict[str, Any], catalog: list[dict[str, Any]]) -> SentimentReportDraft:
    signals = [
        _fallback_signal_from_source(state, source)
        for source in catalog
    ]

    return SentimentReportDraft(
        overall_label=_overall_label(state, SentimentReportDraft()),
        overview=_clean_text(state.get("sentiment"), 600)
        or "Collected evidence is limited; current signals should be reviewed with source-level caution.",
        source_signals=signals,
        actionable_insights=[
            "Review unverified source claims before using them for public-facing decisions.",
            "Prioritize official or independently corroborated updates during the monitoring window.",
            "Re-run collection if major claims remain supported by only one low-authority source.",
        ],
    )


def _source_signal_user_message(
    state: dict[str, Any],
    source: dict[str, Any],
) -> str:
    themes = ", ".join(state.get("prioritize_themes") or []) or "none"
    focus_terms = ", ".join(state.get("focus_terms") or []) or "none"
    return f"""Place: {state.get("place")}
Monitoring window: {state.get("monitoring_window")}
Categories: {themes}
Focus terms: {focus_terms}

Overall sentiment analysis:
{state.get("sentiment") or "none"}

Overall credibility analysis:
{state.get("credibility") or "none"}

Source index: {source["index"]}
Source: {source.get("source") or "unknown"}
Title: {source.get("title") or "Untitled source"}
URL: {source.get("url") or "none"}
Published: {source.get("published") or "unknown"}
Preview: {source.get("content_preview") or "No preview available."}"""


def _source_signal_draft_from_analysis(
    analysis: SourceSignalAnalysis,
    source: dict[str, Any],
) -> SourceSignalDraft:
    credibility = _normalize_credibility(analysis.credibility)
    return SourceSignalDraft(
        source_index=source["index"],
        summary=_clean_text(analysis.summary, 420),
        sentiment=_normalize_sentiment(analysis.sentiment),
        verification=_verification_for_signal(analysis, source, credibility),
        credibility=credibility,
    )


def _generate_one_source_signal(
    llm: Any,
    state: dict[str, Any],
    source: dict[str, Any],
) -> tuple[SourceSignalDraft, str | None]:
    try:
        analyzer = llm.with_structured_output(SourceSignalAnalysis)
        analysis = analyzer.invoke(
            [
                SystemMessage(content=SOURCE_SIGNAL_PROMPT),
                HumanMessage(content=_source_signal_user_message(state, source)),
            ]
        )
        return _source_signal_draft_from_analysis(analysis, source), None
    except Exception as exc:
        return _fallback_signal_from_source(state, source), f"{source['index']}: {exc}"


def _generate_source_signal_drafts(
    llm: Any,
    state: dict[str, Any],
    catalog: list[dict[str, Any]],
) -> tuple[list[SourceSignalDraft], list[str]]:
    if not catalog:
        return [], []

    max_workers = max(1, min(len(catalog), settings.RAG_SIGNAL_MAX_WORKERS))
    drafts_by_index: dict[int, SourceSignalDraft] = {}
    errors = []

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_source = {
            executor.submit(_generate_one_source_signal, llm, state, source): source
            for source in catalog
        }
        for future in as_completed(future_to_source):
            source = future_to_source[future]
            draft, error = future.result()
            drafts_by_index[source["index"]] = draft
            if error:
                errors.append(error)

    return [drafts_by_index[source["index"]] for source in catalog], errors


def _overall_credibility_label(credibility: Any) -> str:
    text = _clean_text(credibility).casefold()
    if "overall high" in text or "rating: high" in text or " high " in f" {text} ":
        return "High"
    if "overall medium" in text or "overall moderate" in text or "rating: medium" in text or "rating: moderate" in text:
        return "Moderate"
    if "overall low" in text or "rating: low" in text:
        return "Low"
    return "Unverified"


def _build_source_signals(
    draft: SentimentReportDraft,
    catalog: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[int], set[int]]:
    catalog_by_index = {item["index"]: item for item in catalog}
    source_signals = []
    credibility_scores = []
    seen_indexes = set()

    for signal in draft.source_signals:
        if signal.source_index in seen_indexes:
            continue
        source = catalog_by_index.get(signal.source_index)
        if not source:
            continue
        seen_indexes.add(signal.source_index)

        credibility = _normalize_credibility(signal.credibility)
        verification = _verification_for_signal(signal, source, credibility)
        credibility_score = CREDIBILITY_SCORE_RUBRIC[credibility]
        credibility_scores.append(credibility_score)
        source_signals.append(
            {
                "source": source.get("source") or _domain_from_url(source.get("url")) or source.get("title", ""),
                "title": source.get("title", ""),
                "url": source.get("url"),
                "summary": _clean_text(signal.summary, 420) or _fallback_summary(source),
                "sentiment": _normalize_sentiment(signal.sentiment),
                "verification": verification,
                "credibility": credibility,
                "credibility_score": credibility_score,
            }
        )

    return source_signals, credibility_scores, seen_indexes


def build_sentiment_report(
    state: dict[str, Any],
    draft: SentimentReportDraft,
    catalog: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    catalog = catalog if catalog is not None else _source_catalog(state.get("collected_data") or [])
    source_signals, credibility_scores, used_indexes = _build_source_signals(draft, catalog)
    if not source_signals and catalog:
        fallback = _fallback_draft(state, catalog)
        source_signals, credibility_scores, used_indexes = _build_source_signals(fallback, catalog)
        if not draft.overview:
            draft.overview = fallback.overview
        if not draft.actionable_insights:
            draft.actionable_insights = fallback.actionable_insights

    target_signal_count = len(catalog)
    if source_signals and len(source_signals) < target_signal_count:
        top_up_draft = SentimentReportDraft(
            source_signals=[
                _fallback_signal_from_source(state, source)
                for source in catalog
                if source["index"] not in used_indexes
            ]
        )
        supplemental_signals, supplemental_scores, supplemental_indexes = _build_source_signals(
            top_up_draft,
            catalog,
        )
        source_signals.extend(supplemental_signals)
        credibility_scores.extend(supplemental_scores)
        used_indexes.update(supplemental_indexes)

    source_sentiment_pcts = _source_signal_sentiment_percentages(source_signals)
    sentiment_pcts = source_sentiment_pcts or _model_sentiment_percentages(state.get("sentiment_scores"))
    signal_count = len(source_signals)
    verified_count = sum(1 for signal in source_signals if signal["verification"] == "verified")
    verified_pct = round((verified_count / signal_count) * 100) if signal_count else 0
    credibility_pct = round(sum(credibility_scores) / len(credibility_scores)) if credibility_scores else 0
    insights = [
        _clean_text(insight, 220)
        for insight in draft.actionable_insights
        if _clean_text(insight)
    ][:5]
    if not insights:
        insights = _fallback_draft(state, catalog).actionable_insights

    return {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_label": "Updated moments ago",
        "overall_label": _overall_label_from_percentages(sentiment_pcts)
        if source_sentiment_pcts
        else _overall_label(state, draft),
        "overview": _clean_text(draft.overview, 700)
        or "Current evidence is limited; interpret the source-level signals with caution.",
        "source_signals": source_signals,
        "metrics": {
            **sentiment_pcts,
            "credibility_pct": credibility_pct,
            "verified_pct": verified_pct,
            "misinfo_risk_pct": 100 - verified_pct if signal_count else 0,
            "signal_count": signal_count,
        },
        "actionable_insights": insights,
    }


def _finish_sentence(value: str) -> str:
    value = _clean_text(value)
    if not value:
        return ""
    if value[-1] in ".!?":
        return value
    return value + "."


def render_sentiment_report(report: dict[str, Any]) -> str:
    metrics = report.get("metrics") or {}
    lines = [
        "OVERALL SENTIMENT",
        report.get("updated_label") or "Updated moments ago",
        report.get("overall_label") or "Mixed Sentiment",
    ]

    overview = _clean_text(report.get("overview"))
    if overview:
        lines.append(_finish_sentence(overview))

    for signal in report.get("source_signals") or []:
        summary = _finish_sentence(signal.get("summary", ""))
        if not summary:
            continue
        source = _clean_text(signal.get("source") or _domain_from_url(signal.get("url")) or signal.get("title"))
        sentiment = _normalize_sentiment(signal.get("sentiment"))
        verification = "verified" if signal.get("verification") == "verified" else "unverified"
        lines.append(f"{summary} [Src: {source} | Sent: {sentiment} | {verification}].")

    signal_count = int(metrics.get("signal_count") or 0)
    risk_label = "Low risk" if int(metrics.get("misinfo_risk_pct") or 0) <= 40 else "Review needed"
    lines.extend(
        [
            f"{int(metrics.get('negative_pct') or 0)}%",
            "NEGATIVE",
            f"{int(metrics.get('neutral_pct') or 0)}%",
            "NEUTRAL",
            f"{int(metrics.get('positive_pct') or 0)}%",
            "POSITIVE",
            f"{int(metrics.get('credibility_pct') or 0)}%",
            "CREDIBILITY",
            f"{signal_count}-signal analysis",
            f"{int(metrics.get('verified_pct') or 0)}%",
            "VERIFIED",
            risk_label,
            f"{int(metrics.get('misinfo_risk_pct') or 0)}%",
            "MISINFO",
            "Review needed",
            "",
            "ACTIONABLE INSIGHTS",
        ]
    )

    insights = report.get("actionable_insights") or []
    if insights:
        lines.extend(f"- {_finish_sentence(insight)}" for insight in insights if _clean_text(insight))
    else:
        lines.append("- No actionable insight available from the current evidence.")

    return "\n".join(lines).strip()


def insight_node(state):
    llm = get_llm()

    themes = ", ".join(state.get("prioritize_themes") or [])
    focus_terms = ", ".join(state.get("focus_terms") or [])
    runtime_options = state.get("runtime_options") or {}
    evidence_char_limit = int(runtime_options.get("evidence_char_limit", settings.RAG_EVIDENCE_CHAR_LIMIT))
    evidence = (state["evidence_text"] or "")[:evidence_char_limit]
    iteration = state.get("iteration", 1)
    catalog = _source_catalog(state.get("collected_data") or [])

    logger.info("insight start — place=%s iteration=%d evidence_chars=%d", state["place"], iteration, len(evidence))

    user_message = f"""Place: {state["place"]}
Monitoring window: {state["monitoring_window"]}
Categories: {themes or "none"}
Focus terms: {focus_terms or "none"}
Current iteration: {iteration}

Quality feedback to address:
{state.get("quality_feedback") or "none"}

Knowledge gaps to close:
{", ".join(state.get("knowledge_gaps") or []) or "none"}

Sentiment analysis:
{state["sentiment"]}

Credibility analysis:
{state["credibility"]}

Sentiment scores:
{state.get("sentiment_scores") or "none"}

Source catalog:
{_format_source_catalog(catalog)}

Evidence:
{evidence}

Relevant prior memory:
{state["memory_context"]}"""

    try:
        reporter = llm.with_structured_output(SentimentReportDraft)
        draft = reporter.invoke([SystemMessage(content=SYSTEM_PROMPT), HumanMessage(content=user_message)])
        report_error = None
    except Exception as exc:
        logger.warning("structured sentiment report failed; using deterministic fallback: %s", exc)
        draft = _fallback_draft(state, catalog)
        report_error = str(exc)

    signal_errors = []
    if catalog:
        source_signal_drafts, signal_errors = _generate_source_signal_drafts(llm, state, catalog)
        draft = SentimentReportDraft(
            overall_label=draft.overall_label,
            overview=draft.overview,
            source_signals=source_signal_drafts,
            actionable_insights=draft.actionable_insights,
        )

    sentiment_report = build_sentiment_report(state, draft, catalog)
    final_report = render_sentiment_report(sentiment_report)

    logger.info("insight done — report_chars=%d signals=%d", len(final_report), len(sentiment_report["source_signals"]))

    next_state = {
        **state,
        "final_report": final_report,
        "sentiment_report": sentiment_report,
    }
    return {
        **next_state,
        "cycle_trace": append_trace(
            next_state,
            "insight",
            "generated",
            report_length=len(final_report),
            source_signals=len(sentiment_report["source_signals"]),
            iteration=iteration,
            error=report_error,
            source_signal_errors=signal_errors or None,
        ),
    }
