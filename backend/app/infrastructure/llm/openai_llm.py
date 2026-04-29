from langchain_openai import ChatOpenAI
from app.core.config import settings

def get_llm():
    return ChatOpenAI(
        model=settings.OPENAI_MODEL,
        api_key=settings.OPENAI_API_KEY
    )

    