from typing import Any, TypedDict

class SalinigState(TypedDict):
    channel: str
    monitoring_window: str
    prioritize_themes: list[str]
    focus_terms: list[str]
    place: str
    analysis_mode: str
    runtime_options: dict[str, Any]
    search_queries: list[str]

    collected_data: list
    ranked_sources: list[dict[str, Any]]
    evidence_text: str
    source_urls: list[str]
    memory_context: str
    retrieved_memories: list[dict[str, Any]]
    evidence_sufficiency: dict[str, Any]

    sentiment: str
    sentiment_label: str
    sentiment_scores: dict[str, float]
    sentiment_roberta_scores: dict[str, float]
    sentiment_llm_scores: dict[str, float]
    sentiment_roberta_error: str | None
    credibility: str
    final_report: str
    sentiment_report: dict[str, Any]
    best_report: str
    best_sentiment_report: dict[str, Any]
    best_quality_score: float
    best_quality_breakdown: dict[str, float]
    best_quality_feedback: str
    best_knowledge_gaps: list[str]
    best_blocking_issues: list[str]

    iteration: int
    max_iterations: int
    quality_score: float
    quality_breakdown: dict[str, float]
    quality_passed: bool
    quality_feedback: str
    knowledge_gaps: list[str]
    blocking_issues: list[str]

    learning_note: str
    learning_citations: list[str]
    memory_saved: bool
    memory_duplicate: bool
    memory_error: str | None
    memory_save_error: str | None
    analysis_status: str
    claim_verification: dict[str, Any]
    citation_validation: dict[str, Any]
    cycle_trace: list[dict[str, Any]]

    spike_detection: dict[str, Any]
    spike_score: float | None
    spike_level: str | None
    spike_signals: list[dict[str, Any]]
    spike_history_count: int | None
    spike_detection_error: str | None
