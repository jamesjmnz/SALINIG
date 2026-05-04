"""
Train sentiment trend regression models and persist them with joblib.

Usage (run from backend/):
    ../backend/venv/bin/python -m ml.sentiment_trend.train
    ../backend/venv/bin/python -m ml.sentiment_trend.train --rf --window 5

Models are saved to ml/models/sentiment_{label}_w{window}.joblib
"""

from __future__ import annotations

import argparse
import json
import logging
from pathlib import Path

import joblib
import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error

from ml.sentiment_trend.dataset import build_lag_features, load_sentiment_series

logger = logging.getLogger(__name__)

MODELS_DIR = Path(__file__).resolve().parents[1] / "models"
SENTIMENT_LABELS = ("negative", "neutral", "positive")


def model_path(label: str, window: int) -> Path:
    return MODELS_DIR / f"sentiment_{label}_w{window}.joblib"


def train(
    window: int = 3,
    use_rf: bool = False,
    place: str | None = None,
    themes: list[str] | None = None,
) -> dict[str, dict]:
    """
    Train a LinearRegression (default) or RandomForestRegressor on sentiment
    time series from Qdrant. Persists each label's model to ml/models/.

    Returns evaluation metrics per sentiment label.
    """
    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    df, is_synthetic = load_sentiment_series(place=place, themes=themes)

    if df.empty:
        raise RuntimeError("No data available for training.")

    logger.info(
        "Training on %d daily rows (synthetic=%s), window=%d, rf=%s",
        len(df), is_synthetic, window, use_rf,
    )

    results: dict[str, dict] = {}
    model_name = "RandomForestRegressor" if use_rf else "LinearRegression"

    for label in SENTIMENT_LABELS:
        series = df[label].values.astype(float)

        if len(series) <= window:
            logger.warning("Skipping %s: only %d points (need >%d)", label, len(series), window)
            continue

        X, y = build_lag_features(series, window)

        # 80 / 20 train-test split (time-ordered, no shuffle)
        split = max(1, int(len(X) * 0.8))
        X_train, X_test = X[:split], X[split:]
        y_train, y_test = y[:split], y[split:]

        model: LinearRegression | RandomForestRegressor
        if use_rf:
            model = RandomForestRegressor(n_estimators=100, random_state=42, n_jobs=-1)
        else:
            model = LinearRegression()

        model.fit(X_train, y_train)

        metrics: dict[str, float | int | str] = {
            "model": model_name,
            "n_train": int(len(X_train)),
            "n_test": int(len(X_test)),
            "window": window,
            "is_synthetic": is_synthetic,
        }

        if len(X_test) > 0:
            y_pred = model.predict(X_test)
            metrics["mae"] = round(float(mean_absolute_error(y_test, y_pred)), 6)
            metrics["rmse"] = round(float(np.sqrt(mean_squared_error(y_test, y_pred))), 6)
        else:
            metrics["mae"] = None
            metrics["rmse"] = None
            logger.warning("%s: test set empty, no evaluation metrics", label)

        path = model_path(label, window)
        joblib.dump({"model": model, "window": window, "label": label, "meta": metrics}, path)
        logger.info("Saved %s → %s (mae=%.4f)", label, path.name, metrics.get("mae") or 0)

        results[label] = metrics

    return results


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s – %(message)s")

    parser = argparse.ArgumentParser(description="Train SALINIG sentiment trend models")
    parser.add_argument("--window", type=int, default=3, help="Lag window size (default 3)")
    parser.add_argument("--rf", action="store_true", help="Use RandomForestRegressor instead of LinearRegression")
    parser.add_argument("--place", default=None, help="Filter by place (e.g. Manila)")
    parser.add_argument("--themes", nargs="*", default=None, help="Filter by themes")
    args = parser.parse_args()

    results = train(window=args.window, use_rf=args.rf, place=args.place, themes=args.themes)
    print(json.dumps(results, indent=2))
