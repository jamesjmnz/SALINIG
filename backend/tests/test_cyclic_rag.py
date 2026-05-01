import os
import sys
import unittest
from contextlib import ExitStack
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

os.environ["OPENAI_API_KEY"] = "test-openai-key"
os.environ["TAVILY_API_KEY"] = "test-tavily-key"
os.environ["QDRANT_URL"] = "http://localhost:6333"
os.environ["QDRANT_COLLECTION"] = "test_memories"
os.environ["OPENAI_MODEL"] = "test-model"
os.environ["RAG_MAX_ITERATIONS"] = "3"
os.environ["RAG_QUALITY_THRESHOLD"] = "0.75"
os.environ["RAG_RETRIEVAL_K"] = "3"
os.environ["RAG_SEARCH_MAX_RESULTS"] = "5"
os.environ["RAG_QUERIES_PER_THEME"] = "2"
os.environ["RAG_EVIDENCE_CHAR_LIMIT"] = "25000"
os.environ["RAG_SOURCE_CHAR_LIMIT"] = "3500"
os.environ["RAG_USE_LLM_QUERY_GEN"] = "false"
os.environ["RAG_SYNC_LEARNING"] = "true"
os.environ["RAG_AUX_ANALYSIS_CHAR_LIMIT"] = "3500"
os.environ["RAG_SIGNAL_MAX_WORKERS"] = "4"

from app.domain.services.analysis_service import AnalysisService
from app.domain.services.analysis_cache import (
    clear_latest_successful_analysis,
)
from app.core.config import settings
from app.core.rate_limit import analysis_rate_limiter
from app.main import app
from app.schemas.analysis_schema import AnalyzeRequest
from app.infrastructure.memory import qdrant_memory
from fastapi.testclient import TestClient


QUALITY_KEYS = [
    "evidence_grounding",
    "timeframe_fit",
    "source_credibility_weighting",
    "specificity_and_depth",
    "memory_integration",
    "practical_usefulness",
]


def breakdown(score):
    return {key: score for key in QUALITY_KEYS}


def evaluation(score, feedback="Good enough", gaps=None, issues=None, reported_score=None):
    return {
        "score": reported_score if reported_score is not None else score,
        "quality_breakdown": breakdown(score),
        "feedback": feedback,
        "knowledge_gaps": gaps or [],
        "blocking_issues": issues or [],
    }


class FakeStructuredLLM:
    def __init__(self, llm, schema):
        self.llm = llm
        self.schema = schema

    def invoke(self, messages):
        if self.schema.__name__ == "EvaluationResult":
            if not self.llm.evaluations:
                raise AssertionError("No fake evaluation result left")
            return self.schema(**self.llm.evaluations.pop(0))
        if self.schema.__name__ == "LearningResult":
            return self.schema(
                note=self.llm.learning_note,
                citations=["https://example.com/source-1"],
            )
        if self.schema.__name__ == "SearchQueries":
            # Parse knowledge gaps from message content so retry queries reflect them
            content = messages[1].content if len(messages) > 1 else ""
            required_count = 2
            gaps = []
            for line in content.split("\n"):
                if "Required query count:" in line:
                    required_count = int(line.replace("Required query count:", "").strip())
                if "Knowledge gaps to close:" in line:
                    raw = line.replace("Knowledge gaps to close:", "").strip()
                    gaps = [g.strip() for g in raw.split(";") if g.strip()]
            target = gaps[0] if gaps else "infrastructure"
            queries = [
                f"test place {target} query {index + 1} past 24 hours"
                for index in range(required_count)
            ]
            return self.schema(queries=queries)
        if self.schema.__name__ == "EvidenceAssessment":
            return self.schema(
                sentiment="Sentiment is mixed but improving.",
                sentiment_scores={"negative": 0.2, "neutral": 0.5, "positive": 0.3},
                credibility="Credibility is moderate with cited caveats.",
            )
        if self.schema.__name__ == "SentimentOnlyAssessment":
            return self.schema(
                sentiment="Sentiment is mixed but improving.",
                sentiment_scores={"negative": 0.2, "neutral": 0.5, "positive": 0.3},
            )
        if self.schema.__name__ == "SentimentReportDraft":
            self.llm.report_calls += 1
            return self.schema(
                overall_label="Mixed Sentiment",
                overview=f"Report {self.llm.report_calls}",
                source_signals=[
                    {
                        "source_index": 1,
                        "summary": f"Evidence-backed signal {self.llm.report_calls}",
                        "sentiment": "Neutral",
                        "verification": "verified",
                        "credibility": "Moderate",
                    }
                ],
                actionable_insights=[
                    f"Review Source 1 after report {self.llm.report_calls}",
                ],
            )
        if self.schema.__name__ == "SourceSignalAnalysis":
            content = messages[1].content if len(messages) > 1 else ""
            source_index = 0
            for line in content.split("\n"):
                if line.startswith("Source index:"):
                    source_index = int(line.replace("Source index:", "").strip())
                    break
            self.llm.signal_calls.append(source_index)
            return self.schema(
                summary=f"Evidence-backed signal {source_index}",
                sentiment="Neutral",
                verification="verified",
                credibility="Moderate",
            )
        raise AssertionError(f"Unexpected structured schema {self.schema}")


class FakeLLM:
    def __init__(self, evaluations, learning_note="Durable cited learning"):
        self.evaluations = list(evaluations)
        self.learning_note = learning_note
        self.report_calls = 0
        self.signal_calls = []

    def invoke(self, messages):
        content = messages[0].content
        if "research analyst and intelligence report writer" in content:
            self.report_calls += 1
            return SimpleNamespace(content=f"Report {self.report_calls}")
        if "media intelligence analyst" in content:
            return SimpleNamespace(content="Sentiment is mixed but improving.")
        if "fact-checking analyst" in content:
            return SimpleNamespace(content="Credibility is moderate with cited caveats.")
        return SimpleNamespace(content="Generic response")

    def with_structured_output(self, schema):
        return FakeStructuredLLM(self, schema)


