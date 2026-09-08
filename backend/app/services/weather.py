"""
Weather & Air Quality Services.

Fetches real-time temperature, humidity, and heat index from Open-Meteo.
Fetches AQI from Open-Meteo Air Quality API.
Never fabricates synthetic temperatures or assumes clean air on provider failure.
"""
import asyncio
import logging
import os
from datetime import datetime, timezone
import httpx

logger = logging.getLogger(__name__)
WAQI_TOKEN = os.getenv("WAQI_TOKEN", "")


async def get_weather(lat: float, lon: float) -> dict:
    """
    Returns real-time temperature_c, humidity_pct, feels_like_c from Open-Meteo.
    On failure: logs provider failure and returns structured unavailable state.
    """
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
                    await asyncio.sleep(2 ** attempt)
                    continue
                r.raise_for_status()
                data = r.json()
                current = data.get("current", {})
                return {
                    "status": "available",
                    "provider": "open-meteo",
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

    # Provider unavailable — do not fabricate synthetic temperatures
    logger.warning(
        "[provider_failure] provider=open-meteo service=weather reason=%s timestamp=%s coord=(%.4f,%.4f)",
        str(last_error),
        datetime.now(timezone.utc).isoformat(),
        lat,
        lon,
    )
    return {
        "status": "unavailable",
        "provider": "open-meteo",
        "temperature_c": None,
        "humidity_pct": None,
        "feels_like_c": None,
    }


async def get_aqi(lat: float, lon: float) -> dict:
    """
    Returns AQI (0–500 scale) from Open-Meteo Air Quality API.
    On failure: returns structured unavailable state (never assumes clean air).
    """
    url = f"https://air-quality-api.open-meteo.com/v1/air-quality?latitude={lat}&longitude={lon}&current=us_aqi"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(url)
            r.raise_for_status()
            data = r.json()
            current = data.get("current", {})
            if "us_aqi" in current and current["us_aqi"] is not None:
                return {
                    "value": int(current["us_aqi"]),
                    "status": "available",
                    "provider": "open-meteo",
                }
    except Exception as e:
        logger.warning(
            "[provider_failure] provider=open-meteo service=aqi reason=%s: %s timestamp=%s coord=(%.4f,%.4f)",
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