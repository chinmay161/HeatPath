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
from app.services import provider_cache
from app.services.metrics import metrics
from app.services.provider_cache import (
    age_seconds,
    cache_key,
    grid_cell,
    is_fresh,
    open_meteo_breaker,
    parse_retry_after,
    read_entry,
    write_entry,
)

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


def _iso(epoch_seconds: float) -> str:
    return datetime.fromtimestamp(epoch_seconds, tz=timezone.utc).isoformat()


def _trip_on_rate_limit(r: httpx.Response, service: str, lat: float, lon: float) -> None:
    """A 429 is never retried: open the circuit for Retry-After seconds instead."""
    retry_after = parse_retry_after(r.headers.get("Retry-After"))
    logger.warning(
        "[provider_rate_limited] provider=open-meteo service=%s retry_after=%ds coord=(%.4f,%.4f)",
        service, retry_after, lat, lon,
    )
    open_meteo_breaker.trip(retry_after)


def _retry_after_for(provider_status: str) -> int:
    if provider_status == "rate_limited":
        return open_meteo_breaker.remaining() or config.OPEN_METEO_RATE_LIMIT_DEFAULT_SECONDS
    return 60


async def _call_open_meteo(url: str, service: str, lat: float, lon: float, parse, max_attempts: int) -> tuple:
    """
    Call Open-Meteo within OPEN_METEO_CALL_BUDGET_SECONDS in total, so the server
    always answers before the app's per-attempt timeout. Each attempt gets at most
    OPEN_METEO_ATTEMPT_TIMEOUT_SECONDS (and never more than the budget left); a
    failed attempt is retried after OPEN_METEO_RETRY_WAIT_SECONDS, up to max_attempts.
    A 429 is never retried: it opens the circuit breaker instead.

    `parse(json)` returns the value to cache, or None when the response has no usable
    data. Returns (value or None, provider_status).
    """
    start_time = time.perf_counter()
    deadline = time.monotonic() + config.OPEN_METEO_CALL_BUDGET_SECONDS
    last_error: Optional[Exception] = None
    provider_status = None

    for attempt in range(max_attempts):
        if open_meteo_breaker.is_open:
            provider_status = "rate_limited"
            break
        if deadline - time.monotonic() <= 0:
            last_error = last_error or asyncio.TimeoutError("Open-Meteo call budget exhausted")
            break
        try:
            async with httpx.AsyncClient() as client:
                # Sized after the client is built, so its setup time counts against the budget
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise asyncio.TimeoutError("Open-Meteo call budget exhausted")
                attempt_timeout = min(config.OPEN_METEO_ATTEMPT_TIMEOUT_SECONDS, remaining)
                # wait_for bounds the whole attempt; httpx's timeout applies per phase
                r = await asyncio.wait_for(client.get(url, timeout=attempt_timeout), timeout=attempt_timeout)
            if r.status_code == 429:
                _trip_on_rate_limit(r, service, lat, lon)
                last_error = httpx.HTTPStatusError("Rate limited", request=r.request, response=r)
                break
            r.raise_for_status()
            value = parse(r.json())
            if value is None:
                provider_status = "unreachable"
                break
            duration_ms = (time.perf_counter() - start_time) * 1000
            metrics.record_provider_call(service, duration_ms, success=True)
            return value, "healthy"
        except Exception as e:
            last_error = e
            logger.warning(
                "[provider_error] provider=open-meteo service=%s attempt=%d/%d reason=%s: %s coord=(%.4f,%.4f)",
                service, attempt + 1, max_attempts, type(e).__name__, e, lat, lon
            )
            if attempt < max_attempts - 1:
                wait = min(config.OPEN_METEO_RETRY_WAIT_SECONDS, deadline - time.monotonic())
                if wait > 0:
                    await asyncio.sleep(wait)

    if provider_status is None:
        provider_status = _classify_error(last_error) if last_error else "unreachable"
    duration_ms = (time.perf_counter() - start_time) * 1000
    metrics.record_provider_call(service, duration_ms, success=False, failure_type=provider_status)
    logger.warning(
        "[provider_failure] provider=open-meteo service=%s status=%s reason=%s timestamp=%s coord=(%.4f,%.4f)",
        service,
        provider_status,
        str(last_error),
        datetime.now(timezone.utc).isoformat(),
        lat,
        lon,
    )
    return None, provider_status



# --- Current weather -----------------------------------------------------------

