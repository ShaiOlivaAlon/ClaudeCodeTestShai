"""
Persistent state stored in a GitHub Gist as a JSON file.
This allows GitHub Actions runs (stateless) to share state between executions.
"""
import json
from datetime import datetime, timezone
import requests

from config import GIST_TOKEN, GIST_ID

GIST_FILENAME = "goto_checker_state.json"

_headers = {
    "Authorization": f"token {GIST_TOKEN}",
    "Accept": "application/vnd.github+json",
}

_DEFAULT_STATE = {
    "goto_token": None,
    "goto_token_expiry": None,
    "pending_alerts": [],
    "pending_reservation": None,
    "last_run": None,
}


def load() -> dict:
    url = f"https://api.github.com/gists/{GIST_ID}"
    resp = requests.get(url, headers=_headers, timeout=10)
    resp.raise_for_status()
    files = resp.json().get("files", {})
    if GIST_FILENAME not in files:
        return dict(_DEFAULT_STATE)
    raw = files[GIST_FILENAME].get("content", "{}")
    try:
        state = json.loads(raw)
    except json.JSONDecodeError:
        state = dict(_DEFAULT_STATE)
    # Ensure all default keys exist
    for k, v in _DEFAULT_STATE.items():
        state.setdefault(k, v)
    return state


def save(state: dict) -> None:
    state["last_run"] = datetime.now(timezone.utc).isoformat()
    url = f"https://api.github.com/gists/{GIST_ID}"
    payload = {"files": {GIST_FILENAME: {"content": json.dumps(state, indent=2)}}}
    resp = requests.patch(url, headers=_headers, json=payload, timeout=10)
    resp.raise_for_status()


def acknowledge_alert(state: dict, message_id: int) -> bool:
    """Mark an alert as acknowledged by its Telegram message ID. Returns True if found."""
    for alert in state.get("pending_alerts", []):
        if alert.get("telegram_message_id") == message_id:
            alert["acknowledged"] = True
            return True
    return False


def clear_acknowledged_alerts(state: dict) -> None:
    state["pending_alerts"] = [
        a for a in state.get("pending_alerts", []) if not a.get("acknowledged")
    ]


def is_alert_pending(state: dict, holiday_name: str) -> bool:
    return any(
        a.get("holiday") == holiday_name and not a.get("acknowledged")
        for a in state.get("pending_alerts", [])
    )
