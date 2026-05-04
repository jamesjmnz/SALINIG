"""
Topic extraction from learning note texts.

Two modes:
  tfidf (default) — fast, interpretable, thesis-friendly
  lda             — richer but slower; requires more data to be meaningful
"""

from __future__ import annotations

import logging
from typing import Literal

import numpy as np
from sklearn.decomposition import LatentDirichletAllocation
from sklearn.feature_extraction.text import CountVectorizer, TfidfVectorizer

logger = logging.getLogger(__name__)

ExtractionMode = Literal["tfidf", "lda"]

# Terms that add noise in Philippine public-intelligence context
_DOMAIN_STOPWORDS = frozenset(
    "salinig analysis report based source evidence note "
    "philippine philippines manila region area local "
    "according information data available current recent past".split()
)


def _vectorizer_kwargs() -> dict:
    return dict(
        ngram_range=(1, 2),
        stop_words="english",
        max_features=500,
        min_df=1,
        token_pattern=r"(?u)\b[a-zA-Z][a-zA-Z\-]{2,}\b",
    )


def extract_tfidf(texts: list[str], top_n: int = 20) -> list[str]:
    """
    Return the top_n term/bigram strings ranked by mean TF-IDF weight.
    These become the "topics" we track over time.
    """
    if not texts:
        return []

    vec = TfidfVectorizer(**_vectorizer_kwargs())
    try:
        matrix = vec.fit_transform(texts)
    except ValueError as exc:
        logger.warning("TF-IDF vectorizer failed: %s", exc)
        return []

    feature_names = vec.get_feature_names_out()
    mean_weights = np.asarray(matrix.mean(axis=0)).flatten()

    # Filter out domain stopwords
    indices = [
        i for i in mean_weights.argsort()[-top_n * 3 :][::-1]
        if not any(sw in feature_names[i].split() for sw in _DOMAIN_STOPWORDS)
    ][:top_n]

    return [feature_names[i] for i in indices]


def extract_lda(
    texts: list[str],
    n_topics: int = 5,
    top_words_per_topic: int = 4,
) -> list[str]:
    """
    Return representative words from LDA topics.
    Returns a flat deduplicated list suitable for frequency tracking.
    """
    if not texts:
        return []

    vec = CountVectorizer(**_vectorizer_kwargs())
    try:
        X = vec.fit_transform(texts)
    except ValueError as exc:
        logger.warning("LDA CountVectorizer failed: %s", exc)
        return []

    if X.shape[1] < n_topics:
        logger.warning("LDA: vocabulary (%d) smaller than n_topics (%d), reducing", X.shape[1], n_topics)
        n_topics = max(1, X.shape[1] // 2)

    lda = LatentDirichletAllocation(
        n_components=n_topics,
        random_state=42,
        max_iter=20,
        learning_method="batch",
    )
    lda.fit(X)

    feature_names = vec.get_feature_names_out()
    seen: set[str] = set()
    topics: list[str] = []

    for component in lda.components_:
        top_idx = component.argsort()[-top_words_per_topic:][::-1]
        for idx in top_idx:
            term = feature_names[idx]
            if term not in seen and not any(sw in term.split() for sw in _DOMAIN_STOPWORDS):
                seen.add(term)
                topics.append(term)

    return topics


def extract_topics(
    texts: list[str],
    top_n: int = 20,
    mode: ExtractionMode = "tfidf",
    lda_n_topics: int = 5,
) -> list[str]:
    """Unified entry point — dispatches to TF-IDF or LDA."""
    if mode == "lda":
        return extract_lda(texts, n_topics=lda_n_topics, top_words_per_topic=top_n // lda_n_topics or 1)
    return extract_tfidf(texts, top_n=top_n)


def score_text_for_topics(text: str, topics: list[str]) -> dict[str, int]:
    """
    Return {topic: 1/0} for each topic — 1 if the topic string appears in text.
    Used for per-note frequency counting.
    """
    text_lower = text.lower()
    return {topic: int(topic in text_lower) for topic in topics}