def _weather_unavailable(provider_status: str) -> dict:
    return {
        "status": "unavailable",
        "provider": "open-meteo",
        "provider_status": provider_status,
        "retry_after": _retry_after_for(provider_status),
        "stale": False,
        "observed_at": None,
        "age_seconds": None,
        "temperature_c": None,
        "humidity_pct": None,
        "feels_like_c": None,
    }


def _weather_from_entry(entry: dict, provider_status: str = "healthy", stale: bool = False) -> dict:
    data = entry["data"]
    return {
        "status": "available",
        "provider": "open-meteo",
        "provider_status": provider_status,
        "retry_after": _retry_after_for(provider_status) if stale else None,
        "stale": stale,
        "observed_at": _iso(float(entry["fetched_at"])),
        "age_seconds": age_seconds(entry),
        "temperature_c": data["temperature_c"],
        "humidity_pct": data["humidity_pct"],
        "feels_like_c": data["feels_like_c"],
    }


async def _fetch_weather(lat: float, lon: float) -> tuple:
    """Call Open-Meteo for current weather. Returns (values dict or None, provider_status)."""
    url = (
        f"https://api.open-meteo.com/v1/forecast"
        f"?latitude={lat}&longitude={lon}"
        f"&current=temperature_2m,relative_humidity_2m,apparent_temperature"
        f"&forecast_days=1"
    )

    def parse(data: dict) -> dict:
        current = data.get("current", {})
        return {
            "temperature_c": float(current["temperature_2m"]),
            "humidity_pct": float(current["relative_humidity_2m"]),
            "feels_like_c": float(current["apparent_temperature"]),
        }

    return await _call_open_meteo(url, "weather", lat, lon, parse, config.OPEN_METEO_MAX_ATTEMPTS)


async def get_weather(lat: float, lon: float) -> dict:
    """
    Current temperature_c, humidity_pct, feels_like_c from Open-Meteo, cached per
    ~0.01° grid cell for WEATHER_CACHE_TTL_SECONDS. observed_at/age_seconds give the
    real fetch time. When the provider fails or is rate-limited, the last cached value
    (up to WEATHER_STALE_MAX_SECONDS old) is returned with stale=True; otherwise a
    structured unavailable state. A 429 is never retried and opens the circuit breaker.
    """
    key = cache_key("weather", lat, lon)
    entry = await read_entry(key)
    if entry and is_fresh(entry, config.WEATHER_CACHE_TTL_SECONDS):
        return _weather_from_entry(entry)

    if open_meteo_breaker.is_open:
        provider_status = "rate_limited"
    else:
        values, provider_status = await _fetch_weather(*grid_cell(lat, lon))
        if values is not None:
            await write_entry(key, values, config.WEATHER_STALE_MAX_SECONDS)
            return _weather_from_entry({"fetched_at": provider_cache.clock(), "data": values})

    if entry:
        return _weather_from_entry(entry, provider_status=provider_status, stale=True)
    return _weather_unavailable(provider_status)


# --- Air quality ---------------------------------------------------------------

def _aqi_unavailable(provider_status: str) -> dict:
    return {
        "value": None,
        "status": "unavailable",
        "provider": "open-meteo",
        "provider_status": provider_status,
        "retry_after": _retry_after_for(provider_status),
        "stale": False,
        "observed_at": None,
        "age_seconds": None,
    }


def _aqi_from_entry(entry: dict, provider_status: str = "healthy", stale: bool = False) -> dict:
    return {
        "value": entry["data"]["value"],
        "status": "available",
        "provider": "open-meteo",
        "provider_status": provider_status,
        "retry_after": _retry_after_for(provider_status) if stale else None,
        "stale": stale,
        "observed_at": _iso(float(entry["fetched_at"])),
        "age_seconds": age_seconds(entry),
    }


async def _fetch_aqi(lat: float, lon: float) -> tuple:
    """Call Open-Meteo Air Quality once (no retries). Returns (us_aqi or None, provider_status)."""
    url = f"https://air-quality-api.open-meteo.com/v1/air-quality?latitude={lat}&longitude={lon}&current=us_aqi"

    def parse(data: dict) -> Optional[int]:
        value = data.get("current", {}).get("us_aqi")
        return int(value) if value is not None else None

    return await _call_open_meteo(url, "aqi", lat, lon, parse, max_attempts=1)


