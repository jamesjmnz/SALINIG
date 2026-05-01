from __future__ import annotations

import math
from typing import Any

from app.core.config import settings

_nli_cache: dict[str, tuple[Any, Any]] = {}
_nli_unavailable: set[str] = set()


def classify_claim_support(premise: str, hypothesis: str) -> dict[str, Any]:
    premise = " ".join(str(premise or "").split())
    hypothesis = " ".join(str(hypothesis or "").split())
    if not premise or not hypothesis:
        return {"label": "unclear", "confidence": 0.0, "model": "heuristic-empty"}

    if not settings.RAG_ENABLE_NLI_VERIFICATION:
        return _heuristic_support(premise, hypothesis, model_name="heuristic-disabled")

    try:
        return _hf_support(premise, hypothesis)
    except Exception:
        return _heuristic_support(premise, hypothesis, model_name="heuristic-fallback")


def _heuristic_support(premise: str, hypothesis: str, *, model_name: str) -> dict[str, Any]:
    premise_terms = {part.casefold() for part in premise.split() if len(part) > 3}
    claim_terms = {part.casefold() for part in hypothesis.split() if len(part) > 3}
    if not premise_terms or not claim_terms:
        return {"label": "unclear", "confidence": 0.0, "model": model_name}

    overlap = len(premise_terms & claim_terms) / max(len(claim_terms), 1)
    if overlap >= 0.55:
        label = "supported"
    elif overlap <= 0.15:
        label = "contradicted"
    else:
        label = "mixed"
    return {"label": label, "confidence": round(overlap, 4), "model": model_name}


def _hf_support(premise: str, hypothesis: str) -> dict[str, Any]:
    tokenizer, model = _load_nli_model()
    import torch

    encoded = tokenizer(
        premise,
        hypothesis,
        return_tensors="pt",
        padding=True,
        truncation=True,
        max_length=512,
    )
    with torch.no_grad():
        logits = model(**encoded).logits.detach().cpu().view(-1).tolist()

    if not logits:
        return {"label": "unclear", "confidence": 0.0, "model": settings.RAG_NLI_MODEL}

    high = max(float(value) for value in logits)
    exp_values = [math.exp(float(value) - high) for value in logits]
    total = sum(exp_values) or 1.0
    probabilities = [value / total for value in exp_values]

    label_map = _label_map(getattr(model.config, "id2label", {}) or {})
    scored = [
        (label_map.get(index, "mixed"), float(probabilities[index]))
        for index in range(min(len(probabilities), len(label_map) or len(probabilities)))
    ]
    if not scored:
        return {"label": "unclear", "confidence": 0.0, "model": settings.RAG_NLI_MODEL}

    label, confidence = max(scored, key=lambda item: item[1])
    normalized = {
        "entailment": "supported",
        "neutral": "mixed",
        "contradiction": "contradicted",
    }.get(label, "mixed")
    return {
        "label": normalized,
        "confidence": round(confidence, 4),
        "model": settings.RAG_NLI_MODEL,
    }


def _label_map(id2label: dict[Any, Any]) -> dict[int, str]:
    if not id2label:
        return {0: "contradiction", 1: "neutral", 2: "entailment"}
    normalized = {}
    for raw_index, raw_label in id2label.items():
        try:
            index = int(raw_index)
        except (TypeError, ValueError):
            continue
        label = str(raw_label).strip().casefold()
        normalized[index] = label
    return normalized


def _load_nli_model() -> tuple[Any, Any]:
    model_name = settings.RAG_NLI_MODEL
    if model_name in _nli_unavailable:
        raise RuntimeError(f"NLI model unavailable: {model_name}")
    if model_name not in _nli_cache:
        try:
            from transformers import AutoModelForSequenceClassification, AutoTokenizer

            tokenizer = AutoTokenizer.from_pretrained(model_name)
            model = AutoModelForSequenceClassification.from_pretrained(model_name)
            model.eval()
            _nli_cache[model_name] = (tokenizer, model)
        except Exception:
            _nli_unavailable.add(model_name)
            raise
    return _nli_cache[model_name]
