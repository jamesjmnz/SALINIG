import logging

from pydantic import BaseModel
from langchain_core.messages import HumanMessage, SystemMessage

from app.core.config import settings
from app.infrastructure.llm.openai_llm import get_llm
from app.infrastructure.graph.trace import append_trace

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a local intelligence monitoring assistant. Your job is to generate precise, Tavily-optimized web search queries for a given place, monitoring window, and list of themes.

Rules:
- Generate exactly the requested number of search queries.
- Each query must be a short, specific phrase (under 15 words) that Tavily can use directly.
- Include the place name and a time cue (e.g. "past 24 hours", "today", "this week") in every query.
- Do not repeat the same query twice.
- If retry context is provided, target the listed knowledge gaps directly. Do not repeat broad generic theme queries unless no gap is provided.
- Output only the list of query strings — no explanations, no numbering."""


class SearchQueries(BaseModel):
    queries: list[str]


def _query_targets(themes, gaps):
    gap_targets = [gap.strip() for gap in gaps if gap and gap.strip()]
    if gap_targets:
        return gap_targets, "knowledge_gaps"
    theme_targets = [theme.strip() for theme in themes if theme and theme.strip()]
    return theme_targets or ["local developments"], "themes"


def _fallback_queries(place, monitoring_window, targets, per_target):
    variants = [
        "{place} {target} {window}",
        "{place} {target} latest verified reports {window}",
        "{place} {target} official updates {window}",
        "{place} {target} local news {window}",
    ]
    queries = []
    for target in targets:
        for template in variants[:per_target]:
            queries.append(template.format(place=place, target=target, window=monitoring_window))
    return queries


def _normalise_queries(raw_queries, fallback_queries, target_count):
    queries = []
    seen = set()
    for query in list(raw_queries or []) + fallback_queries:
        cleaned = " ".join(str(query).split())
        if not cleaned:
            continue
        key = cleaned.lower()
        if key in seen:
            continue
        seen.add(key)
        queries.append(cleaned)
        if len(queries) >= target_count:
            break
    return queries


def query_gen_node(state):
    place = state["place"]
    monitoring_window = state["monitoring_window"]
    themes = state["prioritize_themes"]
    iteration = state.get("iteration", 0)
    per_target = max(1, settings.RAG_QUERIES_PER_THEME)
    targets, target_source = _query_targets(themes, state.get("knowledge_gaps") or [])
    target_count = max(1, len(targets) * per_target)

    logger.info("query_gen start — place=%s themes=%s iteration=%d", place, themes, iteration)

    user_lines = [
        f"Place: {place}",
        f"Monitoring window: {monitoring_window}",
        f"Themes: {', '.join(themes)}",
        f"Query targets ({target_source}): {'; '.join(targets)}",
        f"Required query count: {target_count}",
        f"Queries per target: {per_target}",
    ]

    if iteration > 0:
        if state.get("quality_feedback"):
            user_lines.append(f"\nQuality feedback to address: {state['quality_feedback']}")
        if state.get("knowledge_gaps"):
            user_lines.append("Knowledge gaps to close: " + "; ".join(state["knowledge_gaps"]))

    fallback = _fallback_queries(place, monitoring_window, targets, per_target)
    error = None

    if settings.RAG_USE_LLM_QUERY_GEN:
        llm = get_llm()
        try:
            generator = llm.with_structured_output(SearchQueries)
            result = generator.invoke([
                SystemMessage(content=SYSTEM_PROMPT),
                HumanMessage(content="\n".join(user_lines)),
            ])
            queries = _normalise_queries(result.queries, fallback, target_count)
        except Exception as exc:
            queries = fallback[:target_count]
            error = str(exc)
    else:
        queries = fallback[:target_count]

    logger.info("query_gen done — queries=%s", queries)

    return {
        **state,
        "search_queries": queries,
        "cycle_trace": append_trace(
            state,
            "query_gen",
            "queries_generated",
            queries=queries,
            themes=themes,
            place=place,
            target_source=target_source,
            target_count=target_count,
            error=error,
        ),
    }
