from __future__ import annotations

import time
from typing import Any

from app.core.config import settings
from app.schemas.analysis_schema import (
    AnalysisDiagnostics,
    ClaimVerificationSummary,
    AnalysisMode,
    AnalysisResponse,
    AnalyzeRequest,
    CitationValidationResult,
    EvidenceSufficiencyResult,
    EvidenceSource,
    MemoryItem,
    QualityResult,
    SentimentReport,
)


def _runtime_options(analysis_mode: AnalysisMode) -> dict[str, Any]:
    if analysis_mode == "fast_draft":
        return {
            "max_iterations": 1,
            "queries_per_theme": 4,
            "max_search_queries": 6,
            "search_max_results": 5,
            "search_depth": "basic",
            "include_raw_content": False,
            "evidence_char_limit": 12000,
            "source_char_limit": 1800,
            "enable_roberta": False,
            "sync_learning": False,
            "rerank_top_k": min(settings.RAG_RERANK_TOP_K, 6),
        }

    return {
        "max_iterations": settings.RAG_MAX_ITERATIONS,
        "queries_per_theme": settings.RAG_QUERIES_PER_THEME,
        "max_search_queries": settings.RAG_MAX_SEARCH_QUERIES,
        "search_max_results": settings.RAG_SEARCH_MAX_RESULTS,
        "search_depth": "advanced",
        "include_raw_content": True,
        "evidence_char_limit": settings.RAG_EVIDENCE_CHAR_LIMIT,
        "source_char_limit": settings.RAG_SOURCE_CHAR_LIMIT,
        "enable_roberta": settings.RAG_ENABLE_ROBERTA,
        "sync_learning": settings.RAG_SYNC_LEARNING,
        "rerank_top_k": settings.RAG_RERANK_TOP_K,
    }


