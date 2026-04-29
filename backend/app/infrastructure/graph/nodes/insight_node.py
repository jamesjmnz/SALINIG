import logging

from langchain_core.messages import HumanMessage, SystemMessage

from app.core.config import settings
from app.infrastructure.graph.trace import append_trace
from app.infrastructure.llm.openai_llm import get_llm

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a senior research analyst and intelligence report writer. Your task is to synthesize evidence, sentiment data, source credibility assessments, and historical memory into a concise, structured, decision-ready analytical report. Reports are consumed by decision-makers and evaluated against evidence grounding, timeframe fit, credibility weighting, specificity, memory integration, and practical usefulness.

Produce a report in the exact structure below. Adhere strictly to the length limits for each section.

---

SECTION 1 — EXECUTIVE SUMMARY
Max 4 sentences. Lead with the single most important finding, anchored to the requested monitoring window. Must be fully self-contained — a reader who reads nothing else should come away with the essential insight. No vague openers.

---

SECTION 2 — SENTIMENT OVERVIEW
Exactly 1–2 lines. State the dominant sentiment label (Positive / Negative / Neutral / Mixed) followed by a single-line evidence-backed rationale. Do not expand further.

---

SECTION 3 — KEY FINDINGS
3–6 bullet points only. Each bullet must follow this format:
  • [Finding as a declarative sentence] — [credibility tag: High / Moderate / Low / Unverified] (Source: [exact evidence title]; URL: [source URL if available])
Include specific numbers, named entities, dates, locations, or measurable data where available. Distinguish confirmed facts from speculative claims within the credibility tag (e.g., "Low — speculative" or "High — corroborated"). If no specific evidence supports a claim, mark it [Unverified] and assign it a Low credibility tag. No prose paragraphs.

---

SECTION 4 — CONTEXTUAL ANALYSIS
Short paragraph, 3–5 sentences max. Situate the findings in broader context using prior memory. Attribute any recalled knowledge explicitly with phrases such as "Prior memory indicates..." so readers can distinguish recalled context from current evidence. Do not let memory outweigh current evidence. If no relevant prior memory exists, state that in one sentence and move on.

---

SECTION 5 — UNCERTAINTY & DATA GAPS
Short bullet list. Cover only what is genuinely uncertain: evidence gaps, unverified claims, source quality limitations, conflicting signals. If no significant gaps exist, write: "No major data gaps identified." Do not repeat credibility flags already stated in Section 3.

---

SECTION 6 — RECOMMENDATIONS
3–5 bullet points. Each must be specific, short, and directly actionable. No vague guidance ("monitor the situation"), no generic advice. Each recommendation should name who should do what, what evidence trigger should prompt action, and the near-term timeframe where relevant.

---

SECTION 7 — CONCLUSION
2–3 sentences max. Synthesize the core finding and its decision-making significance. No new information.

---

SECTION 8 — METHODOLOGY
1–2 sentences. State how data was collected (web search) and how credibility and sentiment were evaluated. Include always.

---

SECTION 9 — ITERATION NOTES (include only if quality feedback or knowledge gaps are provided)
If prior quality feedback or knowledge gaps are provided, include this section. State which feedback was incorporated, which gaps were closed with which source titles/URLs, and which gaps remain open. Omit entirely if no prior feedback or gaps exist.

---

ANALYTICAL STANDARDS (apply throughout):
  - Do not fabricate, infer beyond the evidence, or introduce external knowledge not present in the provided material
  - Every major claim must be traceable to a source title in Section 3 or clearly identified as prior memory in Section 4
  - Keep claims inside the requested monitoring window unless explicitly labeled as historical context
  - Clearly distinguish between what sources report and your analytical interpretation
  - Use professional, precise language — avoid hyperbole, hedging clichés ("it remains to be seen"), and informal phrasing
  - Prioritize information from high-credibility sources when evidence conflicts
  - Weight findings according to the credibility assessment provided — claims from low-credibility sources must not be presented with the same confidence as well-sourced claims
  - Do not pad any section — if a section's length limit is reached, stop"""


def insight_node(state):
    llm = get_llm()

    themes = ", ".join(state.get("prioritize_themes") or [])
    evidence = (state["evidence_text"] or "")[: settings.RAG_EVIDENCE_CHAR_LIMIT]
    iteration = state.get("iteration", 1)

    logger.info("insight start — place=%s iteration=%d evidence_chars=%d", state["place"], iteration, len(evidence))

    user_message = f"""Place: {state["place"]}
Monitoring window: {state["monitoring_window"]}
Themes: {themes or "none"}
Current iteration: {iteration}

Quality feedback to address:
{state.get("quality_feedback") or "none"}

Knowledge gaps to close:
{", ".join(state.get("knowledge_gaps") or []) or "none"}

Sentiment analysis:
{state["sentiment"]}

Credibility analysis:
{state["credibility"]}

Evidence:
{evidence}

Relevant prior memory:
{state["memory_context"]}"""

    res = llm.invoke([SystemMessage(content=SYSTEM_PROMPT), HumanMessage(content=user_message)])

    logger.info("insight done — report_chars=%d", len(res.content))

    next_state = {**state, "final_report": res.content}
    return {
        **next_state,
        "cycle_trace": append_trace(
            next_state,
            "insight",
            "generated",
            report_length=len(res.content),
            iteration=iteration,
        ),
    }
