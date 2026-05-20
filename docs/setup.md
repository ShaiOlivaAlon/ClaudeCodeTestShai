# Setup Guide — GoTo Holiday Car Checker

## Overview
A GitHub Actions workflow runs every 30 minutes, checks for upcoming Israeli
holidays, and alerts you on Telegram if fewer than 4 GoTo cars are available
within 1km of King George 12 St, Tel Aviv.

---

## Step 1 — Create a Telegram Bot

1. Open Telegram and message **@BotFather**
2. Send `/newbot` and follow the prompts
3. Copy the **bot token** (looks like `123456789:ABCdef...`)
4. Message your new bot once (so it can find your chat ID)
5. Visit `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates` in a browser
6. Find `"chat": {"id": 123456789}` — that number is your **chat ID**

---

## Step 2 — Create a GitHub Gist for state storage

1. Go to <https://gist.github.com>
2. Create a new **secret** Gist with filename `goto_checker_state.json` and content `{}`
3. Copy the **Gist ID** from the URL: `https://gist.github.com/<username>/<GIST_ID>`
4. Create a **GitHub Personal Access Token** with `gist` scope:
   - <https://github.com/settings/tokens> → New token → tick **gist** → Generate
   - Copy the token

---

## Step 3 — Discover the GoTo API

Follow `docs/goto_api_discovery.md` to capture GoTo's API endpoints with
mitmproxy, then update `checker/goto_client.py` with the real endpoints.

---

## Step 4 — Add GitHub Secrets

In your repository: **Settings → Secrets and variables → Actions → New secret**

| Secret name | Value |
|-------------|-------|
| `TELEGRAM_BOT_TOKEN` | Bot token from Step 1 |
| `TELEGRAM_CHAT_ID` | Chat ID from Step 1 |
| `GOTO_EMAIL` | Your GoTo account email |
| `GOTO_PASSWORD` | Your GoTo account password |
| `GIST_TOKEN` | GitHub PAT from Step 2 |
| `GIST_ID` | Gist ID from Step 2 |

---

## Step 5 — Test with a manual run

1. Go to **Actions → GoTo Holiday Car Checker → Run workflow**
2. Tick **Dry run** (uses mock cars, no real GoTo API calls)
3. Tick **Send a test alert** to force a Telegram message
4. Click **Run workflow**
5. Check your Telegram — you should receive an alert with an **Acknowledged** button

---

## Step 6 — Enable auto-rent (optional)

Auto-rent is **disabled by default**. When you're confident the GoTo API
endpoints are correct and tested:

- For a one-off run: use the manual workflow dispatch with **Enable auto-rent** ticked
- To enable permanently: set the `AUTO_RENT_ENABLED` env var to `true` in the
  workflow file (`.github/workflows/holiday_car_checker.yml`)

Auto-rent flow:
1. Triggers 4 hours before the holiday evening
2. Books the nearest available car
3. Sends a Telegram message with **[KEEP]** and **[Cancel]** buttons
4. If no response within 30 minutes: automatically cancels the booking

---

## Adjusting settings

Edit `checker/config.py` to change:
- `CAR_ALERT_THRESHOLD` — alert when ≤ this many cars (default: 3)
- `SEARCH_RADIUS_KM` — search radius in km (default: 1.0)
- `HOLIDAY_CHECK_WINDOW_HOURS` — how far ahead to start checking (default: 48h)
- `AUTO_RENT_HOURS_BEFORE` — when to trigger auto-rent (default: 4h before holiday)
- `AUTO_RENT_CONFIRM_MINUTES` — confirmation window before auto-cancel (default: 30 min)
