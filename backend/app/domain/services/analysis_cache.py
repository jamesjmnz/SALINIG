from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from uuid import uuid4

from app.core.config import settings
from app.schemas.analysis_schema import (
    AnalysisResponse,
    LatestAnalysisResponse,
    SavedAnalysisListResponse,
    SavedAnalysisRecord,
    SavedAnalysisSummary,
)


_latest_successful: AnalysisResponse | None = None
_latest_updated_at: str | None = None
_latest_report_id: str | None = None
_lock = Lock()


def _store_path() -> Path:
    return Path(settings.SALINIG_SAVED_REPORTS_PATH)


def _sanitize_response(response: AnalysisResponse) -> AnalysisResponse:
    return response.model_copy(
        update={"diagnostics": None},
        deep=True,
    )


def _build_title(response: AnalysisResponse) -> str:
    subject = (
        response.focus_terms[0]
        if response.focus_terms
        else response.prioritize_themes[0]
        if response.prioritize_themes
        else response.sentiment_report.overall_label
        if response.sentiment_report
        else "Saved report"
    )
    return f"{subject} · {response.place}"


def _summary_from_record(record: SavedAnalysisRecord) -> SavedAnalysisSummary:
    analysis = record.analysis
    return SavedAnalysisSummary(
        report_id=record.report_id,
        saved_at=record.saved_at,
        title=_build_title(analysis),
        place=analysis.place,
        monitoring_window=analysis.monitoring_window,
        analysis_mode=analysis.analysis_mode,
        overall_label=analysis.sentiment_report.overall_label if analysis.sentiment_report else "",
        quality_score=analysis.quality.score,
        quality_passed=analysis.quality.passed,
        signal_count=analysis.sentiment_report.metrics.signal_count if analysis.sentiment_report else 0,
        prioritize_themes=list(analysis.prioritize_themes),
    )


def _build_saved_record(response: AnalysisResponse, saved_at: str) -> SavedAnalysisRecord:
    sanitized = _sanitize_response(response)
    return SavedAnalysisRecord(
        report_id=uuid4().hex[:12],
        saved_at=saved_at,
        analysis=sanitized,
    )


def _read_records_unlocked() -> list[SavedAnalysisRecord]:
    path = _store_path()
    if not path.exists():
        return []

    try:
        payload = json.loads(path.read_text())
    except (OSError, json.JSONDecodeError):
        return []

    if not isinstance(payload, dict):
        return []

    records = payload.get("reports")
    if not isinstance(records, list):
        return []

    parsed: list[SavedAnalysisRecord] = []
    for item in records:
        try:
            parsed.append(SavedAnalysisRecord.model_validate(item))
        except Exception:
            continue
    return parsed


def _write_records_unlocked(records: list[SavedAnalysisRecord]) -> None:
    path = _store_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {"reports": [record.model_dump(mode="json", exclude_none=True) for record in records]}
    path.write_text(json.dumps(payload, indent=2))


def save_analysis_report(response: AnalysisResponse) -> SavedAnalysisRecord:
    global _latest_successful, _latest_updated_at, _latest_report_id
    saved_at = datetime.now(timezone.utc).isoformat()
    record = _build_saved_record(response, saved_at)

    with _lock:
        records = _read_records_unlocked()
        records.insert(0, record)
        limit = max(1, settings.SALINIG_SAVED_REPORTS_LIMIT)
        records = records[:limit]
        _write_records_unlocked(records)
        _latest_successful = record.analysis.model_copy(deep=True)
        _latest_updated_at = saved_at
        _latest_report_id = record.report_id
        return record.model_copy(deep=True)


def cache_latest_successful(response: AnalysisResponse) -> SavedAnalysisRecord:
    return save_analysis_report(response)


def latest_successful_analysis() -> LatestAnalysisResponse:
    with _lock:
        if _latest_successful is not None:
            return LatestAnalysisResponse(
                cached=True,
                updated_at=_latest_updated_at,
                report_id=_latest_report_id,
                analysis=_latest_successful.model_copy(deep=True),
            )

        records = _read_records_unlocked()
        if not records:
            return LatestAnalysisResponse(cached=False)

        latest = records[0]
        return LatestAnalysisResponse(
            cached=True,
            updated_at=latest.saved_at,
            report_id=latest.report_id,
            analysis=latest.analysis.model_copy(deep=True),
        )


def list_saved_reports() -> SavedAnalysisListResponse:
    with _lock:
        records = _read_records_unlocked()
        return SavedAnalysisListResponse(reports=[_summary_from_record(record) for record in records])


def get_saved_report(report_id: str) -> SavedAnalysisRecord | None:
    with _lock:
        for record in _read_records_unlocked():
            if record.report_id == report_id:
                return record.model_copy(deep=True)
    return None


def clear_latest_successful_analysis() -> None:
    global _latest_successful, _latest_updated_at, _latest_report_id
    with _lock:
        _latest_successful = None
        _latest_updated_at = None
        _latest_report_id = None
        path = _store_path()
        try:
            path.unlink()
        except FileNotFoundError:
            pass
