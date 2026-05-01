import logging
from concurrent.futures import ThreadPoolExecutor, as_completed

from app.core.config import settings
from app.infrastructure.graph.trace import append_trace
from app.infrastructure.graph.source_utils import clean_text, source_url
from app.infrastructure.rerank.hf_reranker import rerank_sources
from app.infrastructure.search.tavily_search import search

logger = logging.getLogger(__name__)


def _normalise_results(data):
    if not data:
        return []
    if isinstance(data, dict):
        results = data.get("results")
        if isinstance(results, list):
            return results
        return [data]
    if isinstance(data, list):
        return data
    return [data]


def _get_url(item):
    return source_url(item)


def _clean_text(value):
    return clean_text(value)


def _truncate(value, max_chars):
    text = _clean_text(value)
    if max_chars <= 0 or len(text) <= max_chars:
        return text
    return text[: max_chars - 3].rstrip() + "..."


def _dedupe_sources(items):
    seen = set()
    deduped = []
    for item in items:
        url = _get_url(item)
        key = url or str(item)
        if key in seen:
            continue
        seen.add(key)
        deduped.append(item)
    return deduped


def _format_source(item, max_chars):
    if not isinstance(item, dict):
        return _truncate(item, max_chars)

    title = item.get("title") or item.get("name") or "Untitled source"
    url = item.get("url") or item.get("link") or ""
    published = item.get("published_date") or item.get("published") or item.get("date") or ""
    score = item.get("score") or item.get("relevance_score") or ""
    snippet = item.get("content") or item.get("snippet") or ""
    raw_content = item.get("raw_content") or ""
    content = raw_content or snippet

    parts = [f"Title: {title}"]
    if url:
        parts.append(f"URL: {url}")
    if published:
        parts.append(f"Published: {published}")
    if score:
        parts.append(f"Search score: {score}")
    if content:
        parts.append(f"Content: {_truncate(content, max_chars)}")
    elif snippet:
        parts.append(f"Snippet: {_truncate(snippet, max_chars)}")
    return "\n".join(parts)


def _search_one(query, monitoring_window, runtime_options):
    try:
        data = search(
            query,
            monitoring_window=monitoring_window,
            max_results=runtime_options.get("search_max_results"),
            include_raw_content=runtime_options.get("include_raw_content"),
            search_depth=runtime_options.get("search_depth"),
        )
        return _normalise_results(data), None
    except Exception as exc:
        return [], str(exc)


def collect_node(state):
    iteration = state.get("iteration", 0) + 1
    working_state = {**state, "iteration": iteration}

    queries = state.get("search_queries") or []
    runtime_options = state.get("runtime_options") or {}
    evidence_char_limit = int(runtime_options.get("evidence_char_limit", settings.RAG_EVIDENCE_CHAR_LIMIT))
    source_char_limit = int(runtime_options.get("source_char_limit", settings.RAG_SOURCE_CHAR_LIMIT))
    logger.info("collect start — iteration=%d queries=%d", iteration, len(queries))
    errors = []
    new_items = []

    max_workers = max(1, min(len(queries) or 1, settings.RAG_SEARCH_MAX_WORKERS))
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_query = {
            executor.submit(_search_one, q, state.get("monitoring_window"), runtime_options): q
            for q in queries
        }
        for future in as_completed(future_to_query):
            items, err = future.result()
            new_items.extend(items)
            if err:
                errors.append(err)

    all_items = _dedupe_sources(list(state.get("collected_data") or []) + new_items)
    logger.info("collect done — new_sources=%d total_sources=%d errors=%d", len(new_items), len(all_items), len(errors))
    query_context = " ".join(
        [
            state.get("place") or "",
            " ".join(state.get("prioritize_themes") or []),
            " ".join(state.get("focus_terms") or []),
            " ".join(state.get("knowledge_gaps") or []),
        ]
    )
    ranked_sources = rerank_sources(
        query_context,
        all_items,
        top_k=int(runtime_options.get("rerank_top_k", settings.RAG_RERANK_TOP_K)),
    )
    ranked_items = list(ranked_sources)
    text = _truncate(
        "\n\n".join([_format_source(item, source_char_limit) for item in ranked_items]),
        evidence_char_limit,
    )
    source_urls = [url for url in [_get_url(item) for item in ranked_items] if url]

    return {
        **working_state,
        "collected_data": ranked_items,
        "ranked_sources": ranked_items,
        "evidence_text": text,
        "source_urls": source_urls,
        "cycle_trace": append_trace(
            working_state,
            "collect",
            "searched",
            queries=queries,
            new_sources=len(new_items),
            total_sources=len(ranked_items),
            evidence_chars=len(text),
            reranked_sources=len(ranked_items),
            errors=errors or None,
        ),
    }
