import logging
from datetime import datetime, timezone

from app.infrastructure.graph.trace import append_trace
from app.infrastructure.memory.qdrant_memory import save_learning

logger = logging.getLogger(__name__)


def save_node(state):
    logger.info("save start — quality_passed=%s", state.get("quality_passed"))
    if not state.get("quality_passed"):
        next_state = {**state, "memory_saved": False}
        return {
            **next_state,
            "cycle_trace": append_trace(next_state, "save", "skipped_quality_gate"),
        }

    note = (state.get("learning_note") or "").strip()
    if not note:
        next_state = {
            **state,
            "memory_saved": False,
            "memory_save_error": "learning note was empty",
        }
        return {
            **next_state,
            "cycle_trace": append_trace(next_state, "save", "skipped_empty_note"),
        }

    metadata = {
        "place": state["place"],
        "monitoring_window": state["monitoring_window"],
        "prioritize_themes": state.get("prioritize_themes") or [],
        "quality_score": state.get("quality_score", 0.0),
        "source_urls": state.get("source_urls") or [],
        "citations": state.get("learning_citations") or [],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    try:
        result = save_learning(note, metadata)
        saved = bool(result.get("saved"))
        duplicate = bool(result.get("duplicate"))
        error = result.get("error")
    except Exception as exc:
        saved = False
        duplicate = False
        error = str(exc)

    logger.info("save done — saved=%s duplicate=%s error=%s", saved, duplicate, error)

    next_state = {
        **state,
        "memory_saved": saved,
        "memory_duplicate": duplicate,
        "memory_save_error": error,
    }
    return {
        **next_state,
        "cycle_trace": append_trace(
            next_state,
            "save",
            "saved" if saved else "not_saved",
            duplicate=duplicate,
            error=error,
        ),
    }
