from fastapi import APIRouter
from app.api.v1.endpoints.analysis import router as analysis_router
from app.api.v1.endpoints.predict import router as predict_router


api_router = APIRouter()
api_router.include_router(analysis_router, prefix="/analysis")
api_router.include_router(predict_router, prefix="/predict", tags=["predict"])