# GoTo API Discovery via mitmproxy

GoTo does not publish a public API. This guide explains how to intercept
your iPhone's traffic to discover the API endpoints the GoTo app uses, so
the checker can call them directly.

## What you need
- A Mac on the same Wi-Fi network as your iPhone
- mitmproxy (`brew install mitmproxy`)

---

## Step 1 — Start the proxy on your Mac

```bash
mitmproxy --listen-host 0.0.0.0 --listen-port 8080
```

Find your Mac's local IP address:
```bash
ipconfig getifaddr en0
# e.g. 192.168.1.42
```

---

## Step 2 — Configure your iPhone

1. **Settings → Wi-Fi → tap your network → Configure Proxy**
2. Set to **Manual**
3. Server: `<your Mac IP>`, Port: `8080`
4. Tap **Save**

---

## Step 3 — Install the mitmproxy certificate

1. On your iPhone, open **Safari** and navigate to `http://mitm.it`
2. Tap **Get mitmproxy-ca-cert.pem** → **Allow** → Install profile
3. **Settings → General → VPN & Device Management** → tap the mitmproxy profile → **Install**
4. **Settings → General → About → Certificate Trust Settings** → toggle **mitmproxy** to trusted

---

## Step 4 — Capture GoTo traffic

1. Open the GoTo app on your iPhone
2. Log in (if not already)
3. Tap **Find a car** and browse cars near your location
4. In mitmproxy, press `/` and search for `goto` or `gotoglobal` to filter requests
5. Press `Enter` on each request to see full details

---

## Step 5 — Endpoints to capture

### Authentication
- **URL**: the login/token endpoint (POST request when you log in)
- **Request body**: email + password (or refresh token)
- **Response**: look for `access_token`, `token`, or `jwt`

### Car search
- **URL**: triggered when you browse the map for cars
- **Query params**: should include latitude, longitude, and radius
- **Response**: array of vehicle objects — note the field names for lat, lng, id, model

### Booking (optional — for auto-rent)
- **URL**: triggered when you tap **Reserve**
- **Request body**: vehicle ID
- **Response**: booking/reservation ID

### Cancel (optional — for auto-rent)
- **URL**: triggered when you tap **Cancel reservation**
- Usually a DELETE request to a URL containing the reservation ID

---

## Step 6 — Update goto_client.py

Fill in the discovered endpoints in `checker/goto_client.py`:

```python
_AUTH_ENDPOINT = "/path/you/found"
_VEHICLES_ENDPOINT = "/path/you/found"
_BOOKING_ENDPOINT = "/path/you/found"
_CANCEL_ENDPOINT = "/path/you/found/{id}"
```

Also update `GOTO_API_BASE` in `config.py` (or set the env var) with the
correct base URL (e.g. `https://api.gotoglobal.com`).

If the response field names differ from the guesses in `_normalise_vehicle()`,
update that function accordingly.

---

## Step 7 — Restore iPhone proxy settings

When done: **Settings → Wi-Fi → network → Configure Proxy → Off**

---

## Notes on token refresh

The Bearer token captured from the app will expire. The checker stores the
token + expiry in the Gist state and re-authenticates automatically when it
expires. If the app uses OAuth refresh tokens, add a `refresh_token` field
to the auth flow in `goto_client.py`.
