import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from app.core.rate_limit import enforce_rate_limit
from app.core.security import verify_api_key
from app.domain.services.analysis_cache import (
    get_saved_report,
    latest_successful_analysis,
    list_saved_reports,
    save_analysis_report,
)
from app.domain.services.analysis_service import AnalysisService
from app.schemas.analysis_schema import (
    AnalysisOptions,
    AnalysisResponse,
    AnalyzeRequest,
    LatestAnalysisResponse,
    SavedAnalysisListResponse,
    SavedAnalysisRecord,
)

router = APIRouter(
    dependencies=[
        Depends(verify_api_key),
    ]
)


@router.post("/", response_model=AnalysisResponse, response_model_exclude_none=True)
def analyze(request: AnalyzeRequest, _: None = Depends(enforce_rate_limit)) -> dict:
    return AnalysisService().analyze(request)


@router.post("/stream")
def analyze_stream(request: AnalyzeRequest, _: None = Depends(enforce_rate_limit)) -> StreamingResponse:
    def events():
        try:
            for event in AnalysisService().stream_analyze(request):
                event_type = event.get("type", "status")
                yield f"event: {event_type}\ndata: {json.dumps(event)}\n\n"
        except Exception as exc:
            payload = json.dumps(
                {
                    "type": "error",
                    "node": "analysis_service",
                    "label": "Analysis failed",
                    "message": str(exc),
                }
            )
            yield f"event: error\ndata: {payload}\n\n"

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/latest", response_model=LatestAnalysisResponse, response_model_exclude_none=True)
def latest() -> LatestAnalysisResponse:
    return latest_successful_analysis()


@router.get("/saved", response_model=SavedAnalysisListResponse, response_model_exclude_none=True)
def saved_reports() -> SavedAnalysisListResponse:
    return list_saved_reports()


@router.post("/saved", response_model=SavedAnalysisRecord, response_model_exclude_none=True)
def save_report(request: AnalysisResponse) -> SavedAnalysisRecord:
    return save_analysis_report(request)


@router.get("/saved/{report_id}", response_model=SavedAnalysisRecord, response_model_exclude_none=True)
def saved_report_detail(report_id: str) -> SavedAnalysisRecord:
    record = get_saved_report(report_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Saved report not found.")
    return record


@router.get("/options", response_model=AnalysisOptions)
def options() -> AnalysisOptions:
    return AnalysisOptions()
