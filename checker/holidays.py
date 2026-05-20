from datetime import datetime, timedelta, timezone
import requests

HEBCAL_URL = "https://www.hebcal.com/hebcal"

# Categories Hebcal uses for major Jewish holidays
HOLIDAY_CATEGORIES = {"holiday"}

# GoTo's "holiday" starts at evening (Erev), which in the Jewish calendar
# begins at sunset on the *previous* day. Hebcal returns the Hebrew date
# starting at sunset, so the date it gives IS the holiday evening date.
EREV_PREFIXES = ("Erev ", "Erev")


def get_upcoming_holidays(days_ahead: int = 7) -> list[dict]:
    """
    Return major Israeli holidays whose evening begins within `days_ahead` days.
    Each entry: {"name": str, "date": date, "evening_dt": datetime (UTC approx)}
    """
    today = datetime.now(timezone.utc).date()
    end = today + timedelta(days=days_ahead)

    params = {
        "cfg": "json",
        "v": "1",
        "i": "on",       # Israel mode
        "maj": "on",     # Major holidays only
        "nx": "off",     # Skip Rosh Chodesh
        "mf": "off",     # Skip minor fasts
        "ss": "off",     # Skip special shabbatot
        "start": today.isoformat(),
        "end": end.isoformat(),
    }

    resp = requests.get(HEBCAL_URL, params=params, timeout=10)
    resp.raise_for_status()
    data = resp.json()

    holidays = []
    for item in data.get("items", []):
        category = item.get("category", "")
        if category not in HOLIDAY_CATEGORIES:
            continue

        title = item.get("title", "")
        date_str = item.get("date", "")
        try:
            holiday_date = datetime.strptime(date_str[:10], "%Y-%m-%d").date()
        except ValueError:
            continue

        # Approximate holiday evening: sunset ~18:00 Israel time (UTC+3)
        evening_dt = datetime(
            holiday_date.year,
            holiday_date.month,
            holiday_date.day,
            15, 0, 0,  # 18:00 IST = 15:00 UTC
            tzinfo=timezone.utc,
        )

        holidays.append({
            "name": title,
            "date": holiday_date,
            "evening_dt": evening_dt,
        })

    return holidays


def holidays_within_hours(hours: int) -> list[dict]:
    """Return holidays whose evening is between now and `hours` from now."""
    now = datetime.now(timezone.utc)
    cutoff = now + timedelta(hours=hours)
    upcoming = get_upcoming_holidays(days_ahead=max(hours // 24 + 2, 7))
    return [h for h in upcoming if now <= h["evening_dt"] <= cutoff]
