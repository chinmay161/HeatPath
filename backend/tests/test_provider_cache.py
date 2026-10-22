"""
Open-Meteo caching and rate-limit protection.

Weather and AQI are cached per ~0.01° grid cell for 10 min, the forecast for 30 min.
A 429 is never retried: it opens a circuit breaker for Retry-After seconds, during
which no Open-Meteo call is made and the last cached value is served, marked stale.
"""
import asyncio
import json
import re
from datetime import datetime, timezone
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient

import app.services.provider_cache as provider_cache
from app.config import config
from app.main import app
from app.services import weather
from app.services.provider_cache import TTLMemoryCache, cache_key, grid_cell, parse_retry_after

WEATHER_URL = re.compile(r"https://api\.open-meteo\.com/v1/forecast\?.*current=.*")
FORECAST_URL = re.compile(r"https://api\.open-meteo\.com/v1/forecast\?.*hourly=.*")
AQI_URL = re.compile(r"https://air-quality-api\.open-meteo\.com/.*")

WEATHER_JSON = {"current": {"temperature_2m": 31.0, "relative_humidity_2m": 70, "apparent_temperature": 36.0}}
AQI_JSON = {"current": {"us_aqi": 88}}
FORECAST_JSON = json.loads(
    (Path(__file__).parent / "fixtures" / "open_meteo_forecast_auto.json").read_text(encoding="utf-8")
)
NOW_1800_IST = datetime(2026, 10, 22, 12, 30, tzinfo=timezone.utc)


class FakeClock:
    def __init__(self, t: float = 1_800_000_000.0):
        self.t = t

    def __call__(self) -> float:
        return self.t

    def advance(self, seconds: float) -> None:
        self.t += seconds


@pytest.fixture
def clock(monkeypatch):
    fake = FakeClock()
    monkeypatch.setattr(provider_cache, "clock", fake)
    return fake


@pytest.fixture(autouse=True)
def no_backoff_sleep(monkeypatch):
    """Skip the 1 s / 2 s retry backoff on non-429 errors."""
    real_sleep = asyncio.sleep

    async def fast_sleep(delay, *args, **kwargs):
        return await real_sleep(0)
    monkeypatch.setattr(weather.asyncio, "sleep", fast_sleep)


def _requests(httpx_mock, url):
    return [r for r in httpx_mock.get_requests() if url.match(str(r.url))]


# --- TTL memory cache ---------------------------------------------------------

@pytest.mark.asyncio
async def test_memory_cache_expires_entries(clock):
    cache = TTLMemoryCache(max_entries=10)
    await cache.set("a", 1, ttl=60)
    clock.advance(59)
    assert await cache.get("a") == 1
    clock.advance(1)
    assert await cache.get("a") is None


@pytest.mark.asyncio
async def test_memory_cache_is_bounded_lru(clock):
    cache = TTLMemoryCache(max_entries=2)
    await cache.set("a", 1, ttl=60)
    await cache.set("b", 2, ttl=60)
    await cache.get("a")  # a is now most recently used
    await cache.set("c", 3, ttl=60)
    assert len(cache) == 2
    assert await cache.get("b") is None
    assert await cache.get("a") == 1
    assert await cache.get("c") == 3


# --- grid cells ---------------------------------------------------------------

def test_grid_cell_is_about_0_01_degrees():
    assert grid_cell(18.9221, 72.8347) == (18.92, 72.83)
    assert cache_key("weather", 18.9221, 72.8347) == cache_key("weather", 18.9249, 72.8312)
    assert cache_key("weather", 18.9221, 72.8347) != cache_key("weather", 18.9321, 72.8347)
    assert cache_key("weather", 18.92, 72.83) != cache_key("aqi", 18.92, 72.83)


# --- Retry-After parsing ------------------------------------------------------

def test_parse_retry_after():
    assert parse_retry_after("120") == 120
    assert parse_retry_after(None) == config.OPEN_METEO_RATE_LIMIT_DEFAULT_SECONDS
    assert parse_retry_after("Wed, 21 Oct 2026 07:28:00 GMT") == config.OPEN_METEO_RATE_LIMIT_DEFAULT_SECONDS
    assert parse_retry_after("0") == config.OPEN_METEO_RATE_LIMIT_DEFAULT_SECONDS


