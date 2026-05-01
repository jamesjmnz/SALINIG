import logging

from app.core.config import settings
from app.infrastructure.graph.source_utils import domain_from_url, is_official_domain
from app.infrastructure.graph.trace import append_trace

logger = logging.getLogger(__name__)


def evidence_gate_node(state):
    ranked_sources = list(state.get("ranked_sources") or state.get("collected_data") or [])
    source_count = len(ranked_sources)
    domains = {
        domain_from_url(item.get("url") or item.get("link") or item.get("source"))
        for item in ranked_sources
        if isinstance(item, dict)
    }
    domains.discard("")
    official_count = sum(
        1
        for item in ranked_sources
        if isinstance(item, dict)
        and is_official_domain(domain_from_url(item.get("url") or item.get("link") or item.get("source")))
    )

    reasons = []
    if source_count < settings.RAG_MIN_SOURCES_REQUIRED:
        reasons.append(
            f"Only {source_count} source(s) collected; need at least {settings.RAG_MIN_SOURCES_REQUIRED}."
        )
    if len(domains) < settings.RAG_MIN_UNIQUE_DOMAINS_REQUIRED:
        reasons.append(
            f"Only {len(domains)} unique domain(s) collected; need at least {settings.RAG_MIN_UNIQUE_DOMAINS_REQUIRED}."
        )
    if official_count < settings.RAG_MIN_OFFICIAL_SOURCES_REQUIRED:
        reasons.append(
            f"Only {official_count} official source(s) collected; need at least {settings.RAG_MIN_OFFICIAL_SOURCES_REQUIRED}."
        )

    passed = not reasons or not settings.RAG_ENABLE_EVIDENCE_SUFFICIENCY_GATE
    evidence_sufficiency = {
        "checked": True,
        "passed": passed,
        "source_count": source_count,
        "unique_domain_count": len(domains),
        "official_source_count": official_count,
        "reasons": [] if passed else reasons,
        "ranked_sources": ranked_sources,
    }

    logger.info(
        "evidence gate — passed=%s sources=%d domains=%d official=%d",
        passed,
        source_count,
        len(domains),
        official_count,
    )
    next_state = {
        **state,
        "evidence_sufficiency": evidence_sufficiency,
        "analysis_status": "completed" if passed else "insufficient_evidence",
    }
    return {
        **next_state,
        "cycle_trace": append_trace(
            next_state,
            "evidence_gate",
            "checked",
            passed=passed,
            source_count=source_count,
            unique_domain_count=len(domains),
            official_source_count=official_count,
            reasons=reasons or None,
        ),
    }
