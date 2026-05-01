from __future__ import annotations

import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from uuid import uuid4

from app.core.config import settings
from app.schemas.analysis_schema import (
    AnalystFeedbackCreateRequest,
    AnalystFeedbackExportResponse,
    AnalystFeedbackListResponse,
    AnalystFeedbackRecord,
    FineTuningReadinessSummary,
)

_lock = Lock()


def _store_path() -> Path:
    return Path(settings.SALINIG_ANALYST_FEEDBACK_PATH)


def _read_feedback_unlocked() -> list[AnalystFeedbackRecord]:
    path = _store_path()
    if not path.exists():
        return []

    try:
        payload = json.loads(path.read_text())
    except (OSError, json.JSONDecodeError):
        return []

    records = payload.get("feedback")
    if not isinstance(records, list):
        return []

    parsed = []
    for item in records:
        try:
            parsed.append(AnalystFeedbackRecord.model_validate(item))
        except Exception:
            continue
    return parsed


def _write_feedback_unlocked(records: list[AnalystFeedbackRecord]) -> None:
    path = _store_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {"feedback": [record.model_dump(mode="json", exclude_none=True) for record in records]}
    path.write_text(json.dumps(payload, indent=2))


def create_feedback(request: AnalystFeedbackCreateRequest) -> AnalystFeedbackRecord:
    record = AnalystFeedbackRecord(
        feedback_id=uuid4().hex[:12],
        created_at=datetime.now(timezone.utc).isoformat(),
        report_id=request.report_id,
        score=request.score,
        useful=request.useful,
        accurate=request.accurate,
        notes=request.notes,
        flagged_claim_ids=list(request.flagged_claim_ids),
        tags=list(request.tags),
    )
    with _lock:
        records = _read_feedback_unlocked()
        records.insert(0, record)
        _write_feedback_unlocked(records)
    return record


def list_feedback() -> AnalystFeedbackListResponse:
    with _lock:
        return AnalystFeedbackListResponse(feedback=_read_feedback_unlocked())


def export_feedback() -> AnalystFeedbackExportResponse:
    with _lock:
        records = _read_feedback_unlocked()

    total = len(records)
    useful_positive = sum(1 for record in records if record.useful and record.score >= 4 and record.accurate)
    inaccurate = sum(1 for record in records if not record.accurate)
    average = round(sum(record.score for record in records) / total, 2) if total else 0.0
    flagged = Counter(
        claim_id
        for record in records
        for claim_id in record.flagged_claim_ids
    )
    ready = total >= 25 and useful_positive >= 15 and inaccurate >= 5
    recommendation = (
        "Feedback volume is becoming useful for narrow-task fine-tuning experiments."
        if ready
        else "Keep collecting analyst feedback before investing in fine-tuning."
    )
    summary = FineTuningReadinessSummary(
        total_feedback=total,
        useful_positive_count=useful_positive,
        inaccurate_count=inaccurate,
        average_score=average,
        ready_for_fine_tuning=ready,
        recommendation=recommendation,
        most_flagged_claim_ids=[claim_id for claim_id, _count in flagged.most_common(10)],
    )
    return AnalystFeedbackExportResponse(summary=summary, feedback=records)


def clear_feedback() -> None:
    with _lock:
        path = _store_path()
        try:
            path.unlink()
        except FileNotFoundError:
            pass
