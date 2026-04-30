from typing import Annotated

from fastapi import Header, HTTPException, status

from app.core.config import settings


def verify_api_key(
    x_api_key: Annotated[str | None, Header(alias="X-API-Key")] = None,
) -> None:
    if not settings.SALINIG_API_KEY:
        return

    if x_api_key != settings.SALINIG_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key.",
        )
