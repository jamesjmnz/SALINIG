"""
Predict topic frequency spikes.

Training: fit a LinearRegression (or RF) per topic on lag features,
persist with joblib. Inference: load model, predict next count, alert
if predicted > current * spike_threshold.

Usage:
    # Train (run from backend/)
    ../backend/venv/bin/python -m ml.topic_trend.predict --train

    # Predict
    from ml.topic_trend.predict import predict_topic_spikes
    results = predict_topic_spikes()
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import joblib
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error

from ml.topic_trend.aggregator import load_topic_frequency
from ml.sentiment_trend.dataset import build_lag_features

logger = logging.getLogger(__name__)

MODELS_DIR = Path(__file__).resolve().parents[1] / "models"
_TOPIC_CACHE: dict[tuple[int, bool], dict[str, Any]] = {}


def _topic_model_path(topic: str, window: int) -> Path:
    safe = topic.replace(" ", "_").replace("/", "-")[:40]
    return MODELS_DIR / f"topic_{safe}_w{window}.joblib"


def train_topic_models(
    window: int = 3,
    use_rf: bool = False,
    place: str | None = None,
    themes: list[str] | None = None,
    top_n: int = 15,
    spike_threshold: float = 1.5,
) -> dict[str, Any]:
    """
    Train one regression model per topic and persist to ml/models/.
    Returns training metrics and topic list.
    """
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    freq_df, topics, is_synthetic = load_topic_frequency(
        place=place, themes=themes, top_n=top_n
    )

    if freq_df.empty or len(freq_df) <= window:
        raise RuntimeError(f"Not enough time windows for training (have {len(freq_df)}, need >{window})")

    results: dict[str, Any] = {"is_synthetic": is_synthetic, "topics": topics, "models": {}}
    model_type = "RandomForestRegressor" if use_rf else "LinearRegression"

    for topic in topics:
        if topic not in freq_df.columns:
            continue
        series = freq_df[topic].values.astype(float)

        try:
            X, y = build_lag_features(series, window)
        except ValueError:
            continue

        split = max(1, int(len(X) * 0.8))
        X_tr, X_te = X[:split], X[split:]
        y_tr, y_te = y[:split], y[split:]

        model: LinearRegression | RandomForestRegressor
        if use_rf:
            model = RandomForestRegressor(n_estimators=100, random_state=42, n_jobs=-1)
        else:
            model = LinearRegression()
        model.fit(X_tr, y_tr)

        metrics: dict[str, Any] = {"model": model_type, "n_train": len(X_tr)}
        if len(X_te) > 0:
            preds = model.predict(X_te)
            metrics["mae"] = round(float(mean_absolute_error(y_te, preds)), 4)
            metrics["rmse"] = round(float(np.sqrt(mean_squared_error(y_te, preds))), 4)
        else:
            metrics["mae"] = None
            metrics["rmse"] = None

        artifact = {"model": model, "window": window, "topic": topic, "meta": metrics}
        joblib.dump(artifact, _topic_model_path(topic, window))
        results["models"][topic] = metrics
        logger.info("Trained topic=%s mae=%s", topic, metrics.get("mae"))

    return results


def predict_topic_spikes(
    window: int = 3,
    place: str | None = None,
    themes: list[str] | None = None,
    top_n: int = 15,
    spike_threshold: float = 1.5,
    alert_threshold: float = 0.10,
) -> list[dict[str, Any]]:
    """
    Predict next-window topic counts and flag spikes.

    spike_threshold: predicted/current ratio that triggers an ALERT
    alert_threshold: minimum current frequency to avoid noise alerts (absolute count)

    Returns a list of dicts sorted by spike risk (highest first).
    """
    freq_df, topics, is_synthetic = load_topic_frequency(
        place=place, themes=themes, top_n=top_n
    )

    if freq_df.empty or len(freq_df) < window:
        raise ValueError(f"Not enough time windows (have {len(freq_df)}, need {window})")

    output: list[dict[str, Any]] = []

    for topic in topics:
        if topic not in freq_df.columns:
            continue

        series = freq_df[topic].values.astype(float)

        # Attempt to load trained model
        model_path = _topic_model_path(topic, window)
        if not model_path.exists():
            # Fallback: use mean of last `window` values as naive forecast
            if len(series) < window:
                continue
            predicted = float(np.mean(series[-window:]))
            model_name = "naive_mean"
        else:
            artifact = joblib.load(model_path)
            model = artifact["model"]
            recent = series[-window:].reshape(1, -1)
            predicted = float(np.clip(model.predict(recent)[0], 0, None))
            model_name = artifact.get("meta", {}).get("model", "regression")

        current = float(series[-1])
        predicted = round(predicted, 4)

        ratio = (predicted / current) if current > alert_threshold else None
        spiking = (ratio is not None) and (ratio >= spike_threshold)

        alert = ""
        if spiking:
            alert = f"SPIKE: '{topic}' predicted {predicted:.1f} vs current {current:.1f} (×{ratio:.2f})"
        elif current > 0 and predicted < current * 0.5:
            alert = f"DROP: '{topic}' predicted to drop to {predicted:.1f} from {current:.1f}"

        output.append(
            {
                "topic": topic,
                "current": current,
                "predicted": predicted,
                "ratio": round(ratio, 3) if ratio is not None else None,
                "alert": alert,
                "model": model_name,
                "is_synthetic": is_synthetic,
            }
        )

    # Sort: spiking topics first, then by predicted count descending
    output.sort(key=lambda x: (not bool(x["alert"]), -x["predicted"]))
    return output


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import argparse, json
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s – %(message)s")

    parser = argparse.ArgumentParser()
    parser.add_argument("--train", action="store_true")
    parser.add_argument("--window", type=int, default=3)
    parser.add_argument("--rf", action="store_true")
    parser.add_argument("--top-n", type=int, default=15)
    parser.add_argument("--threshold", type=float, default=1.5)
    args = parser.parse_args()

    if args.train:
        result = train_topic_models(window=args.window, use_rf=args.rf, top_n=args.top_n)
        print(json.dumps({k: v for k, v in result.items() if k != "models"}, indent=2))
        print(json.dumps({"models_trained": len(result["models"])}, indent=2))
    else:
        spikes = predict_topic_spikes(window=args.window, top_n=args.top_n, spike_threshold=args.threshold)
        print(json.dumps(spikes[:10], indent=2))
