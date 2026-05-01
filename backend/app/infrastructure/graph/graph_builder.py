import time

from langgraph.graph import StateGraph, END

from app.core.config import settings
from app.infrastructure.graph.state import SalinigState
from app.infrastructure.graph.trace import append_trace

from app.infrastructure.graph.nodes.query_gen_node import query_gen_node
from app.infrastructure.graph.nodes.research_node import research_node
from app.infrastructure.graph.nodes.analysis_node import analysis_node
from app.infrastructure.graph.nodes.claim_verification_node import claim_verification_node
from app.infrastructure.graph.nodes.save_node import save_node
from app.infrastructure.graph.nodes.evidence_gate_node import evidence_gate_node
from app.infrastructure.graph.nodes.insufficient_evidence_node import insufficient_evidence_node
from app.infrastructure.graph.nodes.insight_node import insight_node
from app.infrastructure.graph.nodes.evaluate_node import evaluate_node
from app.infrastructure.graph.nodes.learning_node import learning_node
from app.infrastructure.graph.nodes.complete_node import complete_node
from app.infrastructure.graph.nodes.finalize_node import finalize_node
from app.infrastructure.graph.nodes.citation_validation_node import citation_validation_node


def route_after_evaluation(state):
    runtime_options = state.get("runtime_options") or {}
    if state.get("quality_passed"):
        return "learn" if runtime_options.get("sync_learning", settings.RAG_SYNC_LEARNING) else "complete"
    if state.get("iteration", 0) < state.get("max_iterations", 2):
        return "retry"
    return "finalize"


def route_after_evidence_gate(state):
    sufficiency = state.get("evidence_sufficiency") or {}
    if sufficiency.get("passed", True):
        return "analysis"
    return "insufficient_evidence"


def _with_timing(node_name, node):
    def wrapped(state):
        started_at = time.perf_counter()
        result = node(state)
        duration_ms = round((time.perf_counter() - started_at) * 1000, 2)
        trace = list(result.get("cycle_trace") or [])
        for index in range(len(trace) - 1, -1, -1):
            if trace[index].get("node") == node_name:
                trace[index] = {**trace[index], "duration_ms": duration_ms}
                break
        else:
            trace = append_trace(result, node_name, "completed", duration_ms=duration_ms)
        return {**result, "cycle_trace": trace}

    return wrapped


def build_graph():
    g = StateGraph(SalinigState)

    g.add_node("query_gen", _with_timing("query_gen", query_gen_node))
    g.add_node("research", _with_timing("research", research_node))
    g.add_node("evidence_gate", _with_timing("evidence_gate", evidence_gate_node))
    g.add_node("analysis", _with_timing("analysis", analysis_node))
    g.add_node("insight", _with_timing("insight", insight_node))
    g.add_node("claim_verification", _with_timing("claim_verification", claim_verification_node))
    g.add_node("citation_validation", _with_timing("citation_validation", citation_validation_node))
    g.add_node("evaluate", _with_timing("evaluate", evaluate_node))
    g.add_node("learn", _with_timing("learn", learning_node))
    g.add_node("save", _with_timing("save", save_node))
    g.add_node("complete", _with_timing("complete", complete_node))
    g.add_node("finalize", _with_timing("finalize", finalize_node))
    g.add_node("insufficient_evidence", _with_timing("insufficient_evidence", insufficient_evidence_node))

    g.set_entry_point("query_gen")

    g.add_edge("query_gen", "research")
    g.add_edge("research", "evidence_gate")
    g.add_conditional_edges(
        "evidence_gate",
        route_after_evidence_gate,
        {
            "analysis": "analysis",
            "insufficient_evidence": "insufficient_evidence",
        },
    )
    g.add_edge("analysis", "insight")
    g.add_edge("insight", "claim_verification")
    g.add_edge("claim_verification", "citation_validation")
    g.add_edge("citation_validation", "evaluate")
    g.add_conditional_edges(
        "evaluate",
        route_after_evaluation,
        {
            "learn": "learn",
            "complete": "complete",
            "retry": "query_gen",
            "finalize": "finalize",
        },
    )
    g.add_edge("learn", "save")
    g.add_edge("save", END)
    g.add_edge("complete", END)
    g.add_edge("finalize", END)
    g.add_edge("insufficient_evidence", END)

    return g.compile()


salinig_graph = build_graph()
