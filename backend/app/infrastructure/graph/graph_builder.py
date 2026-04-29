from langgraph.graph import StateGraph, END

from app.core.config import settings
from app.infrastructure.graph.state import SalinigState

from app.infrastructure.graph.nodes.query_gen_node import query_gen_node
from app.infrastructure.graph.nodes.research_node import research_node
from app.infrastructure.graph.nodes.analysis_node import analysis_node
from app.infrastructure.graph.nodes.save_node import save_node
from app.infrastructure.graph.nodes.insight_node import insight_node
from app.infrastructure.graph.nodes.evaluate_node import evaluate_node
from app.infrastructure.graph.nodes.learning_node import learning_node
from app.infrastructure.graph.nodes.complete_node import complete_node
from app.infrastructure.graph.nodes.finalize_node import finalize_node


def route_after_evaluation(state):
    if state.get("quality_passed"):
        return "learn" if settings.RAG_SYNC_LEARNING else "complete"
    if state.get("iteration", 0) < state.get("max_iterations", 2):
        return "retry"
    return "finalize"


def build_graph():
    g = StateGraph(SalinigState)

    g.add_node("query_gen", query_gen_node)
    g.add_node("research", research_node)
    g.add_node("analysis", analysis_node)
    g.add_node("insight", insight_node)
    g.add_node("evaluate", evaluate_node)
    g.add_node("learn", learning_node)
    g.add_node("save", save_node)
    g.add_node("complete", complete_node)
    g.add_node("finalize", finalize_node)

    g.set_entry_point("query_gen")

    g.add_edge("query_gen", "research")
    g.add_edge("research", "analysis")
    g.add_edge("analysis", "insight")
    g.add_edge("insight", "evaluate")
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

    return g.compile()


salinig_graph = build_graph()
