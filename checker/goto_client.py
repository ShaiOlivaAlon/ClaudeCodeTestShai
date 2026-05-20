"""
GoTo (Car2Go Israel) API client.

IMPORTANT: GoTo does not have a public API. The endpoints below were
discovered via mitmproxy traffic sniffing — see docs/goto_api_discovery.md
for instructions on how to capture and update them.

Set GOTO_API_BASE env var if the base URL differs from the default.
Set GOTO_DRY_RUN=true to skip real API calls (for testing).
"""
import math
from datetime import datetime, timezone
import requests

from config import GOTO_EMAIL, GOTO_PASSWORD, GOTO_API_BASE, GOTO_DRY_RUN

# ── Endpoints (fill in after mitmproxy sniffing) ──────────────────────────────
# These are educated guesses based on common car-sharing API patterns.
# Override GOTO_API_BASE to point at the correct host.
_AUTH_ENDPOINT = "/api/v1/auth/token"           # POST: email + password → token
_VEHICLES_ENDPOINT = "/api/v1/vehicles/nearby"  # GET: ?lat&lng&radius_km → list
_BOOKING_ENDPOINT = "/api/v1/bookings"          # POST: {vehicle_id} → reservation
_CANCEL_ENDPOINT = "/api/v1/bookings/{id}"      # DELETE


class GoToClient:
    def __init__(self, token: str | None = None, token_expiry: str | None = None):
        self._token = token
        self._token_expiry = (
            datetime.fromisoformat(token_expiry) if token_expiry else None
        )
        self._session = requests.Session()

    # ── Auth ──────────────────────────────────────────────────────────────────

    def _is_token_valid(self) -> bool:
        if not self._token or not self._token_expiry:
            return False
        return datetime.now(timezone.utc) < self._token_expiry

    def authenticate(self) -> None:
        if self._is_token_valid():
            return
        if GOTO_DRY_RUN:
            self._token = "dry-run-token"
            self._token_expiry = datetime(2099, 1, 1, tzinfo=timezone.utc)
            return

        resp = self._session.post(
            GOTO_API_BASE + _AUTH_ENDPOINT,
            json={"email": GOTO_EMAIL, "password": GOTO_PASSWORD},
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        # Adjust these field names after inspecting the real API response
        self._token = data.get("access_token") or data.get("token")
        expires_in = data.get("expires_in", 3600)
        from datetime import timedelta
        self._token_expiry = datetime.now(timezone.utc) + timedelta(seconds=expires_in)

    @property
    def auth_headers(self) -> dict:
        return {"Authorization": f"Bearer {self._token}"}

    def token_state(self) -> dict:
        return {
            "goto_token": self._token,
            "goto_token_expiry": self._token_expiry.isoformat() if self._token_expiry else None,
        }

    # ── Car search ────────────────────────────────────────────────────────────

    def get_nearby_cars(self, lat: float, lng: float, radius_km: float) -> list[dict]:
        """Return list of available cars near (lat, lng) within radius_km."""
        if GOTO_DRY_RUN:
            return _mock_cars(lat, lng, radius_km)

        resp = self._session.get(
            GOTO_API_BASE + _VEHICLES_ENDPOINT,
            headers=self.auth_headers,
            params={"lat": lat, "lng": lng, "radius_km": radius_km},
            timeout=15,
        )
        resp.raise_for_status()
        vehicles = resp.json()

        # Normalise to a standard schema — adjust field names after sniffing
        return [_normalise_vehicle(v) for v in (vehicles if isinstance(vehicles, list) else vehicles.get("vehicles", []))]

    # ── Booking ───────────────────────────────────────────────────────────────

    def book_car(self, vehicle_id: str) -> str:
        """Create a booking. Returns reservation_id."""
        if GOTO_DRY_RUN:
            return "dry-run-reservation-001"

        resp = self._session.post(
            GOTO_API_BASE + _BOOKING_ENDPOINT,
            headers=self.auth_headers,
            json={"vehicle_id": vehicle_id},
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        # Adjust field name after sniffing
        return data.get("id") or data.get("reservation_id") or data.get("booking_id")

    def cancel_booking(self, reservation_id: str) -> None:
        if GOTO_DRY_RUN:
            return

        resp = self._session.delete(
            GOTO_API_BASE + _CANCEL_ENDPOINT.format(id=reservation_id),
            headers=self.auth_headers,
            timeout=15,
        )
        resp.raise_for_status()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _normalise_vehicle(v: dict) -> dict:
    """Map GoTo API vehicle object to a consistent internal schema."""
    return {
        "id": v.get("id") or v.get("vehicleId") or v.get("vehicle_id"),
        "model": v.get("model") or v.get("vehicleType") or v.get("type", "Car"),
        "plate": v.get("licensePlate") or v.get("plate") or v.get("license_plate", ""),
        "lat": float(v.get("lat") or v.get("latitude") or 0),
        "lng": float(v.get("lng") or v.get("longitude") or 0),
        "address": v.get("address") or v.get("streetAddress") or "",
        "fuel_pct": v.get("fuelLevel") or v.get("fuel_level") or v.get("fuelPercent"),
    }


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


def _mock_cars(lat: float, lng: float, radius_km: float) -> list[dict]:
    """Return 2 fake cars within radius for dry-run testing."""
    return [
        {"id": "mock-001", "model": "Volkswagen Up", "plate": "12-345-67", "lat": lat + 0.004, "lng": lng + 0.003, "address": "Dizengoff 50, Tel Aviv", "fuel_pct": 80},
        {"id": "mock-002", "model": "Seat Mii", "plate": "98-765-43", "lat": lat - 0.005, "lng": lng + 0.001, "address": "Ben Yehuda 10, Tel Aviv", "fuel_pct": 65},
    ]
