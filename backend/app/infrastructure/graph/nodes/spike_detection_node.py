import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from app.core.config import settings
from app.infrastructure.graph.trace import append_trace

logger = logging.getLogger(__name__)


def _embed_query(query: str) -> list[float]:
    from langchain_openai import OpenAIEmbeddings
    embeddings = OpenAIEmbeddings(
        api_key=settings.OPENAI_API_KEY,
        model=settings.OPENAI_EMBEDDING_MODEL,
        dimensions=settings.OPENAI_EMBEDDING_DIMENSIONS,
        timeout=settings.EXTERNAL_REQUEST_TIMEOUT_SECONDS,
        max_retries=settings.EXTERNAL_MAX_RETRIES,
    )
    return embeddings.embed_query(query)


def _search_history(query_vector: list[float], k: int) -> list[Any]:
    from app.infrastructure.memory.qdrant_memory import _get_client
    return _get_client().search(
        collection_name=settings.QDRANT_COLLECTION,
        query_vector=query_vector,
        limit=k,
        with_vectors=True,
        with_payload=True,
    )


def _nli_classify(premise: str, hypothesis: str) -> dict[str, Any]:
    from app.infrastructure.verification.hf_nli import classify_claim_support
    return classify_claim_support(premise, hypothesis)


def _density_score(points: list[Any]) -> tuple[float, str]:
    if not points:
        return 0.0, "No historical notes found."
    scores = [max(0.0, min(1.0, float(p.score))) for p in points]
    density = sum(scores) / len(scores)
    return density, f"Mean similarity {density:.3f} across {len(scores)} notes."


def _velocity_score(points: list[Any], recency_days: int) -> tuple[float, bool, str]:
    try:
        import numpy as np
        from sklearn.metrics.pairwise import cosine_similarity

        now = datetime.now(timezone.utc)
        cutoff = now - timedelta(days=recency_days)

        recent_vecs: list[Any] = []
        older_vecs: list[Any] = []
        for p in points:
            vec = p.vector
            if not vec:
                continue
            payload = p.payload or {}
            created_str = payload.get("created_at")
            try:
                created = datetime.fromisoformat(created_str) if created_str else None
            except (TypeError, ValueError):
                created = None
            if created and created.tzinfo is None:
                created = created.replace(tzinfo=timezone.utc)
            target = recent_vecs if (created and created > cutoff) else older_vecs
            target.append(np.array(vec, dtype=np.float32))

        if len(recent_vecs) < 2 or len(older_vecs) < 2:
            return 0.0, False, f"Insufficient temporal split ({len(recent_vecs)} recent, {len(older_vecs)} older)."

        recent_c = np.mean(np.stack(recent_vecs), axis=0, keepdims=True)
        older_c = np.mean(np.stack(older_vecs), axis=0, keepdims=True)
        sim = float(cosine_similarity(recent_c, older_c)[0][0])
        velocity = max(0.0, min(1.0, 1.0 - sim))
        note = (
            f"Centroid drift {velocity:.3f} "
            f"({len(recent_vecs)} recent vs {len(older_vecs)} older notes)."
        )
        return velocity, True, note
    except Exception as exc:
        return 0.0, False, f"Velocity unavailable: {exc}"


def _nli_coherence(query: str, points: list[Any], max_notes: int) -> tuple[float, str]:
    if not points:
        return 0.5, "No notes for NLI check; neutral assumed."
    entailments: list[float] = []
    for p in points[:max_notes]:
        payload = p.payload or {}
        content = payload.get("page_content") or payload.get("content") or ""
        if not content:
            continue
        premise = " ".join(str(content).split())[:400]
        result = _nli_classify(premise, query)
        label = result.get("label", "")
        conf = float(result.get("confidence", 0.0))
        if label == "supported":
            entailments.append(conf)
        elif label == "mixed":
            entailments.append(conf * 0.5)
    if not entailments:
        return 0.5, "NLI produced no entailment scores; neutral assumed."
    coherence = max(0.0, min(1.0, sum(entailments) / len(entailments)))
    return coherence, f"Mean NLI entailment {coherence:.3f} across {len(entailments)} notes."


