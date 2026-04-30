import time
from typing import Any, Literal

import requests

from app.core.config import settings

TAVILY_SEARCH_URL = "https://api.tavily.com/search"
TimeRange = Literal["day", "week", "month"]
SearchDepth = Literal["basic", "advanced"]


class TavilySearchError(RuntimeError):
    pass


def _monitoring_window_to_time_range(monitoring_window: str | None) -> TimeRange | None:
    if monitoring_window == "past 24 hours":
        return "day"
    if monitoring_window == "past 7 days":
        return "week"
    if monitoring_window == "past 30 days":
        return "month"
    return None


def search(
    query: str,
    monitoring_window: str | None = None,
    *,
    max_results: int | None = None,
    include_raw_content: bool | str | None = None,
    search_depth: SearchDepth | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "query": query,
        "max_results": max_results or settings.RAG_SEARCH_MAX_RESULTS,
        "search_depth": search_depth or "advanced",
    }
    if include_raw_content is None:
        include_raw_content = "text"
    if include_raw_content:
        payload["include_raw_content"] = "text" if include_raw_content is True else include_raw_content

    time_range = _monitoring_window_to_time_range(monitoring_window)
    if time_range:
        payload["time_range"] = time_range

    headers = {
        "Authorization": f"Bearer {settings.TAVILY_API_KEY}",
        "Content-Type": "application/json",
        "X-Client-Source": "salinig-backend",
    }

    attempts = max(settings.EXTERNAL_MAX_RETRIES, 0) + 1
    last_error: Exception | None = None
    for attempt in range(attempts):
        try:
            response = requests.post(
                TAVILY_SEARCH_URL,
                json=payload,
                headers=headers,
                timeout=settings.EXTERNAL_REQUEST_TIMEOUT_SECONDS,
            )
            if response.status_code in {429, 500, 502, 503, 504}:
                raise TavilySearchError(f"Tavily transient error {response.status_code}")
            if response.status_code >= 400:
                raise TavilySearchError(f"Tavily request failed with status {response.status_code}")
            data = response.json()
            if not isinstance(data, dict):
                raise TavilySearchError("Tavily returned an unexpected response shape")
            return data
        except Exception as exc:
            last_error = exc
            if attempt >= attempts - 1:
                break
            time.sleep(min(0.25 * (2**attempt), 2.0))

    raise TavilySearchError(str(last_error) if last_error else "Tavily search failed")
