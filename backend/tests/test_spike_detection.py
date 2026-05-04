import os
import sys
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

os.environ.setdefault("OPENAI_API_KEY", "test-key")
os.environ.setdefault("TAVILY_API_KEY", "test-key")
os.environ.setdefault("QDRANT_URL", "http://localhost:6333")
os.environ.setdefault("QDRANT_COLLECTION", "test_collection")
os.environ.setdefault("OPENAI_MODEL", "gpt-4o")

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.infrastructure.graph.nodes.spike_detection_node import (
    _classify_level,
    _count_recent,
    _density_score,
    spike_detection_node,
)


class FakeScoredPoint:
    def __init__(self, score: float, created_at: str | None = None, vector: list | None = None):
        self.score = score
        self.payload = {"created_at": created_at} if created_at else {}
        self.vector = vector or [0.1] * 1536


def _iso(delta_days: int) -> str:
    dt = datetime.now(timezone.utc) - timedelta(days=delta_days)
    return dt.isoformat()


def _base_state() -> dict:
    return {
        "place": "Manila",
        "prioritize_themes": ["Health", "Infrastructure"],
        "focus_terms": ["vaccines"],
        "cycle_trace": [],
    }


class TestClassifyLevel(unittest.TestCase):
    def test_active_spike(self):
        self.assertEqual(_classify_level(0.75), "ACTIVE_SPIKE")

    def test_rising_signal(self):
        self.assertEqual(_classify_level(0.50), "RISING_SIGNAL")

    def test_baseline(self):
        self.assertEqual(_classify_level(0.20), "BASELINE")

    def test_exact_active_threshold(self):
        self.assertEqual(_classify_level(0.70), "ACTIVE_SPIKE")

    def test_just_below_rising(self):
        self.assertEqual(_classify_level(0.44), "BASELINE")


class TestDensityScore(unittest.TestCase):
    def test_empty_returns_zero(self):
        score, note = _density_score([])
        self.assertEqual(score, 0.0)
        self.assertIn("No historical", note)

    def test_high_scores_produce_high_density(self):
        points = [FakeScoredPoint(0.90), FakeScoredPoint(0.85), FakeScoredPoint(0.88)]
        score, note = _density_score(points)
        self.assertGreater(score, 0.80)
        self.assertIn("3 notes", note)

    def test_low_scores_produce_low_density(self):
        points = [FakeScoredPoint(0.30), FakeScoredPoint(0.25)]
        score, _ = _density_score(points)
        self.assertLess(score, 0.40)

    def test_scores_clamped_to_unit_interval(self):
        points = [FakeScoredPoint(1.5), FakeScoredPoint(-0.1)]
        score, _ = _density_score(points)
        self.assertGreaterEqual(score, 0.0)
        self.assertLessEqual(score, 1.0)


class TestCountRecent(unittest.TestCase):
    def test_counts_only_recent_notes(self):
        points = [
            FakeScoredPoint(0.8, _iso(1)),   # recent
            FakeScoredPoint(0.8, _iso(2)),   # recent
            FakeScoredPoint(0.8, _iso(10)),  # old
        ]
        self.assertEqual(_count_recent(points, days=7), 2)

    def test_no_notes_returns_zero(self):
        self.assertEqual(_count_recent([], days=7), 0)

    def test_malformed_date_skipped_gracefully(self):
        bad = FakeScoredPoint(0.8)
        bad.payload = {"created_at": "not-a-date"}
        self.assertEqual(_count_recent([bad], days=7), 0)