class CyclicRagTests(unittest.TestCase):
    def run_analysis(self, evaluations, analysis_mode="full"):
        fake_llm = FakeLLM(evaluations)
        search_calls = []
        search_options = []
        saved = []

        def fake_search(query, monitoring_window=None, **kwargs):
            search_calls.append(query)
            search_options.append({"monitoring_window": monitoring_window, **kwargs})
            index = len(search_calls)
            return [
                {
                    "title": f"Source {index}",
                    "url": f"https://example.com/source-{index}",
                    "content": f"Evidence batch {index}",
                }
            ]

        def fake_retrieve(query, k=None):
            return {
                "context": f"Memory for {query}",
                "memories": [
                    {
                        "content": "Prior useful learning",
                        "metadata": {"place": "test place"},
                        "score": 0.42,
                    }
                ],
                "error": None,
            }

        def fake_save_learning(text, metadata):
            saved.append({"text": text, "metadata": metadata})
            return {
                "saved": True,
                "duplicate": False,
                "content_hash": "fake-hash",
                "ids": ["fake-id"],
                "error": None,
            }

        llm_targets = [
            "app.infrastructure.graph.nodes.sentiment_node.get_llm",
            "app.infrastructure.graph.nodes.credibility_node.get_llm",
            "app.infrastructure.graph.nodes.analysis_node.get_llm",
            "app.infrastructure.graph.nodes.insight_node.get_llm",
            "app.infrastructure.graph.nodes.evaluate_node.get_llm",
            "app.infrastructure.graph.nodes.learning_node.get_llm",
            "app.infrastructure.graph.nodes.query_gen_node.get_llm",
        ]

        with ExitStack() as stack:
            for target in llm_targets:
                stack.enter_context(patch(target, return_value=fake_llm))
            stack.enter_context(
                patch("app.infrastructure.graph.nodes.collect_node.search", side_effect=fake_search)
            )
            stack.enter_context(
                patch(
                    "app.infrastructure.graph.nodes.memory_node.retrieve_with_diagnostics",
                    side_effect=fake_retrieve,
                )
            )
            stack.enter_context(
                patch(
                    "app.infrastructure.graph.nodes.save_node.save_learning",
                    side_effect=fake_save_learning,
                )
            )
            roberta_mock = stack.enter_context(
                patch(
                    "app.infrastructure.graph.nodes.sentiment_ensemble.infer_roberta_sentiment",
                    return_value={"negative": 0.1, "neutral": 0.7, "positive": 0.2},
                )
            )

            response = AnalysisService().analyze(
                AnalyzeRequest(
                    place="Philippines",
                    monitoring_window="past 24 hours",
                    prioritize_themes=["infrastructure"],
                    analysis_mode=analysis_mode,
                    include_diagnostics=True,
                )
            )

        self.last_fake_llm = fake_llm
        self.last_search_options = search_options
        self.last_roberta_mock = roberta_mock
        return response, search_calls, saved

    def test_analyze_request_defaults_to_fast_draft(self):
        request = AnalyzeRequest()

        self.assertEqual(request.analysis_mode, "fast_draft")
        self.assertEqual(request.place, "Philippines")
        self.assertEqual(request.monitoring_window, "past 7 days")
        self.assertIn("Governance & Public Services", request.prioritize_themes)

    def test_analyze_request_canonicalizes_thesis_categories(self):
        request = AnalyzeRequest(
            place="national",
            prioritize_themes=["infrastructure", "environmental", "infrastructure"],
            focus_terms=["flood alerts", " flood alerts "],
        )

        self.assertEqual(request.place, "Philippines")
        self.assertEqual(
            request.prioritize_themes,
            ["Transportation & Infrastructure", "Disaster, Climate & Environment"],
        )
        self.assertEqual(request.focus_terms, ["flood alerts"])

    def test_fast_draft_default_limits_work_and_skips_sync_learning(self):
        response, search_calls, saved = self.run_analysis(
            [evaluation(0.4, feedback="Draft is useful but below full threshold")],
            analysis_mode="fast_draft",
        )

        self.assertEqual(response["analysis_mode"], "fast_draft")
        self.assertFalse(response["quality_passed"])
        self.assertEqual(response["iteration"], 1)
        self.assertEqual(response["max_iterations"], 1)
        self.assertIn("OVERALL SENTIMENT", response["final_report"])
        self.assertIn("Report 1", response["final_report"])
        self.assertIn("sentiment_report", response)
        self.assertEqual(response["sentiment_report"]["overall_label"], "Neutral Sentiment")
        self.assertEqual(saved, [])
        self.assertEqual(len(search_calls), 4)
        self.assertEqual(self.last_search_options[0]["max_results"], 5)
        self.assertEqual(self.last_search_options[0]["search_depth"], "basic")
        self.assertFalse(self.last_search_options[0]["include_raw_content"])
        self.last_roberta_mock.assert_not_called()

        trace = response["diagnostics"]["cycle_trace"]
        analysis_trace = next(entry for entry in trace if entry["node"] == "analysis")
        self.assertEqual(analysis_trace["sentiment_weights"], {"roberta": 0.0, "llm": 1.0})
        self.assertIn("duration_ms", analysis_trace)
        self.assertEqual(trace[-1]["node"], "analysis_service")
        self.assertIn("duration_ms", trace[-1])

    def test_success_path_saves_distilled_learning_and_returns_diagnostics(self):
        response, search_calls, saved = self.run_analysis(
            [evaluation(0.91, feedback="Strong report")]
        )

        self.assertTrue(response["quality_passed"])
        self.assertAlmostEqual(response["quality_score"], 0.91)
        self.assertEqual(response["iteration"], 1)
        self.assertTrue(response["memory_saved"])
        self.assertEqual(response["diagnostics"]["learning_note"], "Durable cited learning")
        self.assertEqual(len(saved), 1)
        self.assertEqual(len(search_calls), 2)
        self.assertIn("retrieved_memories", response["diagnostics"])
        self.assertIn("knowledge_gaps", response)
        self.assertIn("quality_breakdown", response)
        self.assertIn("blocking_issues", response)
        self.assertIn("cycle_trace", response["diagnostics"])
        self.assertIn("collected_sources", response["diagnostics"])
        self.assertEqual(response["sentiment_report"]["metrics"]["signal_count"], 2)
        analysis_trace = next(
            entry for entry in response["diagnostics"]["cycle_trace"] if entry["node"] == "analysis"
        )
        self.assertEqual(analysis_trace["sentiment_label"], "Neutral")
        self.assertEqual(analysis_trace["sentiment_weights"], {"roberta": 0.4, "llm": 0.6})
        self.assertIn("sentiment_blended_scores", analysis_trace)

    def test_repair_path_loops_once_then_saves(self):
        response, search_calls, saved = self.run_analysis(
            [
                evaluation(
                    0.4,
                    feedback="Needs fresher supporting evidence",
                    gaps=["missing current data"],
                ),
                evaluation(0.82, feedback="Good enough"),
            ]
        )

        self.assertTrue(response["quality_passed"])
        self.assertEqual(response["iteration"], 2)
        self.assertEqual(len(search_calls), 4)
        self.assertTrue(any("missing current data" in query for query in search_calls[2:]))
        self.assertEqual(len(saved), 1)
        self.assertTrue(response["memory_saved"])

    def test_max_iteration_path_returns_best_report_without_saving(self):
        response, search_calls, saved = self.run_analysis(
            [
                evaluation(0.4, feedback="Needs source detail", gaps=["source detail"]),
                evaluation(0.3, feedback="Worse than prior report", gaps=["still weak"]),
                evaluation(0.35, feedback="Still below threshold", gaps=["more corroboration"]),
            ]
        )

        self.assertFalse(response["quality_passed"])
        self.assertFalse(response["memory_saved"])
        self.assertEqual(response["quality_score"], 0.4)
        self.assertEqual(response["iteration"], 3)
        self.assertIn("Report 1", response["final_report"])
        self.assertEqual(response["sentiment_report"]["overview"], "Report 1")
        self.assertEqual(len(search_calls), 6)
        self.assertEqual(saved, [])

    def test_weighted_score_is_computed_from_quality_breakdown(self):
        response, _search_calls, saved = self.run_analysis(
            [evaluation(0.88, feedback="Breakdown should drive score", reported_score=0.12)]
        )

        self.assertTrue(response["quality_passed"])
        self.assertAlmostEqual(response["quality_score"], 0.88)
        self.assertEqual(response["quality_breakdown"]["evidence_grounding"], 0.88)
        self.assertEqual(len(saved), 1)

    def test_failed_response_includes_actionable_quality_diagnostics(self):
        response, _search_calls, saved = self.run_analysis(
            [
                evaluation(
                    0.45,
                    feedback="Missing source-specific details",
                    gaps=["official incident timeline"],
                    issues=["Section 3 lacks source-specific citations"],
                ),
                evaluation(0.4, feedback="Still weak", gaps=["official incident timeline"]),
                evaluation(0.3, feedback="Regressed", gaps=["verified affected areas"]),
            ]
        )

        self.assertFalse(response["quality_passed"])
        self.assertEqual(response["knowledge_gaps"], ["official incident timeline"])
        self.assertIn("quality_breakdown", response)
        self.assertIn("blocking_issues", response)
        self.assertIn("Section 3 lacks source-specific citations", response["blocking_issues"])
        self.assertEqual(saved, [])

    def test_memory_dedupe_skips_existing_learning_hash(self):
        self.assertEqual(
            qdrant_memory.make_content_hash(" Same   learning "),
            qdrant_memory.make_content_hash("Same learning"),
        )

        with patch.object(qdrant_memory, "_content_hash_exists", return_value=True):
            with patch.object(qdrant_memory, "_get_store") as get_store:
                result = qdrant_memory.save_learning(
                    "Same learning",
                    {"place": "test place"},
                )

        self.assertFalse(result["saved"])
        self.assertTrue(result["duplicate"])
        get_store.assert_not_called()