def test_breaker_is_capped(clock):
    breaker = provider_cache.CircuitBreaker("test")
    breaker.trip(10 ** 6)
    assert breaker.remaining() == config.OPEN_METEO_RATE_LIMIT_MAX_SECONDS


# --- current weather ----------------------------------------------------------

@pytest.mark.asyncio
async def test_weather_cached_per_cell_for_10_minutes(httpx_mock, clock):
    httpx_mock.add_response(url=WEATHER_URL, json=WEATHER_JSON)

    first = await weather.get_weather(18.9221, 72.8347)
    second = await weather.get_weather(18.9249, 72.8312)  # same cell
    assert first["temperature_c"] == second["temperature_c"] == 31.0
    assert len(_requests(httpx_mock, WEATHER_URL)) == 1
    assert "latitude=18.92&longitude=72.83" in str(httpx_mock.get_requests()[0].url)

    clock.advance(config.WEATHER_CACHE_TTL_SECONDS - 1)
    cached = await weather.get_weather(18.92, 72.83)
    assert cached["stale"] is False
    assert cached["age_seconds"] == config.WEATHER_CACHE_TTL_SECONDS - 1
    assert len(_requests(httpx_mock, WEATHER_URL)) == 1

    clock.advance(1)
    await weather.get_weather(18.92, 72.83)
    assert len(_requests(httpx_mock, WEATHER_URL)) == 2
    assert config.WEATHER_CACHE_TTL_SECONDS == 600


@pytest.mark.asyncio
async def test_weather_observed_at_is_the_real_fetch_time(httpx_mock, clock):
    httpx_mock.add_response(url=WEATHER_URL, json=WEATHER_JSON)
    fetched_at = clock.t
    await weather.get_weather(18.92, 72.83)
    clock.advance(300)
    result = await weather.get_weather(18.92, 72.83)
    assert result["observed_at"] == datetime.fromtimestamp(fetched_at, tz=timezone.utc).isoformat()
    assert result["age_seconds"] == 300


@pytest.mark.asyncio
async def test_weather_429_is_not_retried_and_opens_the_breaker(httpx_mock, clock):
    httpx_mock.add_response(url=WEATHER_URL, status_code=429, headers={"Retry-After": "120"})

    result = await weather.get_weather(18.92, 72.83)
    assert len(_requests(httpx_mock, WEATHER_URL)) == 1, "a 429 must never be retried"
    assert result["status"] == "unavailable"
    assert result["provider_status"] == "rate_limited"
    assert result["retry_after"] == 120

    # Inside the window: no calls at all, even for another cell
    clock.advance(119)
    blocked = await weather.get_weather(19.10, 72.90)
    assert blocked["provider_status"] == "rate_limited"
    assert blocked["retry_after"] == 1
    assert len(httpx_mock.get_requests()) == 1


@pytest.mark.asyncio
async def test_breaker_closes_after_retry_after(httpx_mock, clock):
    httpx_mock.add_response(url=WEATHER_URL, status_code=429, headers={"Retry-After": "30"})
    await weather.get_weather(18.92, 72.83)

    clock.advance(30)
    httpx_mock.add_response(url=WEATHER_URL, json=WEATHER_JSON)
    result = await weather.get_weather(18.92, 72.83)
    assert result["status"] == "available"
    assert len(_requests(httpx_mock, WEATHER_URL)) == 2


@pytest.mark.asyncio
async def test_429_without_retry_after_uses_the_default(httpx_mock, clock):
    httpx_mock.add_response(url=WEATHER_URL, status_code=429)
    result = await weather.get_weather(18.92, 72.83)
    assert result["retry_after"] == config.OPEN_METEO_RATE_LIMIT_DEFAULT_SECONDS == 60


@pytest.mark.asyncio
async def test_429_serves_the_last_cached_value_marked_stale(httpx_mock, clock):
    httpx_mock.add_response(url=WEATHER_URL, json=WEATHER_JSON)
    await weather.get_weather(18.92, 72.83)

    clock.advance(660)  # past the 10 min fresh TTL
    httpx_mock.add_response(url=WEATHER_URL, status_code=429, headers={"Retry-After": "90"})
    result = await weather.get_weather(18.92, 72.83)
    assert result["status"] == "available"
    assert result["stale"] is True
    assert result["age_seconds"] == 660
    assert result["provider_status"] == "rate_limited"
    assert result["retry_after"] == 90
    assert result["temperature_c"] == 31.0

    # While the breaker is open the stale value is served without calling the provider
    clock.advance(60)
    again = await weather.get_weather(18.92, 72.83)
    assert again["stale"] is True
    assert again["age_seconds"] == 720
    assert len(_requests(httpx_mock, WEATHER_URL)) == 2


