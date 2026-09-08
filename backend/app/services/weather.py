"""
Weather & Air Quality Services.

Fetches real-time temperature, humidity, and heat index from Open-Meteo.
Fetches AQI from Open-Meteo Air Quality API.
Never fabricates synthetic temperatures or assumes clean air on provider failure.
"""
import asyncio
import logging
import os
import time
from datetime import datetime, timezone
import httpx
from app.services.metrics import metrics

logger = logging.getLogger(__name__)
WAQI_TOKEN = os.getenv("WAQI_TOKEN", "")


def _classify_error(e: Exception) -> str:
    """Classify exception into a structured provider status."""
    if isinstance(e, (httpx.TimeoutException, asyncio.TimeoutError)):
        return "timeout"
    if isinstance(e, (httpx.ConnectError, httpx.NetworkError)):
        return "unreachable"
    if isinstance(e, httpx.HTTPStatusError):
        if e.response.status_code == 429:
            return "rate_limited"
        return "http_error"
    return "error"


async def get_weather(lat: float, lon: float) -> dict:
    """
    Returns real-time temperature_c, humidity_pct, feels_like_c from Open-Meteo.
    Includes data freshness (observed_at, age_seconds) and provider diagnostics.
    On failure: logs provider failure, records metrics, and returns structured unavailable state.
    """
    start_time = time.perf_counter()
    url = (
        f"https://api.open-meteo.com/v1/forecast"
        f"?latitude={lat}&longitude={lon}"
        f"&current=temperature_2m,relative_humidity_2m,apparent_temperature"
        f"&forecast_days=1"
    )

    last_error = None
    for attempt in range(3):
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                r = await client.get(url)
                if r.status_code == 429:
                    logger.warning(
                        "[provider_rate_limited] provider=open-meteo service=weather attempt=%d/3 coord=(%.4f,%.4f)",
                        attempt + 1, lat, lon
                    )
                    last_error = httpx.HTTPStatusError("Rate limited", request=r.request, response=r)
                    await asyncio.sleep(2 ** attempt)
                    continue
                r.raise_for_status()
                data = r.json()
                current = data.get("current", {})
                duration_ms = (time.perf_counter() - start_time) * 1000
                metrics.record_provider_call("weather", duration_ms, success=True)
                now_iso = datetime.now(timezone.utc).isoformat()
                return {
                    "status": "available",
                    "provider": "open-meteo",
                    "provider_status": "healthy",
                    "observed_at": now_iso,
                    "age_seconds": 0,
                    "retry_after": None,
                    "temperature_c": float(current["temperature_2m"]),
                    "humidity_pct":  float(current["relative_humidity_2m"]),
                    "feels_like_c":  float(current["apparent_temperature"]),
                }
        except Exception as e:
            last_error = e
            logger.warning(
                "[provider_error] provider=open-meteo service=weather attempt=%d/3 reason=%s: %s coord=(%.4f,%.4f)",
                attempt + 1, type(e).__name__, e, lat, lon
            )
            if attempt < 2:
                await asyncio.sleep(2 ** attempt)
                continue

    # Provider unavailable — record failure metrics and return structured metadata
    duration_ms = (time.perf_counter() - start_time) * 1000
    provider_status = _classify_error(last_error) if last_error else "unreachable"
    metrics.record_provider_call("weather", duration_ms, success=False, failure_type=provider_status)

    logger.warning(
        "[provider_failure] provider=open-meteo service=weather status=%s reason=%s timestamp=%s coord=(%.4f,%.4f)",
        provider_status,
        str(last_error),
        datetime.now(timezone.utc).isoformat(),
        lat,
        lon,
    )
    return {
        "status": "unavailable",
        "provider": "open-meteo",
        "provider_status": provider_status,
        "retry_after": 60,
        "observed_at": None,
        "age_seconds": None,
        "temperature_c": None,
        "humidity_pct": None,
        "feels_like_c": None,
    }


async def get_aqi(lat: float, lon: float) -> dict:
    """
    Returns AQI (0–500 scale) from Open-Meteo Air Quality API.
    Includes data freshness and provider diagnostics.
    On failure: returns structured unavailable state (never assumes clean air).
    """
    start_time = time.perf_counter()
    url = f"https://air-quality-api.open-meteo.com/v1/air-quality?latitude={lat}&longitude={lon}&current=us_aqi"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(url)
            r.raise_for_status()
            data = r.json()
            current = data.get("current", {})
            if "us_aqi" in current and current["us_aqi"] is not None:
                duration_ms = (time.perf_counter() - start_time) * 1000
                metrics.record_provider_call("aqi", duration_ms, success=True)
                now_iso = datetime.now(timezone.utc).isoformat()
                return {
                    "value": int(current["us_aqi"]),
                    "status": "available",
                    "provider": "open-meteo",
                    "provider_status": "healthy",
                    "observed_at": now_iso,
                    "age_seconds": 0,
                    "retry_after": None,
                }
    except Exception as e:
        duration_ms = (time.perf_counter() - start_time) * 1000
        provider_status = _classify_error(e)
        metrics.record_provider_call("aqi", duration_ms, success=False, failure_type=provider_status)
        logger.warning(
            "[provider_failure] provider=open-meteo service=aqi status=%s reason=%s: %s timestamp=%s coord=(%.4f,%.4f)",
            provider_status,
            type(e).__name__,
            e,
            datetime.now(timezone.utc).isoformat(),
            lat,
            lon,
        )
        return {
            "value": None,
            "status": "unavailable",
            "provider": "open-meteo",
            "provider_status": provider_status,
            "retry_after": 60,
            "observed_at": None,
            "age_seconds": None,
        }

    return {
        "value": None,
        "status": "unavailable",
        "provider": "open-meteo",
        "provider_status": "unreachable",
        "retry_after": 60,
        "observed_at": None,
        "age_seconds": None,
    }


def compute_heat_index(temp_c: float, humidity_pct: float) -> float:
    """
    Steadman heat index formula (°C).
    Accurate above 27°C and 40% humidity — the Indian summer range.
    """
    if temp_c is None or humidity_pct is None:
        return None

    T = temp_c
    R = humidity_pct

    if T < 27:
        return round(T, 2)

    HI = (
        -8.78469475556
        + 1.61139411    * T
        + 2.33854883889 * R
        - 0.14611605    * T * R
        - 0.012308094   * T**2
        - 0.016424828   * R**2
        + 0.002211732   * T**2 * R
        + 0.00072546    * T   * R**2
        - 0.000003582   * T**2 * R**2
    )
    return round(HI, 2)