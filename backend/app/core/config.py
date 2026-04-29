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

    class Config:
        env_file = "../.env"

settings = Settings()
