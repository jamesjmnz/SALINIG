import logging

from app.infrastructure.graph.trace import append_trace

logger = logging.getLogger(__name__)


def finalize_node(state):
    best_report = state.get("best_report") or state.get("final_report") or ""
    best_sentiment_report = state.get("best_sentiment_report") or state.get("sentiment_report") or {}
    best_score = state.get("best_quality_score", state.get("quality_score", 0.0))
    logger.info("finalize — max iterations reached, promoting best_score=%.2f", best_score)
    next_state = {
        **state,
        "final_report": best_report,
        "sentiment_report": best_sentiment_report,
        "quality_score": best_score,
        "quality_breakdown": state.get("best_quality_breakdown") or state.get("quality_breakdown", {}),
        "quality_passed": False,
        "quality_feedback": state.get("best_quality_feedback") or state.get("quality_feedback", ""),
        "knowledge_gaps": state.get("best_knowledge_gaps") or state.get("knowledge_gaps", []),
        "blocking_issues": state.get("best_blocking_issues") or state.get("blocking_issues", []),
        "memory_saved": False,
    }
    return {
        **next_state,
        "cycle_trace": append_trace(
            next_state,
            "finalize",
            "max_iterations_reached",
            best_quality_score=best_score,
        ),
    }
