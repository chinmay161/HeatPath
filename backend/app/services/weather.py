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
from datetime import datetime, timedelta, timezone
from typing import Optional
import httpx
from app.config import config
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


def compute_hourly_comfort(
    temp_c: float,
    feels_like_c: float,
    humidity_pct: float,
    uv_index: float,
    wind_kmh: float,
) -> float:
    """Compute outdoor comfort score (0.0–1.0) from temperature, humidity, UV, and wind."""
    effective_t = feels_like_c if feels_like_c is not None else temp_c
    if effective_t is None:
        return 0.5

    if effective_t <= 22:
        score = 0.95
    elif effective_t <= 26:
        score = 0.90
    elif effective_t <= 30:
        score = 0.75 - (effective_t - 26) * 0.04
    elif effective_t <= 35:
        score = 0.59 - (effective_t - 30) * 0.05
    elif effective_t <= 40:
        score = 0.34 - (effective_t - 35) * 0.05
    else:
        score = max(0.05, 0.09 - (effective_t - 40) * 0.02)

    # UV penalty for daytime exposure
    if uv_index is not None:
        if uv_index >= 8:
            score -= 0.12
        elif uv_index >= 6:
            score -= 0.06

    # Mild breeze improvement
    if wind_kmh is not None and 6 <= wind_kmh <= 20:
        score += 0.04

    return round(max(0.0, min(1.0, score)), 2)


FORECAST_HOURS = 24


def format_utc_offset(offset_seconds: int) -> str:
    """Format a UTC offset in seconds as ISO 8601, e.g. 19800 -> "+05:30", -12600 -> "-03:30"."""
    sign = "-" if offset_seconds < 0 else "+"
    minutes = abs(int(offset_seconds)) // 60
    return f"{sign}{minutes // 60:02d}:{minutes % 60:02d}"


def build_forecast_hours(data: dict, now_utc: datetime) -> list:
    """
    Turn an Open-Meteo hourly response (requested with timezone=auto) into the next
    24 hours, starting at the current local hour.

    Open-Meteo returns local wall-clock times without an offset ("2026-10-22T18:00")
    plus utc_offset_seconds, so each time is returned as full ISO 8601 with its offset
    ("2026-10-22T18:00+05:30"). Best time is the 3 most comfortable hours between
    FORECAST_BEST_TIME_START_HOUR and FORECAST_BEST_TIME_END_HOUR local (inclusive);
    if none fall in that window, none are marked.
    """
    hourly = data.get("hourly", {})
    times = hourly.get("time", [])
    temps = hourly.get("temperature_2m", [])
    humidities = hourly.get("relative_humidity_2m", [])
    feels_likes = hourly.get("apparent_temperature", [])
    precips = hourly.get("precipitation_probability", [])
    uvs = hourly.get("uv_index", [])
    winds = hourly.get("wind_speed_10m", [])

    offset_seconds = int(data.get("utc_offset_seconds") or 0)
    offset_str = format_utc_offset(offset_seconds)
    local_now = (now_utc.astimezone(timezone.utc) + timedelta(seconds=offset_seconds)).replace(tzinfo=None)
    current_hour = local_now.replace(minute=0, second=0, microsecond=0)

    hours_out = []
    for i, raw_time in enumerate(times):
        if len(hours_out) >= FORECAST_HOURS:
            break
        try:
            local_time = datetime.fromisoformat(raw_time)
        except (TypeError, ValueError):
            continue
        if local_time < current_hour:
            continue

        t_c = float(temps[i]) if i < len(temps) and temps[i] is not None else 25.0
        hum = float(humidities[i]) if i < len(humidities) and humidities[i] is not None else 50.0
        feel_c = float(feels_likes[i]) if i < len(feels_likes) and feels_likes[i] is not None else t_c
        precip = float(precips[i]) if i < len(precips) and precips[i] is not None else 0.0
        uv = float(uvs[i]) if i < len(uvs) and uvs[i] is not None else 0.0
        wind = float(winds[i]) if i < len(winds) and winds[i] is not None else 0.0

        comfort = compute_hourly_comfort(t_c, feel_c, hum, uv, wind)
        sev = "SAFE" if comfort >= 0.70 else "CAUTION" if comfort >= 0.50 else "HIGH" if comfort >= 0.30 else "EXTREME"

        hours_out.append({
            "time": f"{local_time.strftime('%Y-%m-%dT%H:%M')}{offset_str}",
            "local_hour": local_time.hour,
            "temperature_c": t_c,
            "humidity_pct": hum,
            "feels_like_c": feel_c,
            "uv_index": uv,
            "precipitation_probability": precip,
            "wind_speed_kmh": wind,
            "comfort_score": comfort,
            "severity": sev,
            "is_best_time": False,
        })

    # Best time: top 3 comfortable hours within the daytime walking window only
    start_h = config.FORECAST_BEST_TIME_START_HOUR
    end_h = config.FORECAST_BEST_TIME_END_HOUR
    candidates = [idx for idx, h in enumerate(hours_out) if start_h <= h["local_hour"] <= end_h]
    ranked = sorted(candidates, key=lambda idx: hours_out[idx]["comfort_score"], reverse=True)
    for idx in ranked[:3]:
        hours_out[idx]["is_best_time"] = True

    for h in hours_out:
        del h["local_hour"]
    return hours_out


