from pydantic import BaseModel, Field


class QualityBreakdown(BaseModel):
    evidence_grounding: float = Field(ge=0.0, le=1.0)
    timeframe_fit: float = Field(ge=0.0, le=1.0)
    source_credibility_weighting: float = Field(ge=0.0, le=1.0)
    specificity_and_depth: float = Field(ge=0.0, le=1.0)
    memory_integration: float = Field(ge=0.0, le=1.0)
    practical_usefulness: float = Field(ge=0.0, le=1.0)


class EvaluationResult(BaseModel):
    score: float | None = Field(default=None, ge=0.0, le=1.0)
    quality_breakdown: QualityBreakdown
    feedback: str = ""
    knowledge_gaps: list[str] = Field(default_factory=list)
    blocking_issues: list[str] = Field(default_factory=list)


class LearningResult(BaseModel):
    note: str = ""
    citations: list[str] = Field(default_factory=list)
