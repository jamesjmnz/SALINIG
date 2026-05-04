"""
Aggregate topic mention counts into time-windowed frequency series.

Each Qdrant learning note is one observation. We count how many notes
mention each topic in each time bucket (day by default).

Output: a DataFrame where columns are topic strings and each row
is a time bucket. This feeds directly into predict.py.
"""

from __future__ import annotations

import logging
from typing import Any

import numpy as np
import pandas as pd

from ml.topic_trend.extractor import ExtractionMode, extract_topics, score_text_for_topics

logger = logging.getLogger(__name__)


def _load_note_records(
    place: str | None = None,
    themes: list[str] | None = None,
) -> list[dict[str, Any]]:
    from ml.sentiment_trend.dataset import scroll_learning_notes
    return scroll_learning_notes(place=place, themes=themes)


def build_topic_frequency_df(
    records: list[dict[str, Any]],
    topics: list[str],
    freq: str = "D",
) -> pd.DataFrame:
    """
    Build a time-indexed DataFrame of topic mention counts.

    Columns: topics
    Index: time buckets (freq resolution — 'D' = daily, 'W' = weekly)
    Values: int count of notes mentioning each topic in that bucket
    """
    rows = []
    for payload in records:
        created_str = payload.get("created_at")
        text = payload.get("page_content") or ""
        if not created_str or not text:
            continue
        try:
            ts = pd.to_datetime(created_str, utc=True)
        except Exception:
            continue
        scores = score_text_for_topics(text, topics)
        rows.append({"created_at": ts, **scores})

    if not rows:
        return pd.DataFrame(columns=["created_at"] + topics)

    df = pd.DataFrame(rows).set_index("created_at")
    freq_df = df.resample(freq).sum().fillna(0).astype(int)
    return freq_df.reset_index()


def _synthetic_topic_counts(topics: list[str], n_days: int = 30) -> pd.DataFrame:
    """
    Generate synthetic topic frequency data for demo purposes.
    One topic gets an injected spike in the last 5 days.
    """
    rng = np.random.default_rng(7)
    dates = pd.date_range(
        end=pd.Timestamp.now(tz="UTC").normalize(), periods=n_days, freq="D"
    )
    data: dict[str, Any] = {"created_at": dates}
    for i, topic in enumerate(topics[:15]):  # cap at 15 for speed
        base = rng.integers(0, 3, n_days)
        if i == 0:
            # inject a spike in the last 5 periods
            base[-5:] = base[-5:] + rng.integers(3, 7, 5)
        data[topic] = base.tolist()
    return pd.DataFrame(data)


def load_topic_frequency(
    place: str | None = None,
    themes: list[str] | None = None,
    top_n: int = 15,
    mode: ExtractionMode = "tfidf",
    freq: str = "D",
    allow_synthetic: bool = True,
) -> tuple[pd.DataFrame, list[str], bool]:
    """
    Returns (freq_df, topics, is_synthetic).

    freq_df: time-indexed topic frequency DataFrame
    topics: ordered list of tracked topic strings
    is_synthetic: True if real data was insufficient
    """
    records = []
    try:
        records = _load_note_records(place=place, themes=themes)
    except Exception as exc:
        logger.warning("Qdrant unavailable for topic aggregation: %s", exc)

    texts = [r.get("page_content") or "" for r in records if r.get("page_content")]

    if len(texts) < 3 and allow_synthetic:
        logger.warning("Only %d note texts — using synthetic topic data", len(texts))
        # Extract topics from a placeholder corpus or use generic Philippine themes
        topics = [
            "infrastructure", "road construction", "flooding", "typhoon",
            "power outage", "public health", "vaccination", "crime rate",
            "transport strike", "rice prices", "fuel prices", "water supply",
            "garbage collection", "internet access", "traffic congestion",
        ][:top_n]
        df = _synthetic_topic_counts(topics, n_days=30)
        return df, topics, True

    topics = extract_topics(texts, top_n=top_n, mode=mode)
    if not topics:
        topics = ["general"]

    freq_df = build_topic_frequency_df(records, topics, freq=freq)
    return freq_df, topics, False
