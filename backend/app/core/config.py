from pathlib import Path

from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    OPENAI_API_KEY: str
    TAVILY_API_KEY: str
    QDRANT_URL: str
    QDRANT_COLLECTION: str
    OPENAI_MODEL: str
    OPENAI_EMBEDDING_MODEL: str = "text-embedding-3-small"
    RAG_MAX_ITERATIONS: int = 3
    RAG_QUALITY_THRESHOLD: float = 0.70
    RAG_RETRIEVAL_K: int = 3
    RAG_SEARCH_MAX_RESULTS: int = 5
    RAG_QUERIES_PER_THEME: int = 2
    RAG_EVIDENCE_CHAR_LIMIT: int = 25000
    RAG_SOURCE_CHAR_LIMIT: int = 3500
    RAG_USE_LLM_QUERY_GEN: bool = False
    RAG_SYNC_LEARNING: bool = True
    RAG_AUX_ANALYSIS_CHAR_LIMIT: int = 3500
    RAG_SENTIMENT_ROBERTA_MODEL: str = "cardiffnlp/twitter-roberta-base-sentiment-latest"
    RAG_SENTIMENT_ROBERTA_WEIGHT: float = 0.40
    RAG_SENTIMENT_LLM_WEIGHT: float = 0.60
    RAG_SENTIMENT_ROBERTA_MAX_SOURCES: int = 8
    RAG_SENTIMENT_ROBERTA_CHUNK_CHAR_LIMIT: int = 1000
    RAG_ENABLE_ROBERTA: bool = True
    RAG_WARM_ROBERTA_ON_STARTUP: bool = False

    RAG_MAX_THEMES: int = 5
    RAG_MAX_SEARCH_QUERIES: int = 10
    RAG_SEARCH_MAX_WORKERS: int = 4
    RAG_SIGNAL_MAX_WORKERS: int = 4
    RAG_ENABLE_RERANKING: bool = True
    RAG_RERANKER_MODEL: str = "BAAI/bge-reranker-v2-m3"
    RAG_RERANK_TOP_K: int = 8
    RAG_ENABLE_EVIDENCE_SUFFICIENCY_GATE: bool = True
    RAG_MIN_SOURCES_REQUIRED: int = 2
    RAG_MIN_UNIQUE_DOMAINS_REQUIRED: int = 2
    RAG_MIN_OFFICIAL_SOURCES_REQUIRED: int = 0
    RAG_ENABLE_NLI_VERIFICATION: bool = True
    RAG_NLI_MODEL: str = "MoritzLaurer/mDeBERTa-v3-base-mnli-xnli"
    RAG_MAX_CLAIMS_TO_VERIFY: int = 8
    RAG_MAX_SOURCES_PER_CLAIM: int = 3

    OPENAI_EMBEDDING_DIMENSIONS: int = 1536
    EXTERNAL_REQUEST_TIMEOUT_SECONDS: float = 30.0
    EXTERNAL_MAX_RETRIES: int = 2

    SALINIG_API_KEY: str | None = None
    SALINIG_RATE_LIMIT_REQUESTS: int = 20
    SALINIG_RATE_LIMIT_WINDOW_SECONDS: int = 60
    SALINIG_CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001"
    SALINIG_SAVED_REPORTS_PATH: str = str(
        Path(__file__).resolve().parents[2] / ".salinig" / "saved_reports.json"
    )
    SALINIG_ANALYST_FEEDBACK_PATH: str = str(
        Path(__file__).resolve().parents[2] / ".salinig" / "analyst_feedback.json"
    )
    SALINIG_SAVED_REPORTS_LIMIT: int = 50

    class Config:
        env_file = "../.env"

settings = Settings()