@pytest.mark.asyncio
async def test_other_provider_errors_also_serve_stale(httpx_mock, clock):
    httpx_mock.add_response(url=WEATHER_URL, json=WEATHER_JSON)
    await weather.get_weather(18.92, 72.83)

    clock.advance(700)
    httpx_mock.add_response(url=WEATHER_URL, status_code=500)
    result = await weather.get_weather(18.92, 72.83)
    assert result["stale"] is True
    assert result["provider_status"] == "http_error"
    assert not provider_cache.open_meteo_breaker.is_open, "only a 429 opens the breaker"


@pytest.mark.asyncio
async def test_stale_values_expire_after_the_stale_limit(httpx_mock, clock):
    httpx_mock.add_response(url=WEATHER_URL, json=WEATHER_JSON)
    await weather.get_weather(18.92, 72.83)

    clock.advance(config.WEATHER_STALE_MAX_SECONDS)
    httpx_mock.add_response(url=WEATHER_URL, status_code=429)
    result = await weather.get_weather(18.92, 72.83)
    assert result["status"] == "unavailable"
    assert result["stale"] is False


# --- AQI ----------------------------------------------------------------------

@pytest.mark.asyncio
async def test_aqi_cached_for_10_minutes(httpx_mock, clock):
    httpx_mock.add_response(url=AQI_URL, json=AQI_JSON)
    assert (await weather.get_aqi(18.9221, 72.8347))["value"] == 88
    assert (await weather.get_aqi(18.9249, 72.8312))["value"] == 88
    assert len(_requests(httpx_mock, AQI_URL)) == 1

    clock.advance(config.WEATHER_CACHE_TTL_SECONDS)
    await weather.get_aqi(18.92, 72.83)
    assert len(_requests(httpx_mock, AQI_URL)) == 2


@pytest.mark.asyncio
async def test_aqi_429_opens_the_breaker_and_serves_stale(httpx_mock, clock):
    httpx_mock.add_response(url=AQI_URL, json=AQI_JSON)
    await weather.get_aqi(18.92, 72.83)

    clock.advance(900)
    httpx_mock.add_response(url=AQI_URL, status_code=429, headers={"Retry-After": "45"})
    result = await weather.get_aqi(18.92, 72.83)
    assert result["value"] == 88
    assert result["stale"] is True
    assert result["age_seconds"] == 900
    assert provider_cache.open_meteo_breaker.remaining() == 45


# --- one breaker for all Open-Meteo APIs --------------------------------------

@pytest.mark.asyncio
async def test_a_429_on_one_api_blocks_all_open_meteo_calls(httpx_mock, clock):
    httpx_mock.add_response(url=WEATHER_URL, status_code=429, headers={"Retry-After": "60"})
    await weather.get_weather(18.92, 72.83)

    aqi = await weather.get_aqi(18.92, 72.83)
    forecast = await weather.get_hourly_forecast(18.92, 72.83, now=NOW_1800_IST)
    assert aqi["provider_status"] == "rate_limited"
    assert forecast["provider_status"] == "rate_limited"
    assert len(httpx_mock.get_requests()) == 1


# --- forecast -----------------------------------------------------------------

@pytest.mark.asyncio
async def test_forecast_cached_for_30_minutes(httpx_mock, clock):
    httpx_mock.add_response(url=FORECAST_URL, json=FORECAST_JSON)
    await weather.get_hourly_forecast(18.9221, 72.8347, now=NOW_1800_IST)
    await weather.get_hourly_forecast(18.9249, 72.8312, now=NOW_1800_IST)
    assert len(_requests(httpx_mock, FORECAST_URL)) == 1

    clock.advance(config.FORECAST_CACHE_TTL_SECONDS - 1)
    await weather.get_hourly_forecast(18.92, 72.83, now=NOW_1800_IST)
    assert len(_requests(httpx_mock, FORECAST_URL)) == 1

    clock.advance(1)
    await weather.get_hourly_forecast(18.92, 72.83, now=NOW_1800_IST)
    assert len(_requests(httpx_mock, FORECAST_URL)) == 2
    assert config.FORECAST_CACHE_TTL_SECONDS == 1800


