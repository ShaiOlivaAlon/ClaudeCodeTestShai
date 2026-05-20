"""
GoTo Holiday Car Checker — main entry point.
Runs on every GitHub Actions invocation (every 30 minutes).

Flow:
  1. Load persisted state from GitHub Gist
  2. Poll Telegram for any pending ACK callbacks
  3. Check upcoming Israeli holidays
  4. If a holiday is within HOLIDAY_CHECK_WINDOW_HOURS:
       a. Query GoTo for nearby cars
       b. If ≤ CAR_ALERT_THRESHOLD cars: send / re-send Telegram alert
  5. If AUTO_RENT_ENABLED and holiday is within AUTO_RENT_HOURS_BEFORE:
       a. Book the nearest car
       b. Send confirmation Telegram with 30-min auto-cancel
  6. Check for expired unconfirmed reservations → cancel + notify
  7. Save state back to Gist
"""
import sys
from datetime import datetime, timedelta, timezone

import state as st
import holidays as hol
import telegram_bot as tg
from goto_client import GoToClient
from config import (
    HOME_LAT, HOME_LNG, SEARCH_RADIUS_KM,
    CAR_ALERT_THRESHOLD, HOLIDAY_CHECK_WINDOW_HOURS,
    AUTO_RENT_ENABLED, AUTO_RENT_HOURS_BEFORE, AUTO_RENT_CONFIRM_MINUTES,
    GOTO_DRY_RUN, FORCE_ALERT,
)


def run() -> None:
    print(f"[{datetime.now(timezone.utc).isoformat()}] GoTo checker starting…")

    # ── 1. Load state ─────────────────────────────────────────────────────────
    state = st.load()

    # ── 2. Process pending Telegram callbacks (button presses) ────────────────
    _process_callbacks(state)

    # ── 3. Expire stale alerts from previous holidays ─────────────────────────
    st.clear_acknowledged_alerts(state)

    # ── 4. Check holidays ─────────────────────────────────────────────────────
    upcoming = hol.holidays_within_hours(HOLIDAY_CHECK_WINDOW_HOURS)
    if not upcoming and not FORCE_ALERT:
        print("No holidays within check window. Done.")
        st.save(state)
        return

    client = GoToClient(
        token=state.get("goto_token"),
        token_expiry=state.get("goto_token_expiry"),
    )
    try:
        client.authenticate()
        state.update(client.token_state())
    except Exception as e:
        print(f"GoTo auth failed: {e}", file=sys.stderr)
        st.save(state)
        return

    for holiday in upcoming or [{"name": "Test Alert", "evening_dt": datetime.now(timezone.utc)}]:
        holiday_name = holiday["name"]
        evening_dt = holiday["evening_dt"]

        # ── 4a. Check car availability ────────────────────────────────────────
        try:
            cars = client.get_nearby_cars(HOME_LAT, HOME_LNG, SEARCH_RADIUS_KM)
        except Exception as e:
            print(f"GoTo car search failed: {e}", file=sys.stderr)
            continue

        print(f"Holiday: {holiday_name} | Cars found: {len(cars)}")

        # ── 4b. Alert if too few cars ─────────────────────────────────────────
        if len(cars) <= CAR_ALERT_THRESHOLD or FORCE_ALERT:
            if not st.is_alert_pending(state, holiday_name):
                msg_id = tg.send_low_cars_alert(holiday_name, len(cars))
                state["pending_alerts"].append({
                    "holiday": holiday_name,
                    "telegram_message_id": msg_id,
                    "acknowledged": False,
                    "sent_at": datetime.now(timezone.utc).isoformat(),
                })
                print(f"Alert sent for {holiday_name} (msg_id={msg_id})")
            else:
                # Re-send alert (repeats every 30 min until acknowledged)
                msg_id = tg.send_low_cars_alert(holiday_name, len(cars))
                # Update the message_id so ACK resolves the latest message
                for alert in state["pending_alerts"]:
                    if alert["holiday"] == holiday_name and not alert["acknowledged"]:
                        alert["telegram_message_id"] = msg_id
                print(f"Re-sent alert for {holiday_name} (msg_id={msg_id})")

        # ── 5. Auto-rent ──────────────────────────────────────────────────────
        if AUTO_RENT_ENABLED:
            _handle_auto_rent(state, client, holiday_name, evening_dt, cars)

    # ── 6. Handle expired reservations ────────────────────────────────────────
    _handle_expired_reservation(state, client)

    # ── 7. Save ───────────────────────────────────────────────────────────────
    st.save(state)
    print("Done.")


