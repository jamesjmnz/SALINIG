import os
import sys
import unittest
from contextlib import ExitStack
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

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

from app.domain.services.analysis_service import AnalysisService
from app.schemas.analysis_schema import AnalyzeRequest
from app.infrastructure.memory import qdrant_memory


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
        raise AssertionError(f"Unexpected structured schema {self.schema}")


class FakeLLM:
    def __init__(self, evaluations, learning_note="Durable cited learning"):
        self.evaluations = list(evaluations)
        self.learning_note = learning_note
        self.report_calls = 0

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
    def run_analysis(self, evaluations):
        fake_llm = FakeLLM(evaluations)
        search_calls = []
        saved = []

        def fake_search(query):
            search_calls.append(query)
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
            stack.enter_context(
                patch(
                    "app.infrastructure.graph.nodes.sentiment_ensemble.infer_roberta_sentiment",
                    return_value={"negative": 0.1, "neutral": 0.7, "positive": 0.2},
                )
            )

            response = AnalysisService().analyze(
                AnalyzeRequest(
                    place="test place",
                    monitoring_window="past 24 hours",
                    prioritize_themes=["infrastructure"],
                )
            )

        return response, search_calls, saved

    def test_success_path_saves_distilled_learning_and_returns_diagnostics(self):
        response, search_calls, saved = self.run_analysis(
            [evaluation(0.91, feedback="Strong report")]
        )

        self.assertTrue(response["quality_passed"])
        self.assertAlmostEqual(response["quality_score"], 0.91)
        self.assertEqual(response["iteration"], 1)
        self.assertTrue(response["memory_saved"])
        self.assertEqual(response["learning_note"], "Durable cited learning")
        self.assertEqual(len(saved), 1)
        self.assertEqual(len(search_calls), 2)
        self.assertIn("retrieved_memories", response)
        self.assertIn("knowledge_gaps", response)
        self.assertIn("quality_breakdown", response)
        self.assertIn("blocking_issues", response)
        self.assertIn("cycle_trace", response)
        self.assertIn("collected_sources", response)
        analysis_trace = next(
            entry for entry in response["cycle_trace"] if entry["node"] == "analysis"
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
        self.assertEqual(response["final_report"], "Report 1")
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
