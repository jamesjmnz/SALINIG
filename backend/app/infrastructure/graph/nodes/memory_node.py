import logging

from app.core.config import settings
from app.infrastructure.graph.trace import append_trace
from app.infrastructure.memory.qdrant_memory import retrieve_with_diagnostics

logger = logging.getLogger(__name__)

def memory_node(state):
    query_parts = [state["place"]] + list(state.get("prioritize_themes") or [])
    if state.get("knowledge_gaps"):
        query_parts.extend(state["knowledge_gaps"])
    query = " ".join(query_parts)

    logger.info("memory start — query=%r k=%d", query, settings.RAG_RETRIEVAL_K)

    try:
        result = retrieve_with_diagnostics(query, k=settings.RAG_RETRIEVAL_K)
        mem = result["context"]
        memories = result["memories"]
        error = result.get("error")
    except Exception as exc:
        mem = ""
        memories = []
        error = str(exc)

    logger.info("memory done — retrieved=%d error=%s", len(memories), error)

    return {
        **state,
        "memory_context": mem,
        "retrieved_memories": memories,
        "memory_error": error,
        "cycle_trace": append_trace(
            state,
            "memory",
            "retrieved",
            query=query,
            retrieved=len(memories),
            error=error,
        ),
    }