def minimal_api_response():
    return {
        "channel": "web_search",
        "monitoring_window": "past 24 hours",
        "prioritize_themes": ["Transportation & Infrastructure"],
        "focus_terms": [],
        "place": "Philippines",
        "analysis_mode": "fast_draft",
        "final_report": "Report",
        "sentiment_report": {
            "updated_at": "2026-04-30T00:00:00+00:00",
            "updated_label": "Updated moments ago",
            "overall_label": "Mixed Sentiment",
            "overview": "Report",
            "source_signals": [
                {
                    "source": "example.com",
                    "title": "Source 1",
                    "url": "https://example.com/source-1",
                    "summary": "Evidence-backed signal",
                    "sentiment": "Neutral",
                    "verification": "verified",
                    "credibility": "Moderate",
                    "credibility_score": 70,
                }
            ],
            "metrics": {
                "negative_pct": 20,
                "neutral_pct": 50,
                "positive_pct": 30,
                "credibility_pct": 70,
                "verified_pct": 100,
                "misinfo_risk_pct": 0,
                "signal_count": 1,
            },
            "actionable_insights": ["Review Source 1"],
        },
        "iteration": 1,
        "max_iterations": 1,
        "quality": {
            "score": 0.9,
            "breakdown": breakdown(0.9),
            "passed": True,
            "feedback": "Good",
            "knowledge_gaps": [],
            "blocking_issues": [],
        },
        "quality_score": 0.9,
        "quality_breakdown": breakdown(0.9),
        "quality_passed": True,
        "quality_feedback": "Good",
        "knowledge_gaps": [],
        "blocking_issues": [],
        "memory_saved": False,
        "memory_duplicate": False,
    }


