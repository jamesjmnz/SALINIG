from typing import Any


def append_trace(state: dict[str, Any], node: str, event: str, **details: Any) -> list[dict[str, Any]]:
    trace = list(state.get("cycle_trace") or [])
    entry: dict[str, Any] = {
        "node": node,
        "event": event,
        "iteration": state.get("iteration", 0),
    }
    entry.update({key: value for key, value in details.items() if value is not None})
    trace.append(entry)
    return trace


