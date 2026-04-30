import logging

from pydantic import BaseModel
from langchain_core.messages import HumanMessage, SystemMessage

from app.core.config import settings
from app.infrastructure.llm.openai_llm import get_llm
from app.infrastructure.graph.trace import append_trace

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a Philippines-first local intelligence monitoring assistant. Your job is to generate precise, Tavily-optimized web search queries for a given Philippine place, monitoring window, fixed public-intelligence categories, and optional focus terms.

Rules:
- Generate exactly the requested number of search queries.
- Each query must be a short, specific phrase (under 15 words) that Tavily can use directly.
- Include the place name and a time cue (e.g. "past 24 hours", "today", "this week") in every query.
- Do not repeat the same query twice.
- When retry context is absent, vary query angles across official updates, local news, programs/projects, incidents/advisories, community initiatives, and government actions.
- Use focus terms as subthemes inside the selected categories, not as independent global scope changes.
- If retry context is provided, target the listed knowledge gaps directly. Do not repeat broad generic theme queries unless no gap is provided.
- Output only the list of query strings — no explanations, no numbering."""


class SearchQueries(BaseModel):
    queries: list[str]


def _query_targets(themes, gaps, focus_terms=None):
    gap_targets = [gap.strip() for gap in gaps if gap and gap.strip()]
    if gap_targets:
        return gap_targets, "knowledge_gaps"
    theme_targets = [theme.strip() for theme in themes if theme and theme.strip()]
    focus_targets = [term.strip() for term in focus_terms or [] if term and term.strip()]
    if focus_targets:
        return focus_targets, "focus_terms"
    return theme_targets or ["local developments"], "themes"


def _fallback_queries(place, monitoring_window, targets, per_target):
    variants = [
        "{place} {target} official updates {window}",
        "{place} {target} local news {window}",
        "{place} {target} programs projects {window}",
        "{place} {target} incidents advisories {window}",
        "{place} {target} community initiatives {window}",
        "{place} {target} government actions {window}",
        "{place} {target} latest verified reports {window}",
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
    focus_terms = state.get("focus_terms") or []
    iteration = state.get("iteration", 0)
    runtime_options = state.get("runtime_options") or {}
    per_target = max(1, int(runtime_options.get("queries_per_theme", settings.RAG_QUERIES_PER_THEME)))
    targets, target_source = _query_targets(themes, state.get("knowledge_gaps") or [], focus_terms)
    target_count = min(
        max(1, len(targets) * per_target),
        max(1, int(runtime_options.get("max_search_queries", settings.RAG_MAX_SEARCH_QUERIES))),
    )

    logger.info("query_gen start — place=%s themes=%s iteration=%d", place, themes, iteration)

    user_lines = [
        f"Place: {place}",
        f"Monitoring window: {monitoring_window}",
        f"Categories: {', '.join(themes)}",
        f"Focus terms: {', '.join(focus_terms) or 'none'}",
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
            focus_terms=focus_terms,
            place=place,
            target_source=target_source,
            target_count=target_count,
            error=error,
        ),
    }
