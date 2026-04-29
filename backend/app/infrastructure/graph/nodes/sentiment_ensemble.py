from dataclasses import dataclass
from typing import Any

from pydantic import BaseModel, Field

from app.core.config import settings

SENTIMENT_LABELS = ("negative", "neutral", "positive")
MIXED_MIN_POLAR_SCORE = 0.25
MIXED_MAX_POLAR_GAP = 0.15
CONFIDENT_LABEL_THRESHOLD = 0.45

_roberta_cache: dict[str, tuple[Any, Any]] = {}


class SentimentScores(BaseModel):
    negative: float = Field(0.0, ge=0.0)
    neutral: float = Field(0.0, ge=0.0)
    positive: float = Field(0.0, ge=0.0)


class SentimentOnlyAssessment(BaseModel):
    sentiment: str
    sentiment_scores: SentimentScores


@dataclass(frozen=True)
class SentimentEnsembleResult:
    label: str
    llm_scores: dict[str, float]
    roberta_scores: dict[str, float] | None
    blended_scores: dict[str, float]
    weights: dict[str, float]
    roberta_error: str | None = None

    def as_trace_details(self) -> dict[str, Any]:
        return {
            "sentiment_label": self.label,
            "sentiment_roberta_scores": self.roberta_scores,
            "sentiment_llm_scores": self.llm_scores,
            "sentiment_blended_scores": self.blended_scores,
            "sentiment_weights": self.weights,
            "sentiment_roberta_error": self.roberta_error,
        }


def normalize_scores(scores: Any) -> dict[str, float]:
    if hasattr(scores, "model_dump"):
        scores = scores.model_dump()
    if not isinstance(scores, dict):
        scores = {}

    normalized = {}
    for label in SENTIMENT_LABELS:
        try:
            value = float(scores.get(label, 0.0) or 0.0)
        except (TypeError, ValueError):
            value = 0.0
        normalized[label] = max(value, 0.0)

    total = sum(normalized.values())
    if total <= 0:
        return {label: 1.0 / len(SENTIMENT_LABELS) for label in SENTIMENT_LABELS}
    return {label: value / total for label, value in normalized.items()}


def classify_sentiment_scores(scores: Any) -> str:
    normalized = normalize_scores(scores)
    negative = normalized["negative"]
    positive = normalized["positive"]

    if (
        negative >= MIXED_MIN_POLAR_SCORE
        and positive >= MIXED_MIN_POLAR_SCORE
        and abs(negative - positive) <= MIXED_MAX_POLAR_GAP
    ):
        return "Mixed"

    label, score = max(normalized.items(), key=lambda item: item[1])
    if score < CONFIDENT_LABEL_THRESHOLD:
        return "Mixed"
    return label.title()


def blend_sentiment_assessment(evidence: str, llm_scores: Any) -> SentimentEnsembleResult:
    normalized_llm_scores = normalize_scores(llm_scores)

    try:
        roberta_scores = normalize_scores(infer_roberta_sentiment(evidence))
        weights = _configured_weights(roberta_available=True)
        blended_scores = normalize_scores(
            {
                label: (roberta_scores[label] * weights["roberta"])
                + (normalized_llm_scores[label] * weights["llm"])
                for label in SENTIMENT_LABELS
            }
        )
        roberta_error = None
    except Exception as exc:
        roberta_scores = None
        weights = {"roberta": 0.0, "llm": 1.0}
        blended_scores = normalized_llm_scores
        roberta_error = str(exc)

    return SentimentEnsembleResult(
        label=classify_sentiment_scores(blended_scores),
        llm_scores=normalized_llm_scores,
        roberta_scores=roberta_scores,
        blended_scores=blended_scores,
        weights=weights,
        roberta_error=roberta_error,
    )


def format_sentiment_brief(ensemble: SentimentEnsembleResult, rationale: str) -> str:
    scores = ", ".join(
        f"{label} {ensemble.blended_scores[label]:.2f}" for label in SENTIMENT_LABELS
    )
    if ensemble.roberta_error:
        method = "LLM-only fallback; RoBERTa unavailable"
    else:
        method = f"{ensemble.weights['roberta']:.0%} RoBERTa / {ensemble.weights['llm']:.0%} LLM"

    prefix = f"Blended sentiment: {ensemble.label} ({method}; scores: {scores})."
    rationale = " ".join((rationale or "").split())
    if not rationale:
        return prefix
    return f"{prefix} {rationale}"


