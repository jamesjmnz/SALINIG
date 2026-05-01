import logging

from app.infrastructure.graph.trace import append_trace

logger = logging.getLogger(__name__)


def insufficient_evidence_node(state):
    sufficiency = state.get("evidence_sufficiency") or {}
    reasons = sufficiency.get("reasons") or ["Collected evidence is insufficient for a grounded report."]
    report_lines = [
        "INSUFFICIENT EVIDENCE",
        "The current run stopped before synthesis because the collected evidence base was too weak.",
        "",
        "Reasons:",
    ]
    report_lines.extend(f"- {reason}" for reason in reasons)
    report_lines.extend(
        [
            "",
            "Recommended next steps:",
            "- Broaden the monitoring window or add more specific focus terms.",
            "- Re-run after more official or independently corroborated updates are available.",
        ]
    )

    logger.info("insufficient evidence — terminating run early")
    next_state = {
        **state,
        "analysis_status": "insufficient_evidence",
        "final_report": "\n".join(report_lines).strip(),
        "sentiment_report": None,
        "quality_score": 0.0,
        "quality_breakdown": {},
        "quality_passed": False,
        "quality_feedback": "Insufficient evidence for grounded synthesis.",
        "knowledge_gaps": list(reasons),
        "blocking_issues": list(reasons),
        "memory_saved": False,
        "memory_duplicate": False,
    }
    return {
        **next_state,
        "cycle_trace": append_trace(
            next_state,
            "insufficient_evidence",
            "returned",
            reasons=reasons,
        ),
    }