@pytest.mark.asyncio
async def test_cached_forecast_is_resliced_to_the_current_hour(httpx_mock, clock):
    httpx_mock.add_response(url=FORECAST_URL, json=FORECAST_JSON)
    first = await weather.get_hourly_forecast(18.92, 72.83, now=NOW_1800_IST)
    assert first["hours"][0]["time"] == "2026-10-22T18:00+05:30"

    clock.advance(1200)
    later = await weather.get_hourly_forecast(
        18.92, 72.83, now=datetime(2026, 10, 22, 13, 40, tzinfo=timezone.utc)  # 19:10 IST
    )
    assert later["hours"][0]["time"] == "2026-10-22T19:00+05:30"
    assert len(_requests(httpx_mock, FORECAST_URL)) == 1


@pytest.mark.asyncio
async def test_forecast_429_is_not_retried_and_serves_stale(httpx_mock, clock):
    httpx_mock.add_response(url=FORECAST_URL, json=FORECAST_JSON)
    await weather.get_hourly_forecast(18.92, 72.83, now=NOW_1800_IST)

    clock.advance(3600)
    httpx_mock.add_response(url=FORECAST_URL, status_code=429, headers={"Retry-After": "300"})
    result = await weather.get_hourly_forecast(
        18.92, 72.83, now=datetime(2026, 10, 22, 13, 30, tzinfo=timezone.utc)  # 19:00 IST
    )
    assert len(_requests(httpx_mock, FORECAST_URL)) == 2, "the 429 must not be retried"
    assert result["status"] == "available"
    assert result["stale"] is True
    assert result["age_seconds"] == 3600
    assert result["provider_status"] == "rate_limited"
    assert result["retry_after"] == 300
    assert result["hours"][0]["time"] == "2026-10-22T19:00+05:30"


@pytest.mark.asyncio
async def test_forecast_429_without_cache_is_unavailable(httpx_mock, clock):
    httpx_mock.add_response(url=FORECAST_URL, status_code=429)
    result = await weather.get_hourly_forecast(18.92, 72.83, now=NOW_1800_IST)
    assert len(httpx_mock.get_requests()) == 1
    assert result["status"] == "unavailable"
    assert result["provider_status"] == "rate_limited"
    assert result["hours"] == []


# --- Redis switch -------------------------------------------------------------

class _NamedCache(TTLMemoryCache):
    def __init__(self, name):
        super().__init__()
        self._name = name

    @property
    def name(self):
        return self._name


@pytest.mark.asyncio
async def test_uses_redis_when_redis_url_is_set_and_reachable(monkeypatch):
    redis_like = _NamedCache("redis")

    async def fake_get_cache():
        return redis_like
    monkeypatch.setattr(provider_cache, "get_cache", fake_get_cache)
    monkeypatch.setattr(config, "REDIS_URL", "redis://example:6379/0")
    assert await provider_cache.get_provider_cache() is redis_like


@pytest.mark.asyncio
async def test_falls_back_to_memory_when_redis_is_unreachable(monkeypatch):
    async def fake_get_cache():
        return _NamedCache("noop")
    monkeypatch.setattr(provider_cache, "get_cache", fake_get_cache)
    monkeypatch.setattr(config, "REDIS_URL", "redis://example:6379/0")
    assert await provider_cache.get_provider_cache() is provider_cache._memory_cache


@pytest.mark.asyncio
async def test_uses_memory_without_redis_url(monkeypatch):
    async def must_not_be_called():
        raise AssertionError("Redis must not be tried without REDIS_URL")
    monkeypatch.setattr(provider_cache, "get_cache", must_not_be_called)
    monkeypatch.setattr(config, "REDIS_URL", "")
    assert await provider_cache.get_provider_cache() is provider_cache._memory_cache


# --- API surfaces the stale flag ----------------------------------------------

