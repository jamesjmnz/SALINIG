from app.infrastructure.graph.graph_builder import salinig_graph
from app.core.config import settings

class AnalysisService:

    def analyze(self, request):
        state = {
            "channel": request.channel,
            "monitoring_window": request.monitoring_window,
            "prioritize_themes": request.prioritize_themes,
            "place": request.place,
            "search_queries": [],

            "collected_data": [],
            "evidence_text": "",
            "source_urls": [],
            "memory_context": "",
            "retrieved_memories": [],

            "sentiment": "",
            "sentiment_label": "",
            "sentiment_scores": {},
            "sentiment_roberta_scores": {},
            "sentiment_llm_scores": {},
            "sentiment_roberta_error": None,
            "credibility": "",
            "final_report": "",
            "best_report": "",
            "best_quality_score": -1.0,
            "best_quality_breakdown": {},
            "best_quality_feedback": "",
            "best_knowledge_gaps": [],
            "best_blocking_issues": [],

            "iteration": 0,
            "max_iterations": settings.RAG_MAX_ITERATIONS,
            "quality_score": 0.0,
            "quality_breakdown": {},
            "quality_passed": False,
            "quality_feedback": "",
            "knowledge_gaps": [],
            "blocking_issues": [],

            "learning_note": "",
            "learning_citations": [],
            "memory_saved": False,
            "memory_duplicate": False,
            "memory_error": None,
            "memory_save_error": None,
            "cycle_trace": [],
        }

        result = salinig_graph.invoke(state)
        return self._to_response(result)

    def _to_response(self, result):
        return {
            "channel": result.get("channel"),
            "monitoring_window": result.get("monitoring_window"),
            "prioritize_themes": result.get("prioritize_themes", []),
            "place": result.get("place"),
            "final_report": result.get("final_report", ""),
            "quality_score": result.get("quality_score", 0.0),
            "quality_breakdown": result.get("quality_breakdown", {}),
            "quality_passed": result.get("quality_passed", False),
            "quality_feedback": result.get("quality_feedback", ""),
            "knowledge_gaps": result.get("knowledge_gaps", []),
            "blocking_issues": result.get("blocking_issues", []),
            "iteration": result.get("iteration", 0),
            "max_iterations": result.get("max_iterations", settings.RAG_MAX_ITERATIONS),
            "memory_saved": result.get("memory_saved", False),
            "memory_duplicate": result.get("memory_duplicate", False),
            "memory_error": result.get("memory_error"),
            "memory_save_error": result.get("memory_save_error"),
            "learning_note": result.get("learning_note", ""),
            "learning_citations": result.get("learning_citations", []),
            "retrieved_memories": result.get("retrieved_memories", []),
            "collected_sources": result.get("source_urls", []),
            "cycle_trace": result.get("cycle_trace", []),
        }
