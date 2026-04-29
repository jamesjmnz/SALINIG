import logging

from app.infrastructure.graph.trace import append_trace

logger = logging.getLogger(__name__)


def complete_node(state):
    logger.info("complete — returning passed report without synchronous learning save")
    next_state = {
        **state,
        "memory_saved": False,
        "memory_duplicate": False,
        "memory_save_error": None,
    }
    return {
        **next_state,
        "cycle_trace": append_trace(
            next_state,
            "complete",
            "sync_learning_disabled",
        ),
    }
