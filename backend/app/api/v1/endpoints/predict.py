"""
Predictive ML endpoints.

POST /predict/train        — train sentiment + topic models from Qdrant data
POST /predict/sent-trend   — predict next sentiment values and flag spikes
POST /predict/topic-spike  — predict topic frequency spikes
POST /predict/risk-score   — composite risk score (sentiment + topic + credibility)
"""

import logging

from fastapi import APIRouter, HTTPException

from app.schemas.predict_schema import (
    RiskScoreRequest,
    RiskScoreResponse,
    SentimentTrendRequest,
    SentimentTrendResponse,
    SentimentLabelPrediction,
    TopicSpikeItem,
    TopicSpikeRequest,
    TopicSpikeResponse,
    TrainRequest,
    TrainResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter()


# ---------------------------------------------------------------------------
# /predict/train
# ---------------------------------------------------------------------------

@router.post("/train", response_model=TrainResponse)
def train_models(request: TrainRequest) -> TrainResponse:
    """
    Trigger offline training for both sentiment trend and topic spike models.
    Models are saved to ml/models/ with joblib and loaded on the next predict call.
    """
    from ml.sentiment_trend.train import train as train_sentiment
    from ml.sentiment_trend.predict import invalidate_cache
    from ml.topic_trend.predict import train_topic_models

    sentiment_metrics: dict = {}
    topic_metrics: dict = {}
    errors: list[str] = []

    try:
        sentiment_metrics = train_sentiment(
            window=request.window,
            use_rf=request.use_rf,
            place=request.place,
            themes=request.themes,
        )
        invalidate_cache()
    except Exception as exc:
        logger.warning("Sentiment model training failed: %s", exc)
        errors.append(f"sentiment: {exc}")

    try:
        topic_result = train_topic_models(
            window=request.window,
            use_rf=request.use_rf,
            place=request.place,
            themes=request.themes,
            top_n=request.top_n_topics,
        )
        topic_metrics = {
            "topics_trained": len(topic_result.get("models", {})),
            "is_synthetic": topic_result.get("is_synthetic", False),
            "topics": topic_result.get("topics", []),
        }
    except Exception as exc:
        logger.warning("Topic model training failed: %s", exc)
        errors.append(f"topics: {exc}")

    is_synthetic = sentiment_metrics and any(
        v.get("is_synthetic") for v in sentiment_metrics.values() if isinstance(v, dict)
    )

    message = "Training complete."
    if errors:
        message = f"Training partial. Errors: {'; '.join(errors)}"

    return TrainResponse(
        sentiment=sentiment_metrics,
        topics=topic_metrics,
        is_synthetic=bool(is_synthetic),
        message=message,
    )


# ---------------------------------------------------------------------------
# /predict/sent-trend
# ---------------------------------------------------------------------------

@router.post("/sent-trend", response_model=SentimentTrendResponse)
def predict_sentiment_trend(request: SentimentTrendRequest) -> SentimentTrendResponse:
    """
    Predict the next sentiment values using lag-based regression.
    If no trained model exists, automatically trains one first (using synthetic
    data if real data is insufficient — clearly flagged in the response).
    """
    from ml.sentiment_trend.predict import predict_next_sentiment
    from ml.sentiment_trend.train import train as train_sentiment
    from ml.sentiment_trend.predict import invalidate_cache
    from pathlib import Path

    # Auto-train if no model files exist yet
    model_dir = Path(__file__).resolve().parents[4] / "ml" / "models"
    has_model = any(model_dir.glob(f"sentiment_negative_w{request.window}.joblib"))
    if not has_model:
        logger.info("No sentiment model found — auto-training before prediction")
        try:
            train_sentiment(window=request.window, place=request.place, themes=request.themes)
            invalidate_cache()
        except Exception as exc:
            raise HTTPException(status_code=503, detail=f"Auto-training failed: {exc}") from exc

    try:
        result = predict_next_sentiment(
            window=request.window,
            place=request.place,
            themes=request.themes,
            spike_threshold=request.spike_threshold,
        )
    except (ValueError, FileNotFoundError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Sentiment prediction error")
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    predictions = {
        label: SentimentLabelPrediction(**pred)
        for label, pred in result["predictions"].items()
    }

    return SentimentTrendResponse(
        window=result["window"],
        data_points=result["data_points"],
        is_synthetic=result["is_synthetic"],
        place=result.get("place"),
        themes=result.get("themes"),
        predictions=predictions,
        alerts=result["alerts"],
        top_alert=result["top_alert"],
    )


# ---------------------------------------------------------------------------
# /predict/topic-spike
# ---------------------------------------------------------------------------

@router.post("/topic-spike", response_model=TopicSpikeResponse)
def predict_topic_spike(request: TopicSpikeRequest) -> TopicSpikeResponse:
    """
    Extract topics via TF-IDF (or LDA), predict next-window frequency,
    and flag spikes where predicted > current × spike_threshold.
    """
    from ml.topic_trend.predict import predict_topic_spikes

    try:
        spikes = predict_topic_spikes(
            window=request.window,
            place=request.place,
            themes=request.themes,
            top_n=request.top_n,
            spike_threshold=request.spike_threshold,
        )
    except (ValueError, RuntimeError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Topic spike prediction error")
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    items = [TopicSpikeItem(**s) for s in spikes]
    spiking = sum(1 for item in items if item.alert)
    is_synthetic = any(item.is_synthetic for item in items)

    return TopicSpikeResponse(
        results=items,
        total_topics=len(items),
        spiking_count=spiking,
        is_synthetic=is_synthetic,
    )


# ---------------------------------------------------------------------------
# /predict/risk-score  (bonus — combines all signals)
# ---------------------------------------------------------------------------

_RISK_WEIGHTS = {
    "negative_sentiment": 0.35,
    "topic_spike":        0.30,
    "low_credibility":    0.25,
    "misinfo_risk":       0.10,
}


@router.post("/risk-score", response_model=RiskScoreResponse)
def compute_risk_score(request: RiskScoreRequest) -> RiskScoreResponse:
    """
    Composite risk score combining:
      - negative sentiment level
      - ML-predicted topic spike intensity
      - source credibility (inverted)
      - misinformation risk flag

    Formula (weighted sum, all components in [0, 1]):
      risk = 0.35 × neg_norm + 0.30 × spike_score + 0.25 × (1 - cred_norm) + 0.10 × misinfo_norm
    """
    neg_norm = request.negative_pct / 100.0
    cred_norm = request.credibility_pct / 100.0
    misinfo_norm = request.misinfo_risk_pct / 100.0
    spike = float(request.spike_score)

    # Bonus multiplier when both sentiment and topic spike alerts fire simultaneously
    compound_boost = 0.05 if (request.sentiment_spike_alert and request.topic_spike_alert) else 0.0

    risk_score = (
        _RISK_WEIGHTS["negative_sentiment"] * neg_norm
        + _RISK_WEIGHTS["topic_spike"] * spike
        + _RISK_WEIGHTS["low_credibility"] * (1.0 - cred_norm)
        + _RISK_WEIGHTS["misinfo_risk"] * misinfo_norm
        + compound_boost
    )
    risk_score = round(min(1.0, max(0.0, risk_score)), 4)

    if risk_score >= 0.75:
        level, interpretation = "CRITICAL", "Severe confluence of negative sentiment, low credibility, and spiking topics. Immediate analyst review recommended."
    elif risk_score >= 0.55:
        level, interpretation = "HIGH", "Elevated signals across multiple dimensions. Escalate for monitoring."
    elif risk_score >= 0.35:
        level, interpretation = "MODERATE", "Some signals above baseline. Continue routine monitoring with heightened attention."
    else:
        level, interpretation = "LOW", "No significant anomalies detected. Normal intelligence picture."

    components = {
        "negative_sentiment": round(_RISK_WEIGHTS["negative_sentiment"] * neg_norm, 4),
        "topic_spike": round(_RISK_WEIGHTS["topic_spike"] * spike, 4),
        "low_credibility": round(_RISK_WEIGHTS["low_credibility"] * (1.0 - cred_norm), 4),
        "misinfo_risk": round(_RISK_WEIGHTS["misinfo_risk"] * misinfo_norm, 4),
    }

    return RiskScoreResponse(
        risk_score=risk_score,
        level=level,
        components=components,
        interpretation=interpretation,
        weights=_RISK_WEIGHTS,
    )