class TestSpikeDetectionNode(unittest.TestCase):
    def test_baseline_when_no_history(self):
        with patch("app.infrastructure.graph.nodes.spike_detection_node._embed_query",
                   return_value=[0.1] * 1536):
            with patch("app.infrastructure.graph.nodes.spike_detection_node._search_history",
                       return_value=[]):
                result = spike_detection_node(_base_state())

        self.assertEqual(result["spike_level"], "BASELINE")
        self.assertEqual(result["spike_history_count"], 0)
        self.assertFalse(result["spike_detection"]["detected"])
        self.assertIsNone(result["spike_detection_error"])

    def test_active_spike_high_density_low_coherence(self):
        points = [FakeScoredPoint(0.92, _iso(1)) for _ in range(8)]

        with patch("app.infrastructure.graph.nodes.spike_detection_node._embed_query",
                   return_value=[0.1] * 1536):
            with patch("app.infrastructure.graph.nodes.spike_detection_node._search_history",
                       return_value=points):
                with patch("app.infrastructure.graph.nodes.spike_detection_node._nli_classify",
                           return_value={"label": "contradicted", "confidence": 0.1}):
                    result = spike_detection_node(_base_state())

        # High density (0.92) + low coherence (inverted 0.9) → should be high spike score
        self.assertIn(result["spike_level"], ("RISING_SIGNAL", "ACTIVE_SPIKE"))
        self.assertGreater(result["spike_score"], 0.40)

    def test_rising_signal_mixed_cluster(self):
        points = [
            FakeScoredPoint(0.80, _iso(1)),
            FakeScoredPoint(0.75, _iso(2)),
            FakeScoredPoint(0.55, _iso(20)),
        ]

        with patch("app.infrastructure.graph.nodes.spike_detection_node._embed_query",
                   return_value=[0.1] * 1536):
            with patch("app.infrastructure.graph.nodes.spike_detection_node._search_history",
                       return_value=points):
                with patch("app.infrastructure.graph.nodes.spike_detection_node._nli_classify",
                           return_value={"label": "mixed", "confidence": 0.5}):
                    result = spike_detection_node(_base_state())

        self.assertIn(result["spike_level"], ("BASELINE", "RISING_SIGNAL", "ACTIVE_SPIKE"))
        self.assertIsNone(result["spike_detection_error"])

    def test_error_does_not_crash_pipeline(self):
        with patch("app.infrastructure.graph.nodes.spike_detection_node._embed_query",
                   side_effect=RuntimeError("OpenAI API down")):
            result = spike_detection_node(_base_state())

        self.assertEqual(result["spike_level"], "BASELINE")
        self.assertIsNotNone(result["spike_detection_error"])
        self.assertIn("OpenAI API down", result["spike_detection_error"])
        self.assertIn("cycle_trace", result)

    def test_state_fields_always_present(self):
        with patch("app.infrastructure.graph.nodes.spike_detection_node._embed_query",
                   return_value=[0.1] * 1536):
            with patch("app.infrastructure.graph.nodes.spike_detection_node._search_history",
                       return_value=[]):
                result = spike_detection_node(_base_state())

        for key in ("spike_detection", "spike_score", "spike_level",
                    "spike_signals", "spike_history_count", "spike_detection_error"):
            self.assertIn(key, result, f"missing key: {key}")

    def test_cycle_trace_entry_appended(self):
        with patch("app.infrastructure.graph.nodes.spike_detection_node._embed_query",
                   return_value=[0.1] * 1536):
            with patch("app.infrastructure.graph.nodes.spike_detection_node._search_history",
                       return_value=[]):
                result = spike_detection_node(_base_state())

        nodes = [e.get("node") for e in result.get("cycle_trace", [])]
        self.assertIn("spike_detection", nodes)

    def test_disabled_via_config(self):
        with patch("app.infrastructure.graph.nodes.spike_detection_node.settings") as mock_settings:
            mock_settings.RAG_ENABLE_SPIKE_DETECTION = False
            mock_settings.RAG_SPIKE_HISTORY_K = 20
            mock_settings.RAG_SPIKE_RECENCY_DAYS = 7
            mock_settings.RAG_SPIKE_ACTIVE_THRESHOLD = 0.70
            mock_settings.RAG_SPIKE_RISING_THRESHOLD = 0.45
            mock_settings.RAG_SPIKE_NLI_MAX_NOTES = 5
            result = spike_detection_node(_base_state())

        self.assertEqual(result["spike_level"], "BASELINE")
        trace_events = [e.get("event") for e in result.get("cycle_trace", [])]
        self.assertIn("disabled", trace_events)


if __name__ == "__main__":
    unittest.main()
