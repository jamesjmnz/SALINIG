import logging
import re
from urllib.parse import urlsplit, urlunsplit

from app.infrastructure.graph.trace import append_trace

logger = logging.getLogger(__name__)

URL_RE = re.compile(r"https?://[^\s)\]>\"']+")
SOURCE_RE = re.compile(r"(?:Source|Src):\s*([^;\|\)\]\n]+)", re.IGNORECASE)


def _normalise_url(url: str) -> str:
    url = url.strip().rstrip(".,;:")
    parts = urlsplit(url)
    path = parts.path.rstrip("/")
    return urlunsplit((parts.scheme.lower(), parts.netloc.lower(), path, "", ""))


def _source_title(item) -> str | None:
    if not isinstance(item, dict):
        return None
    title = item.get("title") or item.get("name")
    if not title:
        return None
    return " ".join(str(title).split()).casefold()


def _source_domain_from_url(url: str | None) -> str | None:
    if not isinstance(url, str) or not url.strip():
        return None
    domain = urlsplit(url.strip()).netloc.lower()
    if domain.startswith("www."):
        domain = domain[4:]
    return domain or None


def _source_domain(item) -> str | None:
    if not isinstance(item, dict):
        return None
    return _source_domain_from_url(item.get("url") or item.get("link") or item.get("source"))


def citation_validation_node(state):
    report = state.get("final_report") or ""
    known_urls = {
        _normalise_url(url)
        for url in state.get("source_urls") or []
        if isinstance(url, str) and url.strip()
    }
    known_titles = {
        title
        for title in (_source_title(item) for item in state.get("collected_data") or [])
        if title
    }
    known_domains = {
        domain
        for domain in (
            [_source_domain_from_url(url) for url in state.get("source_urls") or []]
            + [_source_domain(item) for item in state.get("collected_data") or []]
        )
        if domain
    }

    cited_urls = []
    for raw_url in URL_RE.findall(report):
        normalised = _normalise_url(raw_url)
        if normalised and normalised not in cited_urls:
            cited_urls.append(normalised)

    cited_titles = []
    for raw_title in SOURCE_RE.findall(report):
        title = " ".join(raw_title.split()).casefold()
        if title and title not in cited_titles and title not in {"none", "n/a"}:
            cited_titles.append(title)

    unsupported_urls = [url for url in cited_urls if url not in known_urls]
    known_sources = known_titles | known_domains
    unsupported_titles = [title for title in cited_titles if known_sources and title not in known_sources]
    validation = {
        "checked": True,
        "passed": not unsupported_urls and not unsupported_titles,
        "unsupported_urls": unsupported_urls[:10],
        "unsupported_source_titles": unsupported_titles[:10],
    }

    logger.info(
        "citation validation done — passed=%s unsupported_urls=%d unsupported_titles=%d",
        validation["passed"],
        len(validation["unsupported_urls"]),
        len(validation["unsupported_source_titles"]),
    )

    next_state = {**state, "citation_validation": validation}
    return {
        **next_state,
        "cycle_trace": append_trace(
            next_state,
            "citation_validation",
            "checked",
            passed=validation["passed"],
            unsupported_urls=validation["unsupported_urls"] or None,
            unsupported_source_titles=validation["unsupported_source_titles"] or None,
        ),
    }