class AnalysisService:
    def __init__(self, graph: Any | None = None) -> None:
        if graph is None:
            from app.infrastructure.graph.graph_builder import salinig_graph

            graph = salinig_graph
        self.graph = graph

    def analyze(self, request: AnalyzeRequest, include_diagnostics: bool | None = None) -> dict[str, Any]:
        request = AnalyzeRequest.model_validate(request)
        include_diagnostics = request.include_diagnostics if include_diagnostics is None else include_diagnostics
        started_at = time.perf_counter()
        result = self.graph.invoke(self._initial_state(request))
        result = self._completed_result(result, started_at)
        response = self._to_response(result, include_diagnostics=include_diagnostics)
        return response.model_dump(
            mode="json",
            exclude_none=True,
        )

    def stream_analyze(self, request: AnalyzeRequest) -> Any:
        request = AnalyzeRequest.model_validate(request)
        started_at = time.perf_counter()
        state = self._initial_state(request)
        latest_state: dict[str, Any] = state

        yield {
            "type": "status",
            "node": "queued",
            "label": "Preparing analysis",
            "iteration": 0,
            "max_iterations": state["max_iterations"],
        }

        for chunk in self.graph.stream(state):
            if not isinstance(chunk, dict):
                continue
            for node, update in chunk.items():
                if isinstance(update, dict):
                    latest_state = {**latest_state, **update}
                yield self._progress_event(node, latest_state)

        result = self._completed_result(latest_state, started_at)
        response = self._to_response(result, include_diagnostics=request.include_diagnostics)
        yield {
            "type": "final",
            "node": "analysis_service",
            "label": "Analysis complete",
            "iteration": result.get("iteration", 0),
            "max_iterations": result.get("max_iterations", 0),
            "analysis": response.model_dump(mode="json", exclude_none=True),
        }

    def _completed_result(self, result: dict[str, Any], started_at: float) -> dict[str, Any]:
        return {
            **result,
            "cycle_trace": list(result.get("cycle_trace") or [])
            + [
                {
                    "node": "analysis_service",
                    "event": "completed",
                    "iteration": result.get("iteration", 0),
                    "duration_ms": round((time.perf_counter() - started_at) * 1000, 2),
                }
            ],
        }

    def _progress_event(self, node: str, state: dict[str, Any]) -> dict[str, Any]:
        labels = {
            "query_gen": "Generating search queries",
            "research": "Collecting sources and memory",
            "evidence_gate": "Checking evidence sufficiency",
            "analysis": "Assessing sentiment and credibility",
            "insight": "Preparing report, source signals, and actions",
            "claim_verification": "Mapping claims to evidence",
            "citation_validation": "Validating cited sources",
            "evaluate": "Scoring quality gate",
            "learn": "Distilling learning note",
            "save": "Saving learning note",
            "complete": "Finalizing accepted report",
            "finalize": "Returning best available report",
            "insufficient_evidence": "Returning insufficient-evidence result",
        }
        sentiment_report = state.get("sentiment_report") or {}
        metrics = sentiment_report.get("metrics") or {}
        return {
            "type": "status",
            "node": node,
            "label": labels.get(node, f"{node} complete"),
            "iteration": state.get("iteration", 0),
            "max_iterations": state.get("max_iterations", 0),
            "source_count": len(state.get("collected_data") or []),
            "signal_count": metrics.get("signal_count", 0),
            "quality_score": state.get("quality_score", 0.0),
            "quality_passed": state.get("quality_passed", False),
        }

    def _initial_state(self, request: AnalyzeRequest) -> dict[str, Any]:
        runtime_options = _runtime_options(request.analysis_mode)
        return {
            "channel": request.channel,
            "monitoring_window": request.monitoring_window,
            "prioritize_themes": request.prioritize_themes,
            "focus_terms": request.focus_terms,
            "place": request.place,
            "analysis_mode": request.analysis_mode,
            "runtime_options": runtime_options,
            "search_queries": [],
            "collected_data": [],
            "ranked_sources": [],
            "evidence_text": "",
            "source_urls": [],
            "memory_context": "",
            "retrieved_memories": [],
            "evidence_sufficiency": {},
            "sentiment": "",
            "sentiment_label": "",
            "sentiment_scores": {},
            "sentiment_roberta_scores": {},
            "sentiment_llm_scores": {},
            "sentiment_roberta_error": None,
            "credibility": "",
            "final_report": "",
            "sentiment_report": {},
            "best_report": "",
            "best_sentiment_report": {},
            "best_quality_score": -1.0,
            "best_quality_breakdown": {},
            "best_quality_feedback": "",
            "best_knowledge_gaps": [],
            "best_blocking_issues": [],
            "iteration": 0,
            "max_iterations": runtime_options["max_iterations"],
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
            "analysis_status": "completed",
            "claim_verification": {},
            "citation_validation": {},
            "cycle_trace": [],
        }

    def _to_response(self, result: dict[str, Any], include_diagnostics: bool) -> AnalysisResponse:
        quality = QualityResult(
            score=result.get("quality_score", 0.0),
            breakdown=result.get("quality_breakdown", {}),
            passed=result.get("quality_passed", False),
            feedback=result.get("quality_feedback", ""),
            knowledge_gaps=result.get("knowledge_gaps", []),
            blocking_issues=result.get("blocking_issues", []),
        )

        diagnostics = None
        if include_diagnostics:
            diagnostics = AnalysisDiagnostics(
                search_queries=result.get("search_queries", []),
                collected_sources=self._evidence_sources(result.get("collected_data", [])),
                retrieved_memories=self._memory_items(result.get("retrieved_memories", [])),
                cycle_trace=result.get("cycle_trace", []),
                learning_note=result.get("learning_note", ""),
                learning_citations=result.get("learning_citations", []),
                memory_error=result.get("memory_error"),
                memory_save_error=result.get("memory_save_error"),
                evidence_sufficiency=EvidenceSufficiencyResult.model_validate(
                    result.get("evidence_sufficiency") or {}
                ),
                claim_verification=ClaimVerificationSummary.model_validate(
                    result.get("claim_verification") or {}
                ),
                citation_validation=CitationValidationResult.model_validate(
                    result.get("citation_validation") or {}
                ),
            )

        return AnalysisResponse(
            channel=result.get("channel"),
            monitoring_window=result.get("monitoring_window"),
            prioritize_themes=result.get("prioritize_themes", []),
            focus_terms=result.get("focus_terms", []),
            place=result.get("place"),
            analysis_mode=result.get("analysis_mode", "fast_draft"),
            analysis_status=result.get("analysis_status", "completed"),
            final_report=result.get("final_report", ""),
            sentiment_report=SentimentReport.model_validate(result.get("sentiment_report"))
            if result.get("sentiment_report")
            else None,
            iteration=result.get("iteration", 0),
            max_iterations=result.get("max_iterations", settings.RAG_MAX_ITERATIONS),
            quality=quality,
            memory_saved=result.get("memory_saved", False),
            memory_duplicate=result.get("memory_duplicate", False),
            diagnostics=diagnostics,
            quality_score=quality.score,
            quality_breakdown=quality.breakdown,
            quality_passed=quality.passed,
            quality_feedback=quality.feedback,
            knowledge_gaps=quality.knowledge_gaps,
            blocking_issues=quality.blocking_issues,
        )

    def _evidence_sources(self, items: list[Any]) -> list[EvidenceSource]:
        sources = []
        for item in items:
            if not isinstance(item, dict):
                sources.append(EvidenceSource(content_preview=str(item)[:500]))
                continue
            content = item.get("raw_content") or item.get("content") or item.get("snippet")
            sources.append(
                EvidenceSource(
                    title=item.get("title") or item.get("name") or "Untitled source",
                    url=item.get("url") or item.get("link") or item.get("source"),
                    published=item.get("published_date") or item.get("published") or item.get("date"),
                    score=item.get("score") or item.get("relevance_score"),
                    content_preview=(" ".join(str(content).split())[:500] if content else None),
                )
            )
        return sources

    def _memory_items(self, items: list[dict[str, Any]]) -> list[MemoryItem]:
        memories = []
        for item in items:
            memories.append(
                MemoryItem(
                    content=str(item.get("content", "")),
                    metadata=item.get("metadata") or {},
                    score=item.get("score"),
                )
            )
        return memories
