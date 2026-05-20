"""
Telegram bot: send messages, inline keyboards, and poll for callback ACKs.
"""
import requests
from config import TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID

_BASE = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}"


def send_alert(text: str, inline_buttons: list[dict] | None = None) -> int:
    """
    Send a message. Returns the Telegram message_id.
    inline_buttons: list of {"text": "...", "callback_data": "..."} dicts.
    """
    payload: dict = {"chat_id": TELEGRAM_CHAT_ID, "text": text, "parse_mode": "HTML"}
    if inline_buttons:
        payload["reply_markup"] = {
            "inline_keyboard": [[btn] for btn in inline_buttons]
        }
    resp = requests.post(f"{_BASE}/sendMessage", json=payload, timeout=10)
    resp.raise_for_status()
    return resp.json()["result"]["message_id"]


def edit_message(message_id: int, text: str) -> None:
    payload = {"chat_id": TELEGRAM_CHAT_ID, "message_id": message_id, "text": text, "parse_mode": "HTML"}
    requests.post(f"{_BASE}/editMessageText", json=payload, timeout=10)


def get_pending_callbacks(offset: int = 0) -> list[dict]:
    """
    Poll for unhandled callback_query updates (inline button presses).
    Returns list of {"update_id", "callback_data", "message_id"}.
    """
    resp = requests.get(
        f"{_BASE}/getUpdates",
        params={"offset": offset, "timeout": 0, "allowed_updates": ["callback_query"]},
        timeout=15,
    )
    resp.raise_for_status()
    results = []
    for update in resp.json().get("result", []):
        cq = update.get("callback_query")
        if not cq:
            continue
        results.append({
            "update_id": update["update_id"],
            "callback_data": cq["data"],
            "message_id": cq["message"]["message_id"],
        })
    return results


def ack_callback(callback_query_id: str) -> None:
    """Tell Telegram the callback was handled (removes loading spinner)."""
    requests.post(
        f"{_BASE}/answerCallbackQuery",
        json={"callback_query_id": callback_query_id},
        timeout=10,
    )


def send_low_cars_alert(holiday_name: str, car_count: int) -> int:
    text = (
        f"⚠️ <b>GoTo alert — {holiday_name}</b>\n\n"
        f"Only <b>{car_count} car{'s' if car_count != 1 else ''}</b> available "
        f"within 1km of home.\n\n"
        f"Tap <b>Acknowledged</b> to stop reminders."
    )
    return send_alert(text, [{"text": "✓ Acknowledged", "callback_data": "ack_low_cars"}])


def send_auto_rent_notification(holiday_name: str, car_info: dict) -> int:
    text = (
        f"🚗 <b>Car reserved for {holiday_name}</b>\n\n"
        f"<b>{car_info.get('model', 'Car')}</b> — {car_info.get('plate', '')}\n"
        f"📍 {car_info.get('address', 'Nearby')}\n\n"
        f"Tap <b>KEEP</b> to confirm, or it auto-cancels in 30 minutes."
    )
    return send_alert(
        text,
        [
            {"text": "✓ KEEP RESERVATION", "callback_data": "ack_auto_rent"},
            {"text": "✗ Cancel now", "callback_data": "cancel_auto_rent"},
        ],
    )


def send_reservation_cancelled(holiday_name: str) -> None:
    send_alert(f"🚫 GoTo reservation for <b>{holiday_name}</b> was automatically cancelled (no confirmation received).")


def send_reservation_confirmed(holiday_name: str) -> None:
    send_alert(f"✅ GoTo reservation for <b>{holiday_name}</b> confirmed! Enjoy the holiday.")
