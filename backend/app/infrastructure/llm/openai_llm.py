from langchain_openai import ChatOpenAI
from app.core.config import settings

def get_llm():
    return ChatOpenAI(
        model=settings.OPENAI_MODEL,
        api_key=settings.OPENAI_API_KEY,
        timeout=settings.EXTERNAL_REQUEST_TIMEOUT_SECONDS,
        max_retries=settings.EXTERNAL_MAX_RETRIES,
    )