def test_conditions_endpoint_reports_stale_weather(httpx_mock, clock):
    httpx_mock.add_response(url=WEATHER_URL, json=WEATHER_JSON)
    httpx_mock.add_response(url=AQI_URL, json=AQI_JSON)
    with TestClient(app) as client:
        fresh = client.get("/conditions/?lat=18.92&lon=72.83").json()
        assert fresh["stale"] is False

        clock.advance(700)
        httpx_mock.add_response(url=WEATHER_URL, status_code=429, headers={"Retry-After": "60"})
        stale = client.get("/conditions/?lat=18.92&lon=72.83").json()
    assert stale["status"] == "available"
    assert stale["stale"] is True
    assert stale["age_seconds"] == 700
    assert stale["provider_status"] == "rate_limited"
    assert stale["heat_index"] is not None


# --- call time budget -----------------------------------------------------------

APP_PER_ATTEMPT_TIMEOUT_SECONDS = 15  # mobile config/apiErrors.ts DEFAULT_API_TIMEOUT_MS


def test_call_budget_fits_inside_the_app_timeout():
    attempts = config.OPEN_METEO_MAX_ATTEMPTS
    worst_case = (
        attempts * config.OPEN_METEO_ATTEMPT_TIMEOUT_SECONDS
        + (attempts - 1) * config.OPEN_METEO_RETRY_WAIT_SECONDS
    )
    assert config.OPEN_METEO_CALL_BUDGET_SECONDS == 12
    assert config.OPEN_METEO_ATTEMPT_TIMEOUT_SECONDS == 5
    assert config.OPEN_METEO_MAX_ATTEMPTS == 2  # at most one retry
    assert config.OPEN_METEO_RETRY_WAIT_SECONDS == 1
    assert worst_case <= config.OPEN_METEO_CALL_BUDGET_SECONDS < APP_PER_ATTEMPT_TIMEOUT_SECONDS


def test_stale_limits():
    assert config.WEATHER_STALE_MAX_SECONDS == 3600
    assert config.FORECAST_STALE_MAX_SECONDS == 43200


@pytest.mark.asyncio
async def test_non_429_errors_get_at_most_one_retry(httpx_mock, clock):
    httpx_mock.add_response(url=WEATHER_URL, status_code=500)
    result = await weather.get_weather(18.92, 72.83)
    assert len(_requests(httpx_mock, WEATHER_URL)) == 2
    assert result["provider_status"] == "http_error"


@pytest.fixture
def hanging_provider(monkeypatch):
    """Every Open-Meteo request hangs forever, like an unresponsive provider."""
    calls = []

    async def hang(self, url, **kwargs):
        calls.append(str(url))
        await asyncio.Event().wait()
    monkeypatch.setattr(httpx.AsyncClient, "get", hang)
    return calls


@pytest.fixture
def short_budget(monkeypatch):
    """
    A scaled-down budget (same shape as production: 2 attempts, 1 retry) so the test is
    quick. Leaves room for building the HTTP client (~0.5 s on Windows) before each attempt.
    """
    monkeypatch.setattr(config, "OPEN_METEO_CALL_BUDGET_SECONDS", 2.5)
    monkeypatch.setattr(config, "OPEN_METEO_ATTEMPT_TIMEOUT_SECONDS", 0.5)
    monkeypatch.setattr(config, "OPEN_METEO_RETRY_WAIT_SECONDS", 0.1)
    return 2.5


async def _timed(coro):
    start = asyncio.get_running_loop().time()
    result = await coro
    return result, asyncio.get_running_loop().time() - start


@pytest.mark.asyncio
async def test_hanging_provider_returns_unavailable_within_the_budget(hanging_provider, short_budget, clock):
    result, elapsed = await _timed(weather.get_weather(18.92, 72.83))
    assert result["status"] == "unavailable"
    assert result["provider_status"] == "timeout"
    assert elapsed < short_budget + 0.5, f"took {elapsed:.2f}s"
    assert len(hanging_provider) == 2, "one retry after the first timeout"


@pytest.mark.asyncio
async def test_hanging_provider_serves_stale_within_the_budget(hanging_provider, short_budget, clock):
    await provider_cache.write_entry(
        cache_key("weather", 18.92, 72.83),
        {"temperature_c": 30.0, "humidity_pct": 60.0, "feels_like_c": 34.0},
        config.WEATHER_STALE_MAX_SECONDS,
    )
    clock.advance(config.WEATHER_CACHE_TTL_SECONDS + 60)

    result, elapsed = await _timed(weather.get_weather(18.92, 72.83))
    assert result["stale"] is True
    assert result["temperature_c"] == 30.0
    assert result["provider_status"] == "timeout"
    assert elapsed < short_budget + 0.5, f"took {elapsed:.2f}s"


