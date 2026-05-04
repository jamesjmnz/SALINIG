from typing import Any, Literal

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Shared
# ---------------------------------------------------------------------------

class TrainRequest(BaseModel):
    window: int = Field(3, ge=1, le=10, description="Lag window size for regression features")
    use_rf: bool = Field(False, description="Use RandomForestRegressor instead of LinearRegression")
    place: str | None = None
    themes: list[str] | None = None
    top_n_topics: int = Field(15, ge=1, le=50)


class TrainResponse(BaseModel):
    sentiment: dict[str, Any] = Field(default_factory=dict)
    topics: dict[str, Any] = Field(default_factory=dict)
    is_synthetic: bool = False
    message: str = ""


# ---------------------------------------------------------------------------
# Sentiment trend
# ---------------------------------------------------------------------------

class SentimentTrendRequest(BaseModel):
    window: int = Field(3, ge=1, le=10)
    place: str | None = None
    themes: list[str] | None = None
    spike_threshold: float = Field(
        0.15, ge=0.0, le=1.0,
        description="Absolute rise in negative score that triggers an alert",
    )


class SentimentLabelPrediction(BaseModel):
    current: float = Field(ge=0.0, le=1.0)
    predicted: float = Field(ge=0.0, le=1.0)
    change: float
    alert: str = ""
    mae: float | None = None
    rmse: float | None = None
    model: str = ""


class SentimentTrendResponse(BaseModel):
    topic: str = "sentiment_trend"
    window: int
    data_points: int
    is_synthetic: bool = False
    place: str | None = None
    themes: list[str] | None = None
    predictions: dict[str, SentimentLabelPrediction]
    alerts: list[str] = Field(default_factory=list)
    top_alert: str = ""


# ---------------------------------------------------------------------------
# Topic spike
# ---------------------------------------------------------------------------

class TopicSpikeRequest(BaseModel):
    window: int = Field(3, ge=1, le=10)
    place: str | None = None
    themes: list[str] | None = None
    top_n: int = Field(15, ge=1, le=50)
    spike_threshold: float = Field(
        1.5, ge=1.0,
        description="predicted/current ratio that triggers SPIKE alert",
    )
    mode: Literal["tfidf", "lda"] = "tfidf"


class TopicSpikeItem(BaseModel):
    topic: str
    current: float
    predicted: float
    ratio: float | None = None
    alert: str = ""
    model: str = ""
    is_synthetic: bool = False


class TopicSpikeResponse(BaseModel):
    results: list[TopicSpikeItem]
    total_topics: int
    spiking_count: int
    is_synthetic: bool = False


# ---------------------------------------------------------------------------
# Combined risk score (bonus)
# ---------------------------------------------------------------------------

class RiskScoreRequest(BaseModel):
    negative_pct: float = Field(ge=0.0, le=100.0, description="Current negative sentiment %")
    credibility_pct: float = Field(ge=0.0, le=100.0, description="Source credibility %")
    spike_score: float = Field(0.0, ge=0.0, le=1.0, description="Topic spike ML score (0-1)")
    misinfo_risk_pct: float = Field(0.0, ge=0.0, le=100.0)
    sentiment_spike_alert: bool = False
    topic_spike_alert: bool = False


class RiskScoreResponse(BaseModel):
    risk_score: float = Field(ge=0.0, le=1.0)
    level: Literal["LOW", "MODERATE", "HIGH", "CRITICAL"]
    components: dict[str, float]
    interpretation: str
    weights: dict[str, float]
