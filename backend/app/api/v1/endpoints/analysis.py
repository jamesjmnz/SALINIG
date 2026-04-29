from fastapi import APIRouter
from app.schemas.analysis_schema import AnalyzeRequest
from app.domain.services.analysis_service import AnalysisService

router = APIRouter()

@router.post("/")
def analyze(request: AnalyzeRequest):
    return AnalysisService().analyze(request)