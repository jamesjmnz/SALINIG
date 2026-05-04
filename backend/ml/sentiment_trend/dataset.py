"""
Load and prepare the sentiment time-series dataset from Qdrant.

Data source: learning notes stored by save_node, each carrying
sentiment_scores {negative, neutral, positive} and a created_at timestamp.
"""

from __future__ import annotations

import logging
from typing import Any

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# Minimum real rows required before falling back to synthetic data
MIN_REAL_ROWS = 5


def scroll_learning_notes(
    place: str | None = None,
    themes: list[str] | None = None,
) -> list[dict[str, Any]]:
    """Return all learning-note payloads from Qdrant (no vector needed)."""
    from app.core.config import settings
    from app.infrastructure.memory.qdrant_memory import _get_client

    client = _get_client()
    records: list[Any] = []
    offset = None

    while True:
        batch, next_offset = client.scroll(
            collection_name=settings.QDRANT_COLLECTION,
            limit=200,
            offset=offset,
            with_payload=True,
            with_vectors=False,
        )
        records.extend(batch)
        if next_offset is None:
            break
        offset = next_offset

    rows = []
    for point in records:
        payload = point.payload or {}
        if payload.get("memory_type") != "learning_note":
            continue
        if place and payload.get("place") != place:
            continue
        if themes and not any(t in (payload.get("prioritize_themes") or []) for t in themes):
            continue
        rows.append(payload)

    logger.info("scroll_learning_notes — found %d matching notes", len(rows))
    return rows


def build_sentiment_dataframe(records: list[dict[str, Any]]) -> pd.DataFrame:
    """
    Extract sentiment time series from note payloads.
    Rows without sentiment_scores are skipped (pre-enrichment notes).
    """
    rows = []
    for payload in records:
        created_str = payload.get("created_at")
        sentiment = payload.get("sentiment_scores") or {}
        if not created_str or not sentiment:
            continue
        try:
            ts = pd.to_datetime(created_str, utc=True)
        except Exception:
            continue
        rows.append(
            {
                "created_at": ts,
                "negative": float(sentiment.get("negative", 0.0)),
                "neutral": float(sentiment.get("neutral", 0.0)),
                "positive": float(sentiment.get("positive", 0.0)),
                "quality_score": float(payload.get("quality_score", 0.0)),
            }
        )

    if not rows:
        return pd.DataFrame(columns=["created_at", "negative", "neutral", "positive", "quality_score"])

    df = pd.DataFrame(rows).sort_values("created_at").reset_index(drop=True)
    return df


def resample_daily(df: pd.DataFrame) -> pd.DataFrame:
    """Aggregate multiple notes per day into a single daily mean."""
    if df.empty:
        return df
    return (
        df.set_index("created_at")
        .resample("D")[["negative", "neutral", "positive", "quality_score"]]
        .mean()
        .dropna(how="all")
        .reset_index()
    )


def build_lag_features(
    series: np.ndarray, window: int
) -> tuple[np.ndarray, np.ndarray]:
    """
    Convert a 1-D time series into (X, y) lag pairs.

    For window=3: X[i] = [t-3, t-2, t-1], y[i] = t
    Requires len(series) > window.
    """
    if len(series) <= window:
        raise ValueError(f"Series too short: need >{window} points, got {len(series)}")
    X = np.array([series[i : i + window] for i in range(len(series) - window)])
    y = series[window:]
    return X, y


# ---------------------------------------------------------------------------
# Synthetic data fallback (demo / thesis presentations)
# ---------------------------------------------------------------------------

def _synthetic_sentiment_series(n_days: int = 45, seed: int = 42) -> pd.DataFrame:
    """
    Generate a realistic-looking synthetic sentiment time series.
    Useful when Qdrant has fewer than MIN_REAL_ROWS enriched notes.
    """
    rng = np.random.default_rng(seed)
    dates = pd.date_range(
        end=pd.Timestamp.now(tz="UTC").normalize(), periods=n_days, freq="D"
    )

    # Simulate a base positive-skewed distribution with a mid-period spike in negativity
    t = np.linspace(0, 2 * np.pi, n_days)
    negative = np.clip(0.25 + 0.12 * np.sin(t) + rng.normal(0, 0.04, n_days), 0, 1)
    # inject a spike around day 20
    negative[18:22] = np.clip(negative[18:22] + 0.25, 0, 1)

    total = negative + 0.35 + rng.uniform(0.1, 0.2, n_days)
    neutral = np.clip(0.35 + rng.normal(0, 0.03, n_days), 0, 1 - negative)
    positive = np.clip(1 - negative - neutral, 0, 1)

    return pd.DataFrame(
        {
            "created_at": dates,
            "negative": negative,
            "neutral": neutral,
            "positive": positive,
            "quality_score": np.clip(0.75 + rng.normal(0, 0.06, n_days), 0.7, 1.0),
        }
    )


def load_sentiment_series(
    place: str | None = None,
    themes: list[str] | None = None,
    allow_synthetic: bool = True,
) -> tuple[pd.DataFrame, bool]:
    """
    Return (df, is_synthetic).
    Falls back to synthetic data when real records are insufficient.
    """
    try:
        records = scroll_learning_notes(place=place, themes=themes)
        df = resample_daily(build_sentiment_dataframe(records))
    except Exception as exc:
        logger.warning("Qdrant unavailable — using synthetic data: %s", exc)
        df = pd.DataFrame()

    if len(df) >= MIN_REAL_ROWS:
        return df, False

    if allow_synthetic:
        logger.warning(
            "Only %d real rows (need %d) — padding with synthetic data for demo",
            len(df),
            MIN_REAL_ROWS,
        )
        synthetic = _synthetic_sentiment_series()
        if not df.empty:
            synthetic = pd.concat([synthetic, df], ignore_index=True).sort_values("created_at")
        return synthetic, True

    return df, False