async def get_aqi(lat: float, lon: float) -> dict:
    """
    US AQI (0–500) from Open-Meteo Air Quality, cached per ~0.01° grid cell for
    WEATHER_CACHE_TTL_SECONDS. On failure or rate limiting, the last cached value
    (up to WEATHER_STALE_MAX_SECONDS old) is returned with stale=True; otherwise a
    structured unavailable state (never assumes clean air).
    """
    key = cache_key("aqi", lat, lon)
    entry = await read_entry(key)
    if entry and is_fresh(entry, config.WEATHER_CACHE_TTL_SECONDS):
        return _aqi_from_entry(entry)

    if open_meteo_breaker.is_open:
        provider_status = "rate_limited"
    else:
        value, provider_status = await _fetch_aqi(*grid_cell(lat, lon))
        if value is not None:
            await write_entry(key, {"value": value}, config.WEATHER_STALE_MAX_SECONDS)
            return _aqi_from_entry({"fetched_at": provider_cache.clock(), "data": {"value": value}})

    if entry:
        return _aqi_from_entry(entry, provider_status=provider_status, stale=True)
    return _aqi_unavailable(provider_status)


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


def _forecast_unavailable(provider_status: str) -> dict:
    return {
        "status": "unavailable",
        "provider": "open-meteo",
        "provider_status": provider_status,
        "retry_after": _retry_after_for(provider_status),
        "stale": False,
        "observed_at": None,
        "age_seconds": None,
        "hours": [],
    }


def _forecast_from_entry(
    entry: dict, now_utc: datetime, provider_status: str = "healthy", stale: bool = False
) -> Optional[dict]:
    """Build the response from a cached raw Open-Meteo forecast; None if no hours remain."""
    hours = build_forecast_hours(entry["data"], now_utc)
    if not hours:
        return None
    return {
        "status": "available",
        "provider": "open-meteo",
        "provider_status": provider_status,
        "retry_after": _retry_after_for(provider_status) if stale else None,
        "stale": stale,
        "observed_at": _iso(float(entry["fetched_at"])),
        "age_seconds": age_seconds(entry),
        "hours": hours,
    }


async def _fetch_forecast(lat: float, lon: float) -> tuple:
    """Call Open-Meteo for the hourly forecast. Returns (raw response dict or None, provider_status)."""
    # timezone=auto: hours in local time; 2 days so 24 hours remain even late in the day
    url = (
        f"https://api.open-meteo.com/v1/forecast"
        f"?latitude={lat}&longitude={lon}"
        f"&hourly=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,uv_index,wind_speed_10m"
        f"&timezone=auto"
        f"&forecast_days=2"
    )

    def parse(data: dict) -> Optional[dict]:
        return data if data.get("hourly", {}).get("time") else None

    return await _call_open_meteo(url, "forecast", lat, lon, parse, config.OPEN_METEO_MAX_ATTEMPTS)


async def get_hourly_forecast(lat: float, lon: float, now: Optional[datetime] = None) -> dict:
    """
    The next 24 hours of weather and comfort forecast from Open-Meteo, in the
    location's local time with UTC offsets. `now` is for tests.

    The raw provider response is cached per ~0.01° grid cell for
    FORECAST_CACHE_TTL_SECONDS and re-sliced to the current hour on every request.
    On failure or rate limiting, the cached forecast (up to FORECAST_STALE_MAX_SECONDS
    old) is returned with stale=True; otherwise a structured unavailable state.
    A 429 is never retried and opens the circuit breaker.
    """
    now_utc = now or datetime.now(timezone.utc)
    key = cache_key("forecast", lat, lon)
    entry = await read_entry(key)
    if entry and is_fresh(entry, config.FORECAST_CACHE_TTL_SECONDS):
        result = _forecast_from_entry(entry, now_utc)
        if result:
            return result

    if open_meteo_breaker.is_open:
        provider_status = "rate_limited"
    else:
        raw, provider_status = await _fetch_forecast(*grid_cell(lat, lon))
        if raw is not None:
            await write_entry(key, raw, config.FORECAST_STALE_MAX_SECONDS)
            result = _forecast_from_entry({"fetched_at": provider_cache.clock(), "data": raw}, now_utc)
            if result:
                return result
            provider_status = "unreachable"

    if entry:
        stale = _forecast_from_entry(entry, now_utc, provider_status=provider_status, stale=True)
        if stale:
            return stale
    return _forecast_unavailable(provider_status)
