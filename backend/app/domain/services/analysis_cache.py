from __future__ import annotations

from datetime import datetime, timezone

from app.schemas.analysis_schema import AnalysisResponse, LatestAnalysisResponse


_latest_successful: AnalysisResponse | None = None
_latest_updated_at: str | None = None


def cache_latest_successful(response: AnalysisResponse) -> None:
    global _latest_successful, _latest_updated_at
    if not response.quality.passed:
        return
    _latest_successful = response.model_copy(
        update={"diagnostics": None},
        deep=True,
    )
    _latest_updated_at = datetime.now(timezone.utc).isoformat()


def latest_successful_analysis() -> LatestAnalysisResponse:
    if _latest_successful is None:
        return LatestAnalysisResponse(cached=False)
    return LatestAnalysisResponse(
        cached=True,
        updated_at=_latest_updated_at,
        analysis=_latest_successful.model_copy(deep=True),
    )


def clear_latest_successful_analysis() -> None:
    global _latest_successful, _latest_updated_at
    _latest_successful = None
    _latest_updated_at = None
