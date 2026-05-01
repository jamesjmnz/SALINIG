from __future__ import annotations

from typing import Any
from urllib.parse import urlsplit


def clean_text(value: Any) -> str:
    return " ".join(str(value or "").split())


def source_url(item: Any) -> str | None:
    if not isinstance(item, dict):
        return None
    return item.get("url") or item.get("link") or item.get("source")


def source_title(item: Any) -> str:
    if not isinstance(item, dict):
        return clean_text(item) or "Untitled source"
    return clean_text(item.get("title") or item.get("name") or "Untitled source")


def source_content(item: Any, max_chars: int | None = None) -> str:
    if not isinstance(item, dict):
        text = clean_text(item)
    else:
        text = clean_text(item.get("raw_content") or item.get("content") or item.get("snippet") or "")
    if max_chars and len(text) > max_chars:
        return text[: max_chars - 3].rstrip() + "..."
    return text


def domain_from_url(url: str | None) -> str:
    if not url:
        return ""
    host = urlsplit(str(url)).netloc.lower()
    if host.startswith("www."):
        host = host[4:]
    return host


def is_official_domain(domain: str | None) -> bool:
    domain = (domain or "").casefold()
    if not domain:
        return False
    if domain.endswith(".gov") or ".gov." in domain or domain.endswith(".gov.ph") or ".gov.ph" in domain:
        return True
    if domain.endswith(".edu") or ".edu." in domain:
        return True
    return False
