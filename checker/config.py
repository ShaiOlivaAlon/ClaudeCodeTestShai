import os

# Home location: King George 12 St, Tel Aviv
HOME_LAT = 32.0735
HOME_LNG = 34.7749
SEARCH_RADIUS_KM = 1.0

# Alert threshold: notify if this many or fewer cars available
CAR_ALERT_THRESHOLD = 3

# How many hours before the holiday evening to start checking
HOLIDAY_CHECK_WINDOW_HOURS = 48

# Auto-rent: trigger this many hours before holiday evening
AUTO_RENT_HOURS_BEFORE = 4

# Auto-rent confirmation window in minutes (cancel if no ACK)
AUTO_RENT_CONFIRM_MINUTES = 30

# Telegram
TELEGRAM_BOT_TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
TELEGRAM_CHAT_ID = os.environ["TELEGRAM_CHAT_ID"]

# GoTo credentials
GOTO_EMAIL = os.environ.get("GOTO_EMAIL", "")
GOTO_PASSWORD = os.environ.get("GOTO_PASSWORD", "")

# GitHub Gist for state persistence
GIST_TOKEN = os.environ["GIST_TOKEN"]
GIST_ID = os.environ["GIST_ID"]

# Feature flags
AUTO_RENT_ENABLED = os.environ.get("AUTO_RENT_ENABLED", "false").lower() == "true"
GOTO_DRY_RUN = os.environ.get("GOTO_DRY_RUN", "false").lower() == "true"
FORCE_ALERT = os.environ.get("FORCE_ALERT", "false").lower() == "true"

# GoTo API base URL — fill in after mitmproxy discovery
# See docs/goto_api_discovery.md
GOTO_API_BASE = os.environ.get("GOTO_API_BASE", "https://api.gotoglobal.com")
