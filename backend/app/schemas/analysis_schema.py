from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

from app.core.config import settings
from app.domain.analysis_defaults import (
    DEFAULT_PLACE,
    DEFAULT_PRIORITIZED_CATEGORIES,
    PUBLIC_INTELLIGENCE_CATEGORIES,
    SUPPORTED_PHILIPPINE_LOCATIONS,
    dedupe_focus_terms,
    normalize_categories,
    normalize_place,
)


Channel = Literal["web_search"]
MonitoringWindow = Literal["past 24 hours", "past 7 days", "past 30 days"]
AnalysisMode = Literal["fast_draft", "full"]

PlaceText = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=2, max_length=120),
]
ThemeText = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=2, max_length=80),
]


class AnalyzeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    channel: Channel = "web_search"
    monitoring_window: MonitoringWindow = "past 7 days"
    prioritize_themes: list[ThemeText] = Field(
        default_factory=lambda: list(DEFAULT_PRIORITIZED_CATEGORIES),
        min_length=1,
        max_length=settings.RAG_MAX_THEMES,
        description="Fixed SALINIG public-intelligence categories.",
    )
    focus_terms: list[ThemeText] = Field(
        default_factory=list,
        max_length=settings.RAG_MAX_THEMES,
        description="Optional free-form subthemes inside the selected categories.",
    )
    place: PlaceText = DEFAULT_PLACE
    analysis_mode: AnalysisMode = "fast_draft"
    include_diagnostics: bool = False

    @field_validator("place", mode="before")
    @classmethod
    def normalize_philippine_place(cls, value: str | None) -> str:
        return normalize_place(value)

    @field_validator("prioritize_themes", mode="before")
    @classmethod
    def dedupe_themes(cls, value: list[str]) -> list[str]:
        return normalize_categories(value)

    @field_validator("focus_terms", mode="before")
    @classmethod
    def dedupe_subthemes(cls, value: list[str]) -> list[str]:
        return dedupe_focus_terms(value)


class AnalysisOptions(BaseModel):
    default_place: str = DEFAULT_PLACE
    supported_locations: list[str] = Field(default_factory=lambda: list(SUPPORTED_PHILIPPINE_LOCATIONS))
    categories: list[str] = Field(default_factory=lambda: list(PUBLIC_INTELLIGENCE_CATEGORIES))
    default_categories: list[str] = Field(default_factory=lambda: list(DEFAULT_PRIORITIZED_CATEGORIES))
    max_themes: int = settings.RAG_MAX_THEMES
    max_focus_terms: int = settings.RAG_MAX_THEMES
    monitoring_windows: list[MonitoringWindow] = Field(
        default_factory=lambda: ["past 24 hours", "past 7 days", "past 30 days"]
    )
    analysis_modes: list[AnalysisMode] = Field(default_factory=lambda: ["fast_draft", "full"])
    fetching_mode: str = "cached_on_load_manual_refresh"


class QualityResult(BaseModel):
    score: float = Field(0.0, ge=0.0, le=1.0)
    breakdown: dict[str, float] = Field(default_factory=dict)
    passed: bool = False
    feedback: str = ""
    knowledge_gaps: list[str] = Field(default_factory=list)
    blocking_issues: list[str] = Field(default_factory=list)


class SentimentSourceSignal(BaseModel):
    source: str = ""
    title: str = ""
    url: str | None = None
    summary: str = ""
    sentiment: Literal["Positive", "Neutral", "Negative"] = "Neutral"
    verification: Literal["verified", "unverified"] = "unverified"
    credibility: Literal["High", "Moderate", "Low", "Unverified"] = "Unverified"
    credibility_score: int = Field(0, ge=0, le=100)


class SentimentReportMetrics(BaseModel):
    negative_pct: int = Field(0, ge=0, le=100)
    neutral_pct: int = Field(0, ge=0, le=100)
    positive_pct: int = Field(0, ge=0, le=100)
    credibility_pct: int = Field(0, ge=0, le=100)
    verified_pct: int = Field(0, ge=0, le=100)
    misinfo_risk_pct: int = Field(0, ge=0, le=100)
    signal_count: int = Field(0, ge=0)


class SentimentReport(BaseModel):
    updated_at: str = ""
    updated_label: str = "Updated moments ago"
    overall_label: str = "Mixed Sentiment"
    overview: str = ""
    source_signals: list[SentimentSourceSignal] = Field(default_factory=list)
    metrics: SentimentReportMetrics = Field(default_factory=SentimentReportMetrics)
    actionable_insights: list[str] = Field(default_factory=list)


class EvidenceSource(BaseModel):
    title: str = ""
    url: str | None = None
    published: str | None = None
    score: float | str | None = None
    content_preview: str | None = None


class MemoryItem(BaseModel):
    content: str = ""
    metadata: dict[str, Any] = Field(default_factory=dict)
    score: float | None = None


class CitationValidationResult(BaseModel):
    checked: bool = False
    passed: bool = True
    unsupported_urls: list[str] = Field(default_factory=list)
    unsupported_source_titles: list[str] = Field(default_factory=list)


class AnalysisDiagnostics(BaseModel):
    search_queries: list[str] = Field(default_factory=list)
    collected_sources: list[EvidenceSource] = Field(default_factory=list)
    retrieved_memories: list[MemoryItem] = Field(default_factory=list)
    cycle_trace: list[dict[str, Any]] = Field(default_factory=list)
    learning_note: str = ""
    learning_citations: list[str] = Field(default_factory=list)
    memory_error: str | None = None
    memory_save_error: str | None = None
    citation_validation: CitationValidationResult = Field(default_factory=CitationValidationResult)


class AnalysisResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    channel: Channel
    monitoring_window: MonitoringWindow
    prioritize_themes: list[str]
    focus_terms: list[str] = Field(default_factory=list)
    place: str
    analysis_mode: AnalysisMode = "fast_draft"
    final_report: str = ""
    sentiment_report: SentimentReport | None = None
    iteration: int = 0
    max_iterations: int = 0
    quality: QualityResult = Field(default_factory=QualityResult)
    memory_saved: bool = False
    memory_duplicate: bool = False
    diagnostics: AnalysisDiagnostics | None = None

    # Transitional fields for existing callers. New clients should read `quality`.
    quality_score: float = Field(0.0, ge=0.0, le=1.0)
    quality_breakdown: dict[str, float] = Field(default_factory=dict)
    quality_passed: bool = False
    quality_feedback: str = ""
    knowledge_gaps: list[str] = Field(default_factory=list)
    blocking_issues: list[str] = Field(default_factory=list)


class LatestAnalysisResponse(BaseModel):
    cached: bool = False
    updated_at: str | None = None
    report_id: str | None = None
    analysis: AnalysisResponse | None = None


class SavedAnalysisSummary(BaseModel):
    report_id: str
    saved_at: str
    title: str
    place: str
    monitoring_window: MonitoringWindow
    analysis_mode: AnalysisMode
    overall_label: str = ""
    quality_score: float = Field(0.0, ge=0.0, le=1.0)
    quality_passed: bool = False
    signal_count: int = Field(0, ge=0)
    prioritize_themes: list[str] = Field(default_factory=list)


class SavedAnalysisRecord(BaseModel):
    report_id: str
    saved_at: str
    analysis: AnalysisResponse


class SavedAnalysisListResponse(BaseModel):
    reports: list[SavedAnalysisSummary] = Field(default_factory=list)