@pytest.mark.asyncio
async def test_hanging_forecast_and_aqi_return_within_the_budget(hanging_provider, short_budget, clock):
    forecast, forecast_elapsed = await _timed(weather.get_hourly_forecast(18.92, 72.83, now=NOW_1800_IST))
    aqi, aqi_elapsed = await _timed(weather.get_aqi(18.92, 72.83))
    assert forecast["status"] == "unavailable"
    assert aqi["status"] == "unavailable"
    assert forecast_elapsed < short_budget + 0.5, f"forecast took {forecast_elapsed:.2f}s"
    assert aqi_elapsed < short_budget + 0.5, f"aqi took {aqi_elapsed:.2f}s"


@pytest.mark.asyncio
async def test_budget_cuts_a_long_attempt_short(hanging_provider, monkeypatch, clock):
    """The budget wins over the per-attempt timeout: no attempt may run past it."""
    monkeypatch.setattr(config, "OPEN_METEO_CALL_BUDGET_SECONDS", 1.0)
    monkeypatch.setattr(config, "OPEN_METEO_ATTEMPT_TIMEOUT_SECONDS", 5.0)
    result, elapsed = await _timed(weather.get_weather(18.92, 72.83))
    assert result["status"] == "unavailable"
    assert result["provider_status"] == "timeout"
    assert elapsed < 1.5, f"took {elapsed:.2f}s with a 1 s budget"


# --- endpoint time with hanging providers --------------------------------------

@pytest.fixture
def one_attempt_budget(monkeypatch):
    """Each Open-Meteo call uses its whole budget on a single attempt (1.5 s here)."""
    monkeypatch.setattr(config, "OPEN_METEO_CALL_BUDGET_SECONDS", 1.5)
    monkeypatch.setattr(config, "OPEN_METEO_ATTEMPT_TIMEOUT_SECONDS", 1.5)
    return 1.5


async def _timed_get(path: str):
    # .request, not .get: the hanging_provider fixture replaces AsyncClient.get
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        return await _timed(client.request("GET", path))


@pytest.mark.asyncio
async def test_conditions_returns_within_one_budget_when_both_providers_hang(
    hanging_provider, one_attempt_budget, clock
):
    # Sequential weather + AQI would take two budgets (~3 s); concurrent takes one
    res, elapsed = await _timed_get("/conditions/?lat=18.92&lon=72.83")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "unavailable"
    assert body["aqi"]["status"] == "unavailable"
    assert elapsed < one_attempt_budget + 0.7, f"took {elapsed:.2f}s"
    assert len(hanging_provider) == 2  # weather and AQI, once each


@pytest.mark.asyncio
async def test_conditions_serves_stale_within_one_budget_when_both_providers_hang(
    hanging_provider, one_attempt_budget, clock
):
    await provider_cache.write_entry(
        cache_key("weather", 18.92, 72.83),
        {"temperature_c": 30.0, "humidity_pct": 60.0, "feels_like_c": 34.0},
        config.WEATHER_STALE_MAX_SECONDS,
    )
    await provider_cache.write_entry(cache_key("aqi", 18.92, 72.83), {"value": 90}, config.WEATHER_STALE_MAX_SECONDS)
    clock.advance(config.WEATHER_CACHE_TTL_SECONDS + 60)

    res, elapsed = await _timed_get("/conditions/?lat=18.92&lon=72.83")
    body = res.json()
    assert body["status"] == "available"
    assert body["stale"] is True
    assert body["aqi"]["stale"] is True
    assert elapsed < one_attempt_budget + 0.7, f"took {elapsed:.2f}s"


@pytest.mark.asyncio
async def test_forecast_endpoint_returns_within_one_budget_when_provider_hangs(
    hanging_provider, one_attempt_budget, clock
):
    res, elapsed = await _timed_get("/forecast/hourly?lat=18.92&lon=72.83")
    assert res.status_code == 200
    assert res.json()["status"] == "unavailable"
    assert elapsed < one_attempt_budget + 0.7, f"took {elapsed:.2f}s"