async def get_hourly_forecast(lat: float, lon: float, now: Optional[datetime] = None) -> dict:
    """
    Fetch the next 24 hours of weather and comfort forecast from Open-Meteo,
    in the location's local time with UTC offsets. `now` is for tests.
    Returns structured unavailable state on provider failure.
    """
    start_time = time.perf_counter()
    # timezone=auto: hours in local time; 2 days so 24 hours remain even late in the day
    url = (
        f"https://api.open-meteo.com/v1/forecast"
        f"?latitude={lat}&longitude={lon}"
        f"&hourly=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,uv_index,wind_speed_10m"
        f"&timezone=auto"
        f"&forecast_days=2"
    )

    last_error = None
    for attempt in range(3):
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                r = await client.get(url)
                if r.status_code == 429:
                    logger.warning(
                        "[provider_rate_limited] provider=open-meteo service=forecast attempt=%d/3 coord=(%.4f,%.4f)",
                        attempt + 1, lat, lon
                    )
                    last_error = httpx.HTTPStatusError("Rate limited", request=r.request, response=r)
                    await asyncio.sleep(2 ** attempt)
                    continue
                r.raise_for_status()
                data = r.json()
                now_utc = now or datetime.now(timezone.utc)
                hours_out = build_forecast_hours(data, now_utc)

                if not hours_out:
                    break

                duration_ms = (time.perf_counter() - start_time) * 1000
                metrics.record_provider_call("forecast", duration_ms, success=True)
                now_iso = now_utc.isoformat()

                return {
                    "status": "available",
                    "provider": "open-meteo",
                    "provider_status": "healthy",
                    "observed_at": now_iso,
                    "hours": hours_out,
                }
        except Exception as e:
            last_error = e
            logger.warning(
                "[provider_error] provider=open-meteo service=forecast attempt=%d/3 reason=%s: %s coord=(%.4f,%.4f)",
                attempt + 1, type(e).__name__, e, lat, lon
            )
            if attempt < 2:
                await asyncio.sleep(2 ** attempt)
                continue

    # Fallback unavailable response
    duration_ms = (time.perf_counter() - start_time) * 1000
    provider_status = _classify_error(last_error) if last_error else "unreachable"
    metrics.record_provider_call("forecast", duration_ms, success=False, failure_type=provider_status)

    return {
        "status": "unavailable",
        "provider": "open-meteo",
        "provider_status": provider_status,
        "retry_after": 60,
        "observed_at": None,
        "hours": [],
    }