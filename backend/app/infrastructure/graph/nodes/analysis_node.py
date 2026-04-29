import logging
from concurrent.futures import ThreadPoolExecutor

from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel

from app.core.config import settings
from app.infrastructure.graph.nodes.sentiment_node import sentiment_node as _run_sentiment
from app.infrastructure.graph.nodes.credibility_node import credibility_node as _run_credibility
from app.infrastructure.graph.nodes.sentiment_ensemble import (
    SentimentEnsembleResult,
    SentimentScores,
    blend_sentiment_assessment,
    format_sentiment_brief,
)
from app.infrastructure.graph.trace import append_trace
from app.infrastructure.llm.openai_llm import get_llm

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a senior intelligence analyst. Assess the evidence once and return two concise briefs that downstream report generation can use directly.

Requirements:
- sentiment: 1 compact paragraph covering dominant tone, emotional signals, trajectory, and reliability of the sentiment signal.
- sentiment_scores: three numeric probabilities for negative, neutral, and positive sentiment. Scores must be between 0 and 1 and should sum to 1. For mixed evidence, split the probability across positive and negative rather than adding a "mixed" class.
- credibility: 1 compact paragraph covering source authority, corroboration, specificity, recency, bias/agenda risks, contradictions, and an overall High/Medium/Low/Mixed rating.
- Stay grounded in the supplied evidence only.
- Prefer specific source titles, dates, and named entities when available.
- Do not add markdown headings inside the fields."""


class EvidenceAssessment(BaseModel):
    sentiment: str
    sentiment_scores: SentimentScores
    credibility: str


def _combined_assessment(state):
    llm = get_llm()
    themes = ", ".join(state.get("prioritize_themes") or [])
    evidence = (state.get("evidence_text") or "")[: settings.RAG_EVIDENCE_CHAR_LIMIT]
    user_message = f"""Place: {state["place"]}
Monitoring window: {state["monitoring_window"]}
Themes: {themes or "none"}

Evidence:
{evidence}"""

    assessor = llm.with_structured_output(EvidenceAssessment)
    result = assessor.invoke([SystemMessage(content=SYSTEM_PROMPT), HumanMessage(content=user_message)])
    ensemble = blend_sentiment_assessment(evidence, result.sentiment_scores)
    return {
        "sentiment": format_sentiment_brief(
            ensemble,
            result.sentiment,
        )[: settings.RAG_AUX_ANALYSIS_CHAR_LIMIT],
        "credibility": result.credibility[: settings.RAG_AUX_ANALYSIS_CHAR_LIMIT],
        "sentiment_details": ensemble,
    }


def _sentiment_state(ensemble: SentimentEnsembleResult | None):
    if not ensemble:
        return {}
    return {
        "sentiment_label": ensemble.label,
        "sentiment_scores": ensemble.blended_scores,
        "sentiment_roberta_scores": ensemble.roberta_scores or {},
        "sentiment_llm_scores": ensemble.llm_scores,
        "sentiment_roberta_error": ensemble.roberta_error,
    }


def _sentiment_trace(ensemble: SentimentEnsembleResult | None):
    if not ensemble:
        return {}
    return ensemble.as_trace_details()


def analysis_node(state):
    logger.info("analysis start — running combined sentiment + credibility assessment")

    try:
        assessment = _combined_assessment(state)
        sentiment = assessment["sentiment"]
        credibility = assessment["credibility"]
        sentiment_details = assessment["sentiment_details"]
        mode = "combined"
        error = None
    except Exception as exc:
        logger.warning("combined analysis failed; falling back to parallel nodes: %s", exc)
        with ThreadPoolExecutor(max_workers=2) as executor:
            f_sentiment = executor.submit(_run_sentiment, state)
            f_credibility = executor.submit(_run_credibility, state)

        sentiment_result = f_sentiment.result()
        sentiment = sentiment_result["sentiment"][: settings.RAG_AUX_ANALYSIS_CHAR_LIMIT]
        sentiment_details = sentiment_result.get("sentiment_details")
        credibility = f_credibility.result()["credibility"][: settings.RAG_AUX_ANALYSIS_CHAR_LIMIT]
        mode = "parallel_fallback"
        error = str(exc)

    logger.info("analysis done — sentiment_chars=%d credibility_chars=%d", len(sentiment), len(credibility))

    next_state = {
        **state,
        "sentiment": sentiment,
        "credibility": credibility,
        **_sentiment_state(sentiment_details),
    }
    return {
        **next_state,
        "cycle_trace": append_trace(
            next_state,
            "analysis",
            "completed",
            sentiment_length=len(sentiment),
            credibility_length=len(credibility),
            mode=mode,
            error=error,
            **_sentiment_trace(sentiment_details),
        ),
    }
