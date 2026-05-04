import logging
from concurrent.futures import ThreadPoolExecutor

from app.infrastructure.graph.nodes.collect_node import collect_node
from app.infrastructure.graph.nodes.memory_node import memory_node
from app.infrastructure.graph.nodes.spike_detection_node import spike_detection_node

logger = logging.getLogger(__name__)


def _trace_delta(before, after):
    before_len = len(before.get("cycle_trace") or [])
    return (after.get("cycle_trace") or [])[before_len:]


def research_node(state):
    logger.info("research start — running web collection, memory retrieval, and spike detection in parallel")

    with ThreadPoolExecutor(max_workers=3) as executor:
        f_collect = executor.submit(collect_node, state)
        f_memory = executor.submit(memory_node, state)
        f_spike = executor.submit(spike_detection_node, state)

        collect_result = f_collect.result()
        memory_result = f_memory.result()
        spike_result = f_spike.result()

    cycle_trace = (
        list(state.get("cycle_trace") or [])
        + _trace_delta(state, collect_result)
        + _trace_delta(state, memory_result)
        + _trace_delta(state, spike_result)
    )

    next_state = {
        **collect_result,
        "memory_context": memory_result.get("memory_context", ""),
        "retrieved_memories": memory_result.get("retrieved_memories", []),
        "memory_error": memory_result.get("memory_error"),
        "spike_detection": spike_result.get("spike_detection", {}),
        "spike_score": spike_result.get("spike_score", 0.0),
        "spike_level": spike_result.get("spike_level", "BASELINE"),
        "spike_signals": spike_result.get("spike_signals", []),
        "spike_history_count": spike_result.get("spike_history_count", 0),
        "spike_detection_error": spike_result.get("spike_detection_error"),
        "cycle_trace": cycle_trace,
    }

    logger.info(
        "research done — iteration=%d sources=%d memories=%d spike=%s",
        next_state.get("iteration", 0),
        len(next_state.get("source_urls") or []),
        len(next_state.get("retrieved_memories") or []),
        next_state.get("spike_level", "BASELINE"),
    )
    return next_state