class ApiContractTests(unittest.TestCase):
    def setUp(self):
        self.old_api_key = settings.SALINIG_API_KEY
        self.old_rate_limit = settings.SALINIG_RATE_LIMIT_REQUESTS
        settings.SALINIG_API_KEY = None
        settings.SALINIG_RATE_LIMIT_REQUESTS = 20
        clear_latest_successful_analysis()
        analysis_rate_limiter.clear()
        self.client = TestClient(app)

    def tearDown(self):
        analysis_rate_limiter.clear()
        clear_latest_successful_analysis()
        settings.SALINIG_API_KEY = self.old_api_key
        settings.SALINIG_RATE_LIMIT_REQUESTS = self.old_rate_limit

    def test_default_endpoint_returns_analysis_response(self):
        with patch("app.api.v1.endpoints.analysis.AnalysisService") as service:
            service.return_value.analyze.return_value = minimal_api_response()
            response = self.client.post(
                "/api/v1/analysis/",
                json={
                    "place": "Philippines",
                    "monitoring_window": "past 24 hours",
                    "prioritize_themes": ["infrastructure"],
                },
            )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertNotIn("diagnostics", body)
        self.assertNotIn("run_id", body)
        self.assertNotIn("status", body)
        self.assertEqual(body["final_report"], "Report")
        self.assertEqual(body["sentiment_report"]["overall_label"], "Mixed Sentiment")
        self.assertEqual(body["sentiment_report"]["metrics"]["signal_count"], 1)
        self.assertEqual(body["quality"]["score"], 0.9)

    def test_default_endpoint_accepts_optional_input_defaults(self):
        with patch("app.api.v1.endpoints.analysis.AnalysisService") as service:
            service.return_value.analyze.return_value = minimal_api_response()
            response = self.client.post("/api/v1/analysis/", json={})

        self.assertEqual(response.status_code, 200)
        request = service.return_value.analyze.call_args.args[0]
        self.assertEqual(request.place, "Philippines")
        self.assertEqual(request.monitoring_window, "past 7 days")
        self.assertEqual(
            request.prioritize_themes,
            [
                "Governance & Public Services",
                "Transportation & Infrastructure",
                "Disaster, Climate & Environment",
            ],
        )

    def test_stream_endpoint_emits_progress_and_final_analysis(self):
        with patch("app.api.v1.endpoints.analysis.AnalysisService") as service:
            service.return_value.stream_analyze.return_value = [
                {
                    "type": "status",
                    "node": "research",
                    "label": "Collecting sources and memory",
                    "iteration": 1,
                    "max_iterations": 1,
                },
                {
                    "type": "final",
                    "node": "analysis_service",
                    "label": "Analysis complete",
                    "analysis": minimal_api_response(),
                },
            ]
            response = self.client.post(
                "/api/v1/analysis/stream",
                json={
                    "place": "Philippines",
                    "monitoring_window": "past 24 hours",
                    "prioritize_themes": ["infrastructure"],
                },
            )

        self.assertEqual(response.status_code, 200)
        body = response.text
        self.assertIn("event: status", body)
        self.assertIn("Collecting sources and memory", body)
        self.assertIn("event: final", body)
        self.assertIn('"final_report": "Report"', body)

    def test_options_endpoint_exposes_philippines_first_scope(self):
        response = self.client.get("/api/v1/analysis/options")

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["default_place"], "Philippines")
        self.assertIn("NCR", body["supported_locations"])
        self.assertIn("Governance & Public Services", body["categories"])
        self.assertEqual(body["max_themes"], settings.RAG_MAX_THEMES)
        self.assertEqual(body["max_focus_terms"], settings.RAG_MAX_THEMES)
        self.assertEqual(body["fetching_mode"], "cached_on_load_manual_refresh")

    def test_latest_endpoint_returns_cached_successful_report(self):
        from app.schemas.analysis_schema import AnalysisResponse
        from app.domain.services.analysis_cache import cache_latest_successful

        saved = cache_latest_successful(AnalysisResponse.model_validate(minimal_api_response()))

        response = self.client.get("/api/v1/analysis/latest")

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["cached"])
        self.assertEqual(body["report_id"], saved.report_id)
        self.assertEqual(body["analysis"]["final_report"], "Report")

    def test_saved_reports_can_be_created_manually(self):
        response = self.client.post("/api/v1/analysis/saved", json=minimal_api_response())

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["report_id"])
        self.assertEqual(body["analysis"]["final_report"], "Report")

        saved_reports = self.client.get("/api/v1/analysis/saved").json()["reports"]
        self.assertEqual(len(saved_reports), 1)
        self.assertEqual(saved_reports[0]["report_id"], body["report_id"])

    def test_save_endpoint_accepts_unpassed_reports(self):
        payload = minimal_api_response()
        payload["quality"]["passed"] = False
        payload["quality_passed"] = False
        payload["quality"]["score"] = 0.42
        payload["quality_score"] = 0.42

        response = self.client.post("/api/v1/analysis/saved", json=payload)

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertFalse(body["analysis"]["quality"]["passed"])
        self.assertFalse(body["analysis"]["quality_passed"])

        saved_reports = self.client.get("/api/v1/analysis/saved").json()["reports"]
        self.assertEqual(len(saved_reports), 1)
        self.assertFalse(saved_reports[0]["quality_passed"])

    def test_saved_reports_endpoint_returns_archived_summaries(self):
        from app.schemas.analysis_schema import AnalysisResponse
        from app.domain.services.analysis_cache import cache_latest_successful

        cache_latest_successful(AnalysisResponse.model_validate(minimal_api_response()))

        response = self.client.get("/api/v1/analysis/saved")

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(len(body["reports"]), 1)
        self.assertEqual(body["reports"][0]["place"], "Philippines")
        self.assertEqual(body["reports"][0]["signal_count"], 1)
        self.assertTrue(body["reports"][0]["report_id"])

    def test_saved_report_detail_endpoint_returns_archived_analysis(self):
        from app.schemas.analysis_schema import AnalysisResponse
        from app.domain.services.analysis_cache import cache_latest_successful

        cache_latest_successful(AnalysisResponse.model_validate(minimal_api_response()))
        saved = self.client.get("/api/v1/analysis/saved").json()["reports"][0]

        response = self.client.get(f"/api/v1/analysis/saved/{saved['report_id']}")

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["report_id"], saved["report_id"])
        self.assertEqual(body["analysis"]["final_report"], "Report")

    def test_request_validation_rejects_unbounded_theme_payloads(self):
        response = self.client.post(
            "/api/v1/analysis/",
            json={
                "place": "Philippines",
                "monitoring_window": "past 24 hours",
                "prioritize_themes": ["a", "b", "c", "d", "e", "f"],
            },
        )

        self.assertEqual(response.status_code, 422)

    def test_api_key_is_required_when_configured(self):
        settings.SALINIG_API_KEY = "secret"

        response = self.client.post(
            "/api/v1/analysis/",
            json={
                "place": "Philippines",
                "monitoring_window": "past 24 hours",
                "prioritize_themes": ["infrastructure"],
            },
        )

        self.assertEqual(response.status_code, 401)

    def test_request_validation_rejects_global_location_scope(self):
        response = self.client.post(
            "/api/v1/analysis/",
            json={
                "place": "Tokyo",
                "monitoring_window": "past 24 hours",
                "prioritize_themes": ["infrastructure"],
            },
        )

        self.assertEqual(response.status_code, 422)

    def test_rate_limit_blocks_excess_requests(self):
        settings.SALINIG_RATE_LIMIT_REQUESTS = 1
        with patch("app.api.v1.endpoints.analysis.AnalysisService") as service:
            service.return_value.analyze.return_value = minimal_api_response()
            payload = {
                "place": "Philippines",
                "monitoring_window": "past 24 hours",
                "prioritize_themes": ["infrastructure"],
            }
            first = self.client.post("/api/v1/analysis/", json=payload)
            second = self.client.post("/api/v1/analysis/", json=payload)

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 429)