def _process_callbacks(state: dict) -> None:
    """Poll Telegram for button presses and update state accordingly."""
    try:
        callbacks = tg.get_pending_callbacks()
    except Exception as e:
        print(f"Failed to poll Telegram callbacks: {e}", file=sys.stderr)
        return

    for cb in callbacks:
        data = cb["callback_data"]
        msg_id = cb["message_id"]

        if data == "ack_low_cars":
            if st.acknowledge_alert(state, msg_id):
                tg.edit_message(msg_id, "✅ Acknowledged. No further reminders for this holiday.")
                print(f"Alert acknowledged (msg_id={msg_id})")

        elif data == "ack_auto_rent":
            res = state.get("pending_reservation")
            if res and not res.get("confirmed"):
                res["confirmed"] = True
                tg.edit_message(msg_id, f"✅ Reservation confirmed for {res['holiday']}. Enjoy the holiday!")
                print("Auto-rent confirmed by user.")

        elif data == "cancel_auto_rent":
            res = state.get("pending_reservation")
            if res and not res.get("confirmed"):
                # Mark for immediate cancellation in step 6
                res["force_cancel"] = True
                tg.edit_message(msg_id, f"🚫 Cancelling reservation for {res['holiday']}…")
                print("Auto-rent cancellation requested by user.")


def _handle_auto_rent(
    state: dict,
    client: GoToClient,
    holiday_name: str,
    evening_dt: datetime,
    cars: list[dict],
) -> None:
    now = datetime.now(timezone.utc)
    hours_until = (evening_dt - now).total_seconds() / 3600

    # Only trigger once, when within the auto-rent window
    if hours_until > AUTO_RENT_HOURS_BEFORE:
        return

    existing = state.get("pending_reservation")
    if existing and existing.get("holiday") == holiday_name:
        return  # Already booked

    if not cars:
        print(f"Auto-rent: no cars available for {holiday_name}")
        return

    # Pick the first available car (closest, as GoTo likely returns sorted by distance)
    car = cars[0]
    try:
        if not GOTO_DRY_RUN:
            reservation_id = client.book_car(car["id"])
        else:
            reservation_id = "dry-run-reservation-001"
    except Exception as e:
        print(f"Auto-rent booking failed: {e}", file=sys.stderr)
        return

    expires_at = (now + timedelta(minutes=AUTO_RENT_CONFIRM_MINUTES)).isoformat()
    msg_id = tg.send_auto_rent_notification(holiday_name, car)

    state["pending_reservation"] = {
        "reservation_id": reservation_id,
        "holiday": holiday_name,
        "car": car,
        "confirmed": False,
        "force_cancel": False,
        "expires_at": expires_at,
        "telegram_message_id": msg_id,
    }
    print(f"Auto-rent booked: {reservation_id} for {holiday_name} (expires {expires_at})")


def _handle_expired_reservation(state: dict, client: GoToClient) -> None:
    res = state.get("pending_reservation")
    if not res:
        return
    if res.get("confirmed"):
        return

    now = datetime.now(timezone.utc)
    expires_at = datetime.fromisoformat(res["expires_at"])
    should_cancel = res.get("force_cancel") or now >= expires_at

    if not should_cancel:
        return

    reservation_id = res["reservation_id"]
    holiday_name = res["holiday"]
    try:
        client.cancel_booking(reservation_id)
        print(f"Reservation {reservation_id} cancelled.")
    except Exception as e:
        print(f"Failed to cancel reservation {reservation_id}: {e}", file=sys.stderr)

    tg.send_reservation_cancelled(holiday_name)
    state["pending_reservation"] = None


if __name__ == "__main__":
    run()
