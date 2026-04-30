import time
from collections import defaultdict, deque
from threading import Lock
from typing import Annotated

from fastapi import Header, HTTPException, Request, status

from app.core.config import settings


class InMemoryRateLimiter:
    def __init__(self) -> None:
        self._lock = Lock()
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def check(self, key: str, limit: int, window_seconds: int) -> bool:
        if limit <= 0 or window_seconds <= 0:
            return True

        now = time.monotonic()
        cutoff = now - window_seconds
        with self._lock:
            hits = self._hits[key]
            while hits and hits[0] < cutoff:
                hits.popleft()
            if len(hits) >= limit:
                return False
            hits.append(now)
            return True

    def clear(self) -> None:
        with self._lock:
            self._hits.clear()


analysis_rate_limiter = InMemoryRateLimiter()


def enforce_rate_limit(
    request: Request,
    x_api_key: Annotated[str | None, Header(alias="X-API-Key")] = None,
) -> None:
    client_host = request.client.host if request.client else "unknown"
    key = x_api_key or client_host
    allowed = analysis_rate_limiter.check(
        key=key,
        limit=settings.SALINIG_RATE_LIMIT_REQUESTS,
        window_seconds=settings.SALINIG_RATE_LIMIT_WINDOW_SECONDS,
    )
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded.",
        )
