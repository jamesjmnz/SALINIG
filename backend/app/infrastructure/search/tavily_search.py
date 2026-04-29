from langchain_tavily.tavily_search import TavilySearch
from app.core.config import settings


def search(query: str):
    tool = TavilySearch(
        max_results=settings.RAG_SEARCH_MAX_RESULTS,
        include_raw_content="text",
        search_depth="advanced",
        tavily_api_key=settings.TAVILY_API_KEY,
    )

    return tool.invoke(query)
