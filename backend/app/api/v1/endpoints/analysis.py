import json

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.core.rate_limit import enforce_rate_limit
from app.core.security import verify_api_key
from app.domain.services.analysis_cache import latest_successful_analysis
from app.domain.services.analysis_service import AnalysisService
from app.schemas.analysis_schema import (
    AnalysisOptions,
    AnalysisResponse,
    AnalyzeRequest,
    LatestAnalysisResponse,
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


@router.get("/options", response_model=AnalysisOptions)
def options() -> AnalysisOptions:
    return AnalysisOptions()
