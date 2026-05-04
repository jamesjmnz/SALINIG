"""
Load trained sentiment models and produce next-step predictions with spike alerts.

All models are loaded lazily and cached in-process so the API layer
does not reload from disk on every request.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import joblib
import numpy as np

from ml.sentiment_trend.dataset import load_sentiment_series

logger = logging.getLogger(__name__)

MODELS_DIR = Path(__file__).resolve().parents[1] / "models"
SENTIMENT_LABELS = ("negative", "neutral", "positive")

# In-process model cache: key = (label, window)
_model_cache: dict[tuple[str, int], dict[str, Any]] = {}


def _load_model(label: str, window: int) -> dict[str, Any]:
    key = (label, window)
    if key not in _model_cache:
        path = MODELS_DIR / f"sentiment_{label}_w{window}.joblib"
        if not path.exists():
            raise FileNotFoundError(
                f"Model not found: {path.name}. "
                "Run `python -m ml.sentiment_trend.train` first."
            )
        _model_cache[key] = joblib.load(path)
        logger.info("Loaded model: %s", path.name)
    return _model_cache[key]


def invalidate_cache() -> None:
    """Clear the in-process model cache (call after retraining)."""
    _model_cache.clear()


def predict_next_sentiment(
    window: int = 3,
    place: str | None = None,
    themes: list[str] | None = None,
    spike_threshold: float = 0.15,
) -> dict[str, Any]:
    """
    Predict the next sentiment values for all three labels.

    Returns a dict with current/predicted values, alert flags, and
    per-label confidence metrics from the model's training evaluation.

    spike_threshold: absolute increase in negative score that triggers an alert
    """
    df, is_synthetic = load_sentiment_series(place=place, themes=themes, allow_synthetic=True)

    if df.empty or len(df) < window:
        raise ValueError(
            f"Not enough data points (have {len(df)}, need {window}). "
            "Run more analyses first."
        )

    predictions: dict[str, Any] = {}
    alerts: list[str] = []

    for label in SENTIMENT_LABELS:
        artifact = _load_model(label, window)
        model = artifact["model"]
        meta = artifact.get("meta", {})

        recent = df[label].values[-window:].astype(float)
        predicted = float(model.predict(recent.reshape(1, -1))[0])
        predicted = float(np.clip(predicted, 0.0, 1.0))
        current = float(df[label].values[-1])

        change = predicted - current
        alert = ""
        if label == "negative" and change >= spike_threshold:
            alert = f"SPIKE: negative sentiment predicted to rise +{change:.1%}"
            alerts.append(alert)
        elif label == "positive" and change <= -spike_threshold:
            alert = f"DROP: positive sentiment predicted to fall {change:.1%}"
            alerts.append(alert)

        predictions[label] = {
            "current": round(current, 4),
            "predicted": round(predicted, 4),
            "change": round(change, 4),
            "alert": alert,
            "mae": meta.get("mae"),
            "rmse": meta.get("rmse"),
            "model": meta.get("model", "unknown"),
        }

    return {
        "window": window,
        "data_points": len(df),
        "is_synthetic": is_synthetic,
        "place": place,
        "themes": themes,
        "predictions": predictions,
        "alerts": alerts,
        "top_alert": alerts[0] if alerts else "No anomalies detected.",
    }