def infer_roberta_sentiment(evidence: str) -> dict[str, float]:
    chunks = _roberta_chunks(evidence)
    if not chunks:
        return {"negative": 0.0, "neutral": 1.0, "positive": 0.0}

    tokenizer, model = _load_roberta_model()

    import torch

    encoded = tokenizer(
        chunks,
        return_tensors="pt",
        padding=True,
        truncation=True,
        max_length=512,
    )
    with torch.no_grad():
        logits = model(**encoded).logits
        probabilities = torch.softmax(logits, dim=-1).detach().cpu().tolist()

    id2label = getattr(model.config, "id2label", {}) or {
        0: "negative",
        1: "neutral",
        2: "positive",
    }
    aggregate = {label: 0.0 for label in SENTIMENT_LABELS}
    total_weight = 0.0

    for chunk, scores in zip(chunks, probabilities):
        chunk_scores = {label: 0.0 for label in SENTIMENT_LABELS}
        for index, score in enumerate(scores):
            label = _normalize_roberta_label(id2label.get(index, index))
            if label:
                chunk_scores[label] += float(score)

        weight = float(max(len(chunk), 1))
        chunk_scores = normalize_scores(chunk_scores)
        for label in SENTIMENT_LABELS:
            aggregate[label] += chunk_scores[label] * weight
        total_weight += weight

    if total_weight <= 0:
        return normalize_scores(aggregate)
    return normalize_scores({label: value / total_weight for label, value in aggregate.items()})


def _configured_weights(roberta_available: bool) -> dict[str, float]:
    if not roberta_available:
        return {"roberta": 0.0, "llm": 1.0}

    roberta_weight = max(float(settings.RAG_SENTIMENT_ROBERTA_WEIGHT), 0.0)
    llm_weight = max(float(settings.RAG_SENTIMENT_LLM_WEIGHT), 0.0)
    total = roberta_weight + llm_weight
    if total <= 0:
        roberta_weight = 0.40
        llm_weight = 0.60
        total = 1.0
    return {"roberta": roberta_weight / total, "llm": llm_weight / total}


def _load_roberta_model():
    model_name = settings.RAG_SENTIMENT_ROBERTA_MODEL
    if model_name not in _roberta_cache:
        from transformers import AutoModelForSequenceClassification, AutoTokenizer

        tokenizer = AutoTokenizer.from_pretrained(model_name)
        model = AutoModelForSequenceClassification.from_pretrained(model_name)
        model.eval()
        _roberta_cache[model_name] = (tokenizer, model)
    return _roberta_cache[model_name]


def _roberta_chunks(evidence: str) -> list[str]:
    max_sources = max(int(settings.RAG_SENTIMENT_ROBERTA_MAX_SOURCES), 1)
    max_chars = max(int(settings.RAG_SENTIMENT_ROBERTA_CHUNK_CHAR_LIMIT), 1)
    evidence = evidence or ""
    sources = [source.strip() for source in evidence.split("\n\n") if source.strip()]
    if not sources and evidence.strip():
        sources = [evidence.strip()]

    chunks = []
    for source in sources[:max_sources]:
        chunk = " ".join(source.split())
        if len(chunk) > max_chars:
            chunk = chunk[:max_chars].rstrip()
        if chunk:
            chunks.append(chunk)
    return chunks


def _normalize_roberta_label(label: Any) -> str | None:
    text = str(label).lower()
    fallback_labels = {
        "0": "negative",
        "label_0": "negative",
        "1": "neutral",
        "label_1": "neutral",
        "2": "positive",
        "label_2": "positive",
    }
    if text in fallback_labels:
        return fallback_labels[text]
    for sentiment_label in SENTIMENT_LABELS:
        if sentiment_label in text:
            return sentiment_label
    return None