class AdapterAndValidationTests(unittest.TestCase):
    def test_tavily_adapter_retries_transient_failures_and_sets_time_range(self):
        from app.infrastructure.search import tavily_search

        class FakeResponse:
            def __init__(self, status_code, payload):
                self.status_code = status_code
                self._payload = payload

            def json(self):
                return self._payload

        calls = []

        def fake_post(url, json, headers, timeout):
            calls.append({"url": url, "json": json, "timeout": timeout})
            if len(calls) == 1:
                return FakeResponse(503, {"detail": {"error": "temporary"}})
            return FakeResponse(200, {"results": [{"title": "Source"}]})

        old_retries = settings.EXTERNAL_MAX_RETRIES
        settings.EXTERNAL_MAX_RETRIES = 1
        try:
            with patch("app.infrastructure.search.tavily_search.requests.post", side_effect=fake_post):
                with patch("app.infrastructure.search.tavily_search.time.sleep"):
                    result = tavily_search.search("test query", monitoring_window="past 7 days")
        finally:
            settings.EXTERNAL_MAX_RETRIES = old_retries

        self.assertEqual(len(calls), 2)
        self.assertEqual(calls[0]["json"]["time_range"], "week")
        self.assertEqual(result["results"][0]["title"], "Source")

    def test_tavily_adapter_supports_fast_basic_search_without_raw_content(self):
        from app.infrastructure.search import tavily_search

        class FakeResponse:
            status_code = 200

            def json(self):
                return {"results": [{"title": "Fast Source"}]}

        calls = []

        def fake_post(url, json, headers, timeout):
            calls.append({"url": url, "json": json, "timeout": timeout})
            return FakeResponse()

        with patch("app.infrastructure.search.tavily_search.requests.post", side_effect=fake_post):
            result = tavily_search.search(
                "test query",
                monitoring_window="past 24 hours",
                max_results=3,
                include_raw_content=False,
                search_depth="basic",
            )

        payload = calls[0]["json"]
        self.assertEqual(payload["max_results"], 3)
        self.assertEqual(payload["search_depth"], "basic")
        self.assertEqual(payload["time_range"], "day")
        self.assertNotIn("include_raw_content", payload)
        self.assertEqual(result["results"][0]["title"], "Fast Source")

    def test_qdrant_dedupe_uses_point_lookup_not_collection_scroll(self):
        client = Mock()
        client.retrieve.return_value = [object()]
        client.scroll = Mock()

        with patch.object(qdrant_memory, "_get_client", return_value=client):
            exists = qdrant_memory._content_hash_exists("abc123")

        self.assertTrue(exists)
        client.retrieve.assert_called_once()
        client.scroll.assert_not_called()

    def test_citation_validation_flags_sources_outside_evidence(self):
        from app.infrastructure.graph.nodes.citation_validation_node import citation_validation_node

        result = citation_validation_node(
            {
                "final_report": "• Claim — High (Source: Unknown Source; URL: https://unknown.test/report)",
                "source_urls": ["https://example.com/source-1"],
                "collected_data": [{"title": "Source 1", "url": "https://example.com/source-1"}],
                "cycle_trace": [],
            }
        )

        validation = result["citation_validation"]
        self.assertFalse(validation["passed"])
        self.assertEqual(validation["unsupported_urls"], ["https://unknown.test/report"])
        self.assertEqual(validation["unsupported_source_titles"], ["unknown source"])

    def test_citation_validation_accepts_src_domain_from_sentiment_report(self):
        from app.infrastructure.graph.nodes.citation_validation_node import citation_validation_node

        result = citation_validation_node(
            {
                "final_report": "Claim is supported. [Src: example.com | Sent: Neutral | verified].",
                "source_urls": ["https://example.com/source-1"],
                "collected_data": [{"title": "Source 1", "url": "https://example.com/source-1"}],
                "cycle_trace": [],
            }
        )

        validation = result["citation_validation"]
        self.assertTrue(validation["passed"])
        self.assertEqual(validation["unsupported_source_titles"], [])

    def test_citation_validation_flags_unknown_src_domain(self):
        from app.infrastructure.graph.nodes.citation_validation_node import citation_validation_node

        result = citation_validation_node(
            {
                "final_report": "Claim needs review. [Src: unknown.test | Sent: Negative | unverified].",
                "source_urls": ["https://example.com/source-1"],
                "collected_data": [{"title": "Source 1", "url": "https://example.com/source-1"}],
                "cycle_trace": [],
            }
        )

        validation = result["citation_validation"]
        self.assertFalse(validation["passed"])
        self.assertEqual(validation["unsupported_source_titles"], ["unknown.test"])

    def test_query_generation_caps_search_budget(self):
        from app.infrastructure.graph.nodes.query_gen_node import query_gen_node

        old_max = settings.RAG_MAX_SEARCH_QUERIES
        settings.RAG_MAX_SEARCH_QUERIES = 3
        try:
            result = query_gen_node(
                {
                    "place": "test place",
                    "monitoring_window": "past 24 hours",
                    "prioritize_themes": ["roads", "water", "power"],
                    "knowledge_gaps": [],
                    "iteration": 0,
                    "cycle_trace": [],
                }
            )
        finally:
            settings.RAG_MAX_SEARCH_QUERIES = old_max

        self.assertEqual(len(result["search_queries"]), 3)

    def test_query_generation_diversifies_single_broad_theme(self):
        from app.infrastructure.graph.nodes.query_gen_node import query_gen_node

        result = query_gen_node(
            {
                "place": "Baguio City",
                "monitoring_window": "past 24 hours",
                "prioritize_themes": ["environmental"],
                "knowledge_gaps": [],
                "iteration": 0,
                "runtime_options": {
                    "queries_per_theme": 4,
                    "max_search_queries": 6,
                },
                "cycle_trace": [],
            }
        )

        queries = result["search_queries"]
        self.assertEqual(len(queries), 4)
        self.assertEqual(len(set(queries)), 4)
        for query in queries:
            self.assertIn("Baguio City", query)
            self.assertIn("environmental", query)
            self.assertIn("past 24 hours", query)

        joined = " ".join(queries)
        self.assertIn("official updates", joined)
        self.assertIn("local news", joined)
        self.assertIn("programs projects", joined)
        self.assertIn("incidents advisories", joined)

    def test_insight_prompt_uses_structured_sentiment_report_contract(self):
        from app.infrastructure.graph.nodes.insight_node import SYSTEM_PROMPT

        expected_terms = [
            "overall_label",
            "source_signals",
            "source_index",
            "actionable_insights",
            "MISINFO",
        ]
        for term in expected_terms:
            self.assertIn(term, SYSTEM_PROMPT)
        self.assertIn("must not be capped", SYSTEM_PROMPT)
        self.assertNotIn("3-6 source-backed findings", SYSTEM_PROMPT)
        self.assertNotIn("5-8 source-backed findings", SYSTEM_PROMPT)

        removed_sections = [
            "METHODOLOGY",
            "CONCLUSION",
            "ITERATION NOTES",
        ]
        for section in removed_sections:
            self.assertNotIn(section, SYSTEM_PROMPT)

    def test_sentiment_report_renderer_outputs_required_format(self):
        from app.infrastructure.graph.nodes.insight_node import (
            SentimentReportDraft,
            build_sentiment_report,
            render_sentiment_report,
        )

        state = {
            "sentiment_label": "Mixed",
            "sentiment_scores": {"negative": 0.54, "neutral": 0.31, "positive": 0.15},
            "sentiment": "Mixed signal with clear source caveats.",
            "credibility": "Overall credibility rating: Medium.",
            "collected_data": [
                {
                    "title": "Source 1",
                    "url": "https://example.com/source-1",
                    "content": "Evidence-backed public health signal.",
                }
            ],
        }
        draft = SentimentReportDraft(
            overall_label="Mixed Sentiment",
            overview="Signals are mixed across the evidence pool.",
            source_signals=[
                {
                    "source_index": 1,
                    "summary": "Source 1 reports a public health signal",
                    "sentiment": "Negative",
                    "verification": "verified",
                    "credibility": "Moderate",
                }
            ],
            actionable_insights=["Verify the negative signal with an official update"],
        )

        report = build_sentiment_report(state, draft)
        rendered = render_sentiment_report(report)

        self.assertTrue(rendered.startswith("OVERALL SENTIMENT\nUpdated moments ago\nNegative Sentiment"))
        self.assertIn("[Src: example.com | Sent: Negative | verified]", rendered)
        self.assertIn("ACTIONABLE INSIGHTS", rendered)
        self.assertEqual(report["source_signals"][0]["credibility"], "Moderate")
        self.assertEqual(report["source_signals"][0]["credibility_score"], 70)
        self.assertEqual(report["metrics"]["negative_pct"], 100)
        self.assertEqual(report["metrics"]["neutral_pct"], 0)
        self.assertEqual(report["metrics"]["positive_pct"], 0)

    def test_sentiment_report_metrics_follow_source_signal_sentiment(self):
        from app.infrastructure.graph.nodes.insight_node import SentimentReportDraft, build_sentiment_report

        state = {
            "sentiment_label": "Neutral",
            "sentiment_scores": {"negative": 0.2, "neutral": 0.6, "positive": 0.2},
            "sentiment": "Model-level sentiment is neutral.",
            "credibility": "Overall credibility rating: Medium.",
            "collected_data": [
                {
                    "title": f"Source {index}",
                    "url": f"https://example.com/source-{index}",
                    "content": f"Evidence-backed signal {index}.",
                }
                for index in range(1, 6)
            ],
        }
        draft = SentimentReportDraft(
            overall_label="Positive Sentiment",
            overview="Most source-level signals are positive.",
            source_signals=[
                {
                    "source_index": index,
                    "summary": f"Positive signal {index}",
                    "sentiment": "Positive",
                    "verification": "verified",
                    "credibility": "Moderate",
                }
                for index in range(1, 5)
            ]
            + [
                {
                    "source_index": 5,
                    "summary": "Neutral signal 5",
                    "sentiment": "Neutral",
                    "verification": "verified",
                    "credibility": "Moderate",
                }
            ],
            actionable_insights=["Compare source-level sentiment before publishing"],
        )

        report = build_sentiment_report(state, draft)

        self.assertEqual(report["overall_label"], "Positive Sentiment")
        self.assertEqual(report["metrics"]["positive_pct"], 80)
        self.assertEqual(report["metrics"]["neutral_pct"], 20)
        self.assertEqual(report["metrics"]["negative_pct"], 0)

    def test_sentiment_report_tops_up_short_signal_drafts_to_all_sources(self):
        from app.infrastructure.graph.nodes.insight_node import (
            SentimentReportDraft,
            build_sentiment_report,
        )

        state = {
            "sentiment_label": "Mixed",
            "sentiment_scores": {"negative": 0.4, "neutral": 0.4, "positive": 0.2},
            "sentiment": "Mixed signal with source-specific caveats.",
            "credibility": "Overall credibility rating: Medium.",
            "collected_data": [
                {
                    "title": f"Source {index}",
                    "url": f"https://example.com/source-{index}",
                    "content": f"Evidence-backed signal {index}.",
                }
                for index in range(1, 7)
            ],
        }
        draft = SentimentReportDraft(
            overall_label="Mixed Sentiment",
            overview="Signals are mixed across the evidence pool.",
            source_signals=[
                {
                    "source_index": index,
                    "summary": f"Draft signal {index}",
                    "sentiment": "Neutral",
                    "verification": "verified",
                    "credibility": "Moderate",
                }
                for index in range(1, 4)
            ],
            actionable_insights=["Compare each signal against official updates"],
        )

        report = build_sentiment_report(state, draft)

        self.assertEqual(report["metrics"]["signal_count"], 6)
        self.assertEqual(len(report["source_signals"]), 6)
        self.assertEqual(report["source_signals"][0]["summary"], "Draft signal 1")
        self.assertEqual(report["source_signals"][3]["title"], "Source 4")
        self.assertEqual(report["source_signals"][4]["title"], "Source 5")
        self.assertEqual(report["source_signals"][5]["title"], "Source 6")

    def test_sentiment_report_is_not_capped_to_catalog_or_report_limit(self):
        from app.infrastructure.graph.nodes.insight_node import SentimentReportDraft, build_sentiment_report

        report = build_sentiment_report(
            {
                "sentiment_label": "Neutral",
                "sentiment_scores": {"negative": 0.1, "neutral": 0.8, "positive": 0.1},
                "sentiment": "Source pool is broad and mostly neutral.",
                "credibility": "Overall credibility rating: Medium.",
                "collected_data": [
                    {
                        "title": f"Source {index}",
                        "url": f"https://example.com/source-{index}",
                        "content": f"Evidence-backed signal {index}.",
                    }
                    for index in range(1, 13)
                ],
            },
            SentimentReportDraft(
                overall_label="Neutral Sentiment",
                overview="All collected sources should be represented.",
                source_signals=[
                    {
                        "source_index": 1,
                        "summary": "Draft signal 1",
                        "sentiment": "Neutral",
                        "verification": "verified",
                        "credibility": "Moderate",
                    }
                ],
                actionable_insights=["Review all collected source signals"],
            ),
        )

        self.assertEqual(report["metrics"]["signal_count"], 12)
        self.assertEqual(len(report["source_signals"]), 12)
        self.assertEqual(report["source_signals"][0]["title"], "Source 1")
        self.assertEqual(report["source_signals"][11]["title"], "Source 12")

    def test_parallel_source_signal_generation_keeps_failed_sources(self):
        from app.infrastructure.graph.nodes.insight_node import (
            _generate_source_signal_drafts,
            _source_catalog,
        )

        class SourceSignalStructuredLLM:
            def __init__(self, schema):
                self.schema = schema

            def invoke(self, messages):
                content = messages[1].content
                source_index = 0
                for line in content.split("\n"):
                    if line.startswith("Source index:"):
                        source_index = int(line.replace("Source index:", "").strip())
                        break
                if source_index == 2:
                    raise RuntimeError("source signal failed")
                return self.schema(
                    summary=f"LLM signal {source_index}",
                    sentiment="Positive",
                    verification="verified",
                    credibility="High",
                )

        class SourceSignalLLM:
            def with_structured_output(self, schema):
                return SourceSignalStructuredLLM(schema)

        state = {
            "place": "Philippines",
            "monitoring_window": "past 24 hours",
            "prioritize_themes": ["Transportation & Infrastructure"],
            "focus_terms": [],
            "sentiment": "Overall signal is improving.",
            "sentiment_label": "Positive",
            "credibility": "Overall credibility rating: Medium.",
        }
        catalog = _source_catalog(
            [
                {
                    "title": f"Source {index}",
                    "url": f"https://example.com/source-{index}",
                    "content": f"Evidence-backed signal {index}.",
                }
                for index in range(1, 4)
            ]
        )

        drafts, errors = _generate_source_signal_drafts(SourceSignalLLM(), state, catalog)

        self.assertEqual(len(drafts), 3)
        self.assertEqual([draft.source_index for draft in drafts], [1, 2, 3])
        self.assertEqual(drafts[0].summary, "LLM signal 1")
        self.assertEqual(drafts[1].summary, "Evidence-backed signal 2.")
        self.assertEqual(drafts[2].summary, "LLM signal 3")
        self.assertEqual(len(errors), 1)
        self.assertIn("2: source signal failed", errors[0])

    def test_sentiment_report_metrics_sum_to_100_after_rounding(self):
        from app.infrastructure.graph.nodes.insight_node import SentimentReportDraft, build_sentiment_report

        report = build_sentiment_report(
            {
                "sentiment_label": "Neutral",
                "sentiment_scores": {"negative": 1, "neutral": 1, "positive": 1},
                "collected_data": [],
                "sentiment": "",
                "credibility": "",
            },
            SentimentReportDraft(overall_label="Neutral Sentiment"),
        )

        metrics = report["metrics"]
        self.assertEqual(
            metrics["negative_pct"] + metrics["neutral_pct"] + metrics["positive_pct"],
            100,
        )

    def test_collect_handles_no_search_results_without_crashing(self):
        from app.infrastructure.graph.nodes.collect_node import collect_node

        with patch("app.infrastructure.graph.nodes.collect_node.search", return_value={"results": []}):
            result = collect_node(
                {
                    "search_queries": ["test place infrastructure past 24 hours"],
                    "monitoring_window": "past 24 hours",
                    "collected_data": [],
                    "cycle_trace": [],
                }
            )

        self.assertEqual(result["iteration"], 1)
        self.assertEqual(result["collected_data"], [])
        self.assertEqual(result["evidence_text"], "")