def _count_recent(points: list[Any], days: int) -> int:
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=days)
    count = 0
    for p in points:
        payload = p.payload or {}
        created_str = payload.get("created_at")
        try:
            created = datetime.fromisoformat(created_str) if created_str else None
            if created:
                if created.tzinfo is None:
                    created = created.replace(tzinfo=timezone.utc)
                if created > cutoff:
                    count += 1
        except (TypeError, ValueError):
            pass
    return count


def _classify_level(spike_score: float) -> str:
    if spike_score >= settings.RAG_SPIKE_ACTIVE_THRESHOLD:
        return "ACTIVE_SPIKE"
    if spike_score >= settings.RAG_SPIKE_RISING_THRESHOLD:
        return "RISING_SIGNAL"
    return "BASELINE"


def spike_detection_node(state: dict[str, Any]) -> dict[str, Any]:
    if not settings.RAG_ENABLE_SPIKE_DETECTION:
        result: dict[str, Any] = {
            "detected": False, "spike_level": "BASELINE", "spike_score": 0.0,
            "signals": [], "history_count": 0, "recent_note_count": 0,
            "velocity_available": False, "error": None,
        }
        next_state = {
            **state,
            "spike_detection": result, "spike_score": 0.0, "spike_level": "BASELINE",
            "spike_signals": [], "spike_history_count": 0, "spike_detection_error": None,
        }
        return {
            **next_state,
            "cycle_trace": append_trace(next_state, "spike_detection", "disabled"),
        }

    place = state.get("place", "")
    themes = " ".join(state.get("prioritize_themes") or [])
    focus_terms = " ".join(state.get("focus_terms") or [])
    query = " ".join(p for p in [place, themes, focus_terms] if p)

    logger.info("spike_detection start — place=%s", place)

    error: str | None = None
    result = {
        "detected": False, "spike_level": "BASELINE", "spike_score": 0.0,
        "signals": [], "history_count": 0, "recent_note_count": 0,
        "velocity_available": False, "error": None,
    }

    try:
        k = settings.RAG_SPIKE_HISTORY_K
        recency_days = settings.RAG_SPIKE_RECENCY_DAYS

        query_vector = _embed_query(query)
        points = _search_history(query_vector, k)

        history_count = len(points)
        recent_count = _count_recent(points, recency_days)

        density, density_note = _density_score(points)
        velocity, velocity_available, velocity_note = _velocity_score(points, recency_days)
        coherence, coherence_note = _nli_coherence(query, points, settings.RAG_SPIKE_NLI_MAX_NOTES)

        if velocity_available:
            w_d, w_v, w_n = 0.50, 0.25, 0.25
        else:
            w_d, w_v, w_n = 0.70, 0.00, 0.30

        spike_score = max(0.0, min(1.0,
            w_d * density + w_v * velocity + w_n * (1.0 - coherence)
        ))
        spike_level = _classify_level(spike_score)

        result = {
            "detected": spike_level != "BASELINE",
            "spike_level": spike_level,
            "spike_score": round(spike_score, 4),
            "signals": [
                {"signal_type": "density", "score": round(density, 4),
                 "weight": w_d, "note": density_note},
                {"signal_type": "velocity", "score": round(velocity, 4),
                 "weight": w_v, "note": velocity_note},
                {"signal_type": "nli_coherence", "score": round(coherence, 4),
                 "weight": w_n, "note": coherence_note},
            ],
            "history_count": history_count,
            "recent_note_count": recent_count,
            "velocity_available": velocity_available,
            "error": None,
        }
        logger.info(
            "spike_detection done — level=%s score=%.3f history=%d",
            spike_level, spike_score, history_count,
        )
    except Exception as exc:
        error = str(exc)
        result["error"] = error
        logger.warning("spike_detection failed: %s", exc)

    next_state = {
        **state,
        "spike_detection": result,
        "spike_score": result["spike_score"],
        "spike_level": result["spike_level"],
        "spike_signals": result["signals"],
        "spike_history_count": result["history_count"],
        "spike_detection_error": error,
    }
    return {
        **next_state,
        "cycle_trace": append_trace(
            next_state, "spike_detection",
            "failed" if error else "completed",
            spike_level=result["spike_level"],
            spike_score=result["spike_score"],
            history_count=result["history_count"],
            velocity_available=result["velocity_available"],
            error=error,
        ),
    }
