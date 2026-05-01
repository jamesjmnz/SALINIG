import logging

from app.core.config import settings
from app.infrastructure.graph.source_utils import clean_text, source_content, source_title
from app.infrastructure.graph.trace import append_trace
from app.infrastructure.verification.hf_nli import classify_claim_support

logger = logging.getLogger(__name__)


def _catalog_by_index(state):
    catalog = {}
    for index, item in enumerate(state.get("collected_data") or [], start=1):
        if isinstance(item, dict):
            source_index = int(item.get("source_index") or index)
            catalog[source_index] = item
    return catalog


def _support_status(labels: list[str]) -> str:
    if not labels:
        return "unsupported"
    supported = labels.count("supported")
    contradicted = labels.count("contradicted")
    mixed = labels.count("mixed")
    if contradicted and contradicted >= supported:
        return "contradicted"
    if supported and contradicted:
        return "mixed"
    if supported:
        return "supported"
    if mixed:
        return "mixed"
    return "unsupported"


def _claims_from_state(state):
    claims = []
    report = state.get("sentiment_report") or {}
    overview = clean_text(report.get("overview"))
    source_signals = list(report.get("source_signals") or [])

    if overview:
        source_indexes = [
            int(source.get("source_index"))
            for source in source_signals[:2]
            if isinstance(source, dict) and source.get("source_index")
        ]
        claims.append(
            {
                "claim_id": "overview-1",
                "text": overview,
                "claim_type": "overview",
                "source_indexes": source_indexes,
            }
        )

    for index, signal in enumerate(source_signals[: settings.RAG_MAX_CLAIMS_TO_VERIFY], start=1):
        text = clean_text(signal.get("summary"))
        source_index = int(signal.get("source_index") or 0)
        if not text or source_index <= 0:
            continue
        claims.append(
            {
                "claim_id": f"signal-{index}",
                "text": text,
                "claim_type": "signal",
                "source_indexes": [source_index],
            }
        )

    return claims[: settings.RAG_MAX_CLAIMS_TO_VERIFY]


def claim_verification_node(state):
    claims = _claims_from_state(state)
    catalog = _catalog_by_index(state)
    contradictions = []
    verified_claim_count = 0
    contradicted_claim_count = 0
    unsupported_claim_count = 0

    verified_claims = []
    for claim in claims:
        source_indexes = list(claim.get("source_indexes") or [])[: settings.RAG_MAX_SOURCES_PER_CLAIM]
        evidence_links = []
        labels = []

        for source_index in source_indexes:
            source = catalog.get(source_index)
            if not source:
                continue
            result = classify_claim_support(
                source_content(source, 700),
                claim["text"],
            )
            label = result["label"]
            labels.append(label)
            evidence_links.append(
                {
                    "source_index": source_index,
                    "title": source_title(source),
                    "url": source.get("url") or source.get("link") or source.get("source"),
                    "domain": source.get("domain") or "",
                    "support_label": label,
                    "support_score": result["confidence"],
                    "rationale": f"Claim checked with {result['model']}.",
                }
            )
            if label == "contradicted":
                contradictions.append(
                    {
                        "claim_id": claim["claim_id"],
                        "claim_text": claim["text"],
                        "source_index": source_index,
                        "source_title": source_title(source),
                        "url": source.get("url") or source.get("link") or source.get("source"),
                        "label": label,
                        "confidence": result["confidence"],
                        "rationale": f"Source appears to contradict the mapped claim according to {result['model']}.",
                    }
                )

        support_status = _support_status(labels)
        if support_status == "supported":
            verified_claim_count += 1
        elif support_status == "contradicted":
            contradicted_claim_count += 1
        else:
            unsupported_claim_count += 1

        verified_claims.append(
            {
                **claim,
                "support_status": support_status,
                "evidence_links": evidence_links,
            }
        )

    summary = {
        "checked": True,
        "verified_claim_count": verified_claim_count,
        "contradicted_claim_count": contradicted_claim_count,
        "unsupported_claim_count": unsupported_claim_count,
        "model": settings.RAG_NLI_MODEL if settings.RAG_ENABLE_NLI_VERIFICATION else "heuristic-disabled",
        "claims": verified_claims,
        "contradictions": contradictions,
    }
    logger.info(
        "claim verification — claims=%d verified=%d contradicted=%d",
        len(verified_claims),
        verified_claim_count,
        contradicted_claim_count,
    )
    next_state = {**state, "claim_verification": summary}
    return {
        **next_state,
        "cycle_trace": append_trace(
            next_state,
            "claim_verification",
            "checked",
            claims=len(verified_claims),
            contradicted_claims=contradicted_claim_count,
            unsupported_claims=unsupported_claim_count,
        ),
    }