class SentimentEnsembleTests(unittest.TestCase):
    def test_normalize_scores_fills_missing_labels_and_normalizes(self):
        from app.infrastructure.graph.nodes.sentiment_ensemble import normalize_scores

        scores = normalize_scores({"negative": 2, "positive": 2})

        self.assertAlmostEqual(scores["negative"], 0.5)
        self.assertAlmostEqual(scores["neutral"], 0.0)
        self.assertAlmostEqual(scores["positive"], 0.5)

    def test_blend_sentiment_assessment_uses_40_60_weights(self):
        from app.infrastructure.graph.nodes import sentiment_ensemble

        with patch.object(
            sentiment_ensemble,
            "infer_roberta_sentiment",
            return_value={"negative": 1.0, "neutral": 0.0, "positive": 0.0},
        ):
            result = sentiment_ensemble.blend_sentiment_assessment(
                "Evidence",
                {"negative": 0.0, "neutral": 0.0, "positive": 1.0},
            )

        self.assertAlmostEqual(result.blended_scores["negative"], 0.4)
        self.assertAlmostEqual(result.blended_scores["neutral"], 0.0)
        self.assertAlmostEqual(result.blended_scores["positive"], 0.6)
        self.assertEqual(result.label, "Positive")
        self.assertEqual(result.weights, {"roberta": 0.4, "llm": 0.6})

    def test_classify_sentiment_scores_marks_close_polar_scores_as_mixed(self):
        from app.infrastructure.graph.nodes.sentiment_ensemble import classify_sentiment_scores

        label = classify_sentiment_scores(
            {"negative": 0.37, "neutral": 0.20, "positive": 0.43}
        )

        self.assertEqual(label, "Mixed")

    def test_roberta_failure_falls_back_to_llm_scores(self):
        from app.infrastructure.graph.nodes import sentiment_ensemble

        with patch.object(
            sentiment_ensemble,
            "infer_roberta_sentiment",
            side_effect=RuntimeError("model unavailable"),
        ):
            result = sentiment_ensemble.blend_sentiment_assessment(
                "Evidence",
                {"negative": 0.1, "neutral": 0.1, "positive": 0.8},
            )

        self.assertEqual(result.label, "Positive")
        self.assertEqual(result.roberta_scores, None)
        self.assertEqual(result.roberta_error, "model unavailable")
        self.assertEqual(result.weights, {"roberta": 0.0, "llm": 1.0})
        self.assertAlmostEqual(result.blended_scores["positive"], 0.8)


if __name__ == "__main__":
    unittest.main()
