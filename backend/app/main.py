import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from langchain_community.cache import SQLiteCache
from langchain_core.globals import set_llm_cache

from app.api.v1.router import api_router
from app.core.config import settings

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s – %(message)s")
logger = logging.getLogger(__name__)

set_llm_cache(SQLiteCache(database_path=".langchain_cache.db"))


@asynccontextmanager
async def lifespan(_app: FastAPI):
    if settings.RAG_ENABLE_ROBERTA and settings.RAG_WARM_ROBERTA_ON_STARTUP:
        try:
            from app.infrastructure.graph.nodes.sentiment_ensemble import warm_roberta_model

            warm_roberta_model()
        except Exception as exc:
            logger.warning("RoBERTa warmup failed; sentiment will use fallback if needed: %s", exc)
    yield


app = FastAPI(
    title="SALINIG Backend API",
    version="1.0.0",
    description="Evidence-grounded public-signal analysis with cyclic RAG, memory, sentiment, and credibility evaluation.",
    lifespan=lifespan,
)

cors_origins = [
    origin.strip()
    for origin in settings.SALINIG_CORS_ORIGINS.split(",")
    if origin.strip()
]
if cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(api_router, prefix="/api/v1")


@app.get("/")
def root():
    return {"service": "SALINIG Backend API", "status": "ok"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/ready")
def ready():
    return {
        "status": "ready",
        "openai_model": settings.OPENAI_MODEL,
        "qdrant_collection": settings.QDRANT_COLLECTION,
    }
