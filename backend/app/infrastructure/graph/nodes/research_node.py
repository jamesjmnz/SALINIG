import logging
from concurrent.futures import ThreadPoolExecutor

from app.infrastructure.graph.nodes.collect_node import collect_node
from app.infrastructure.graph.nodes.memory_node import memory_node

logger = logging.getLogger(__name__)


def _trace_delta(before, after):
    before_len = len(before.get("cycle_trace") or [])
    return (after.get("cycle_trace") or [])[before_len:]


def research_node(state):
    logger.info("research start — running web collection + memory retrieval in parallel")

    with ThreadPoolExecutor(max_workers=2) as executor:
        f_collect = executor.submit(collect_node, state)
        f_memory = executor.submit(memory_node, state)

        collect_result = f_collect.result()
        memory_result = f_memory.result()

    cycle_trace = (
        list(state.get("cycle_trace") or [])
        + _trace_delta(state, collect_result)
        + _trace_delta(state, memory_result)
    )

    next_state = {
        **collect_result,
        "memory_context": memory_result.get("memory_context", ""),
        "retrieved_memories": memory_result.get("retrieved_memories", []),
        "memory_error": memory_result.get("memory_error"),
        "cycle_trace": cycle_trace,
    }

    logger.info(
        "research done — iteration=%d sources=%d memories=%d",
        next_state.get("iteration", 0),
        len(next_state.get("source_urls") or []),
        len(next_state.get("retrieved_memories") or []),
    )
    return next_state
