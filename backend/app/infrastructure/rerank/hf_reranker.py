from __future__ import annotations

import math
from typing import Any

from app.core.config import settings
from app.infrastructure.graph.source_utils import clean_text, domain_from_url, is_official_domain, source_content, source_title, source_url

_reranker_cache: dict[str, tuple[Any, Any]] = {}
_reranker_unavailable: set[str] = set()


def rerank_sources(query: str, items: list[Any], *, top_k: int | None = None) -> list[dict[str, Any]]:
    ranked = []
    query = clean_text(query)
    for index, item in enumerate(items or [], start=1):
        score, model_name = rerank_source(query, item)
        url = source_url(item)
        ranked.append(
            {
                **(item if isinstance(item, dict) else {"content": clean_text(item)}),
                "source_index": index,
                "domain": domain_from_url(url),
                "official": is_official_domain(domain_from_url(url)),
                "rerank_score": round(score, 4),
                "reranker_model": model_name,
            }
        )

    ranked.sort(
        key=lambda item: (
            float(item.get("rerank_score") or 0.0),
            1 if item.get("official") else 0,
            1 if item.get("published_date") or item.get("published") or item.get("date") else 0,
        ),
        reverse=True,
    )
    limit = max(1, top_k or settings.RAG_RERANK_TOP_K)
    return ranked[:limit]


def rerank_source(query: str, item: Any) -> tuple[float, str]:
    if not settings.RAG_ENABLE_RERANKING:
        return heuristic_rerank_score(query, item), "heuristic-disabled"
    try:
        return hf_rerank_score(query, item), settings.RAG_RERANKER_MODEL
    except Exception:
        return heuristic_rerank_score(query, item), "heuristic-fallback"


def heuristic_rerank_score(query: str, item: Any) -> float:
    query_terms = {part.casefold() for part in clean_text(query).split() if len(part) > 2}
    haystack = " ".join(
        [
            source_title(item),
            source_content(item, 500),
            domain_from_url(source_url(item)),
        ]
    ).casefold()
    if not query_terms or not haystack:
        return 0.0

    overlap = sum(1 for term in query_terms if term in haystack)
    lexical = overlap / max(len(query_terms), 1)
    authority_bonus = 0.15 if is_official_domain(domain_from_url(source_url(item))) else 0.0
    dated_bonus = 0.05 if isinstance(item, dict) and (item.get("published_date") or item.get("published") or item.get("date")) else 0.0
    return min(1.0, lexical + authority_bonus + dated_bonus)


def hf_rerank_score(query: str, item: Any) -> float:
    tokenizer, model = _load_reranker()
    import torch

    passage = "\n".join(
        part for part in [source_title(item), source_content(item, 700)] if part
    )
    encoded = tokenizer(
        query,
        passage,
        return_tensors="pt",
        padding=True,
        truncation=True,
        max_length=512,
    )
    with torch.no_grad():
        logits = model(**encoded).logits
        values = logits.detach().cpu().view(-1).tolist()

    if not values:
        return 0.0
    if len(values) == 1:
        return 1.0 / (1.0 + math.exp(-float(values[0])))

    high = max(float(value) for value in values)
    exp_values = [math.exp(float(value) - high) for value in values]
    total = sum(exp_values) or 1.0
    probabilities = [value / total for value in exp_values]
    return float(probabilities[-1])


def _load_reranker() -> tuple[Any, Any]:
    model_name = settings.RAG_RERANKER_MODEL
    if model_name in _reranker_unavailable:
        raise RuntimeError(f"Reranker model unavailable: {model_name}")
    if model_name not in _reranker_cache:
        try:
            from transformers import AutoModelForSequenceClassification, AutoTokenizer

            tokenizer = AutoTokenizer.from_pretrained(model_name)
            model = AutoModelForSequenceClassification.from_pretrained(model_name)
            model.eval()
            _reranker_cache[model_name] = (tokenizer, model)
        except Exception:
            _reranker_unavailable.add(model_name)
            raise
    return _reranker_cache[model_name]
