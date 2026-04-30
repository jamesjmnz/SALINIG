import logging

from langchain_core.messages import HumanMessage, SystemMessage

from app.core.config import settings
from app.infrastructure.graph.nodes.sentiment_ensemble import (
    SentimentOnlyAssessment,
    blend_sentiment_assessment,
    format_sentiment_brief,
)
from app.infrastructure.llm.openai_llm import get_llm

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a senior media intelligence analyst specializing in public discourse analysis, narrative monitoring, and sentiment intelligence. Your task is to perform a rigorous, multi-dimensional sentiment analysis of a collection of evidence gathered from web sources about a specific topic.

Your analysis must go beyond simple positive/negative/neutral classification. You are expected to produce a structured, professional assessment covering the following dimensions:

1. DOMINANT SENTIMENT TONE
   Identify the overall sentiment of the evidence pool as a whole (positive, negative, neutral, or mixed). Provide a clear, evidence-backed rationale for your classification. Do not simply assert a label — explain what in the evidence drives it.

2. EMOTIONAL UNDERCURRENTS
   Identify specific emotional registers present in the evidence (e.g., fear, optimism, urgency, frustration, skepticism, hope, outrage, relief). Indicate how prominently each emotion appears and which segments of the evidence carry it.

3. SENTIMENT DISTRIBUTION
   Assess whether sentiment is consistent across the evidence pool or sharply divided. If divided, describe the distinct camps or perspectives and the approximate weight of each. Note whether any single source dominates the overall tone.

4. SENTIMENT TRAJECTORY
   Based on language cues, framing, and any temporal markers in the evidence, determine whether the emotional tenor appears to be escalating, de-escalating, or holding steady. Flag any indications of rapid sentiment shifts.

5. ANOMALIES AND DIVERGENT SOURCES
   Identify any sources or passages whose tone is notably divergent from the majority. Describe the nature of the divergence and hypothesize why it exists — is it a different audience, a different vantage point, or potentially an outlier with an agenda?

6. RELIABILITY OF SENTIMENT SIGNALS
   Assess whether the detected sentiment is driven by verifiable, event-based developments or appears to be reactive, speculative, rumor-driven, or agenda-led. Distinguish between organic public sentiment and manufactured or amplified sentiment where possible.

OUTPUT FORMAT:
Return a sentiment field with the structured analysis and a sentiment_scores field with numeric negative, neutral, and positive probabilities. The probabilities must be between 0 and 1 and should sum to 1. For mixed evidence, split the probability across positive and negative rather than adding a mixed class. Use precise, analytical language. Avoid editorializing or injecting your own opinion. Your output feeds directly into a multi-step RAG analysis pipeline — clarity, structure, and accuracy are essential. Do not summarize with a single-word verdict; provide the reasoning that justifies every conclusion."""


def sentiment_node(state):
    llm = get_llm()

    themes = ", ".join(state.get("prioritize_themes") or [])
    focus_terms = ", ".join(state.get("focus_terms") or [])
    runtime_options = state.get("runtime_options") or {}
    evidence_char_limit = int(runtime_options.get("evidence_char_limit", settings.RAG_EVIDENCE_CHAR_LIMIT))
    evidence = (state["evidence_text"] or "")[:evidence_char_limit]

    logger.info("sentiment start — place=%s evidence_chars=%d", state["place"], len(evidence))

    user_message = f"""Place: {state["place"]}
Categories: {themes or "none"}
Focus terms: {focus_terms or "none"}

Evidence:
{evidence}"""

    assessor = llm.with_structured_output(SentimentOnlyAssessment)
    result = assessor.invoke([SystemMessage(content=SYSTEM_PROMPT), HumanMessage(content=user_message)])
    ensemble = blend_sentiment_assessment(
        evidence,
        result.sentiment_scores,
        enable_roberta=runtime_options.get("enable_roberta", settings.RAG_ENABLE_ROBERTA),
    )
    sentiment = format_sentiment_brief(
        ensemble,
        result.sentiment,
    )[: settings.RAG_AUX_ANALYSIS_CHAR_LIMIT]

    logger.info("sentiment done — output_chars=%d", len(sentiment))

    return {
        **state,
        "sentiment": sentiment,
        "sentiment_details": ensemble,
        "sentiment_label": ensemble.label,
        "sentiment_scores": ensemble.blended_scores,
        "sentiment_roberta_scores": ensemble.roberta_scores or {},
        "sentiment_llm_scores": ensemble.llm_scores,
        "sentiment_roberta_error": ensemble.roberta_error,
    }
