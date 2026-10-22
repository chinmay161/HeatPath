"""
Unit tests for hourly weather and comfort forecast endpoint.
"""
import pytest
from httpx import AsyncClient
from unittest.mock import patch
from app.main import app


@pytest.mark.anyio
async def test_get_hourly_forecast_success():
    fake_hourly_response = {
        "status": "available",
        "provider": "open-meteo",
        "provider_status": "healthy",
        "observed_at": "2026-09-08T12:00:00Z",
        "hours": [
            {
                "time": "2026-09-08T12:00",
                "temperature_c": 32.0,
                "humidity_pct": 65.0,
                "feels_like_c": 36.5,
                "uv_index": 7.5,
                "precipitation_probability": 10.0,
                "wind_speed_kmh": 12.0,
                "comfort_score": 0.45,
                "severity": "CAUTION",
                "is_best_time": False,
            },
            {
                "time": "2026-09-08T18:00",
                "temperature_c": 27.0,
                "humidity_pct": 55.0,
                "feels_like_c": 28.0,
                "uv_index": 1.0,
                "precipitation_probability": 0.0,
                "wind_speed_kmh": 10.0,
                "comfort_score": 0.88,
                "severity": "SAFE",
                "is_best_time": True,
            },
        ],
    }

    with patch("app.routers.forecast.get_hourly_forecast", return_value=fake_hourly_response):
        async with AsyncClient(app=app, base_url="http://test") as client:
            res = await client.get("/forecast/hourly?lat=18.9220&lon=72.8347")
            assert res.status_code == 200
            data = res.json()
            assert data["status"] == "available"
            assert len(data["hours"]) == 2
            assert data["hours"][1]["is_best_time"] is True
            assert data["hours"][1]["comfort_score"] == 0.88
            assert data["hours"][1]["severity"] == "SAFE"


@pytest.mark.anyio
async def test_get_hourly_forecast_provider_unavailable():
    fake_unavailable = {
        "status": "unavailable",
        "provider": "open-meteo",
        "provider_status": "unreachable",
        "retry_after": 60,
        "observed_at": None,
        "hours": [],
    }

    with patch("app.routers.forecast.get_hourly_forecast", return_value=fake_unavailable):
        async with AsyncClient(app=app, base_url="http://test") as client:
            res = await client.get("/forecast/hourly?lat=18.9220&lon=72.8347")
            assert res.status_code == 200
            data = res.json()
            assert data["status"] == "unavailable"
            assert data["hours"] == []
            assert data["retry_after"] == 60


@pytest.mark.anyio
async def test_get_hourly_forecast_invalid_coordinates():
    async with AsyncClient(app=app, base_url="http://test") as client:
        res = await client.get("/forecast/hourly?lat=95.0&lon=72.8347")
        assert res.status_code == 400


# --- Local time with UTC offsets (Open-Meteo timezone=auto) -------------------

import json
import re
from datetime import datetime, timezone
from pathlib import Path

from app.config import config
from app.services.weather import build_forecast_hours, format_utc_offset, get_hourly_forecast

FIXTURES = Path(__file__).parent / "fixtures"
ISO_WITH_OFFSET = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:00[+-]\d{2}:\d{2}$")


def _fixture(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


def _hour(item: dict) -> int:
    return datetime.fromisoformat(item["time"]).hour


# 18:00 IST on 2026-10-22 (the production observation)
NOW_1800_IST = datetime(2026, 10, 22, 12, 30, tzinfo=timezone.utc)


def test_utc_offset_format():
    assert format_utc_offset(19800) == "+05:30"
    assert format_utc_offset(0) == "+00:00"
    assert format_utc_offset(-12600) == "-03:30"
    assert format_utc_offset(-18000) == "-05:00"
    assert format_utc_offset(20700) == "+05:45"


def test_hours_are_iso_8601_with_offset():
    hours = build_forecast_hours(_fixture("open_meteo_forecast_auto.json"), NOW_1800_IST)
    assert hours, "expected forecast hours"
    for h in hours:
        assert ISO_WITH_OFFSET.match(h["time"]), h["time"]
        assert datetime.fromisoformat(h["time"]).utcoffset().total_seconds() == 19800


def test_window_starts_at_current_local_hour_and_has_24_hours():
    hours = build_forecast_hours(_fixture("open_meteo_forecast_auto.json"), NOW_1800_IST)
    assert len(hours) == 24
    assert hours[0]["time"] == "2026-10-22T18:00+05:30"
    assert hours[-1]["time"] == "2026-10-23T17:00+05:30"


def test_window_starts_at_current_hour_mid_hour():
    # 12:00 UTC = 17:30 IST: the current local hour is 17:00
    hours = build_forecast_hours(
        _fixture("open_meteo_forecast_auto.json"), datetime(2026, 10, 22, 12, 0, tzinfo=timezone.utc)
    )
    assert hours[0]["time"] == "2026-10-22T17:00+05:30"


def test_past_hours_excluded():
    now = NOW_1800_IST
    hours = build_forecast_hours(_fixture("open_meteo_forecast_auto.json"), now)
    current_hour = now.replace(minute=0)  # 12:00 UTC; the 17:30 IST slot does not exist, 18:00 IST is first
    for h in hours:
        assert datetime.fromisoformat(h["time"]) >= current_hour


def test_late_evening_still_returns_24_hours_from_the_second_day():
    # 23:45 IST: only 1 hour left today, the rest must come from tomorrow
    hours = build_forecast_hours(
        _fixture("open_meteo_forecast_auto.json"), datetime(2026, 10, 22, 18, 15, tzinfo=timezone.utc)
    )
    assert len(hours) == 24
    assert hours[0]["time"] == "2026-10-22T23:00+05:30"
    assert hours[1]["time"] == "2026-10-23T00:00+05:30"


def test_best_time_only_within_daytime_window():
    hours = build_forecast_hours(_fixture("open_meteo_forecast_auto.json"), NOW_1800_IST)
    best = [h for h in hours if h["is_best_time"]]
    assert len(best) == 3
    start_h, end_h = config.FORECAST_BEST_TIME_START_HOUR, config.FORECAST_BEST_TIME_END_HOUR
    for h in best:
        assert start_h <= _hour(h) <= end_h, h["time"]

    # The coolest night hours are more comfortable, but must not be picked
    night = [h for h in hours if not (start_h <= _hour(h) <= end_h)]
    assert max(h["comfort_score"] for h in night) >= min(h["comfort_score"] for h in best)

    # And best time is the top 3 of the window itself
    window = sorted(
        (h for h in hours if start_h <= _hour(h) <= end_h), key=lambda h: h["comfort_score"], reverse=True
    )
    assert {h["time"] for h in best} == {h["time"] for h in window[:3]}


def test_best_time_window_constants():
    assert config.FORECAST_BEST_TIME_START_HOUR == 6
    assert config.FORECAST_BEST_TIME_END_HOUR == 21


def test_no_best_time_when_no_hours_in_window():
    data = {
        "utc_offset_seconds": 19800,
        "hourly": {
            "time": ["2026-10-22T22:00", "2026-10-22T23:00", "2026-10-23T00:00", "2026-10-23T01:00"],
            "temperature_2m": [27.0] * 4,
            "relative_humidity_2m": [70] * 4,
            "apparent_temperature": [29.0] * 4,
            "precipitation_probability": [0] * 4,
            "uv_index": [0.0] * 4,
            "wind_speed_10m": [10.0] * 4,
        },
    }
    hours = build_forecast_hours(data, datetime(2026, 10, 22, 16, 30, tzinfo=timezone.utc))  # 22:00 IST
    assert len(hours) == 4
    assert not any(h["is_best_time"] for h in hours)


def test_best_time_window_is_configurable(monkeypatch):
    monkeypatch.setattr(config, "FORECAST_BEST_TIME_START_HOUR", 19)
    monkeypatch.setattr(config, "FORECAST_BEST_TIME_END_HOUR", 20)
    hours = build_forecast_hours(_fixture("open_meteo_forecast_auto.json"), NOW_1800_IST)
    best = [_hour(h) for h in hours if h["is_best_time"]]
    assert sorted(best) == [19, 20]


@pytest.mark.anyio
async def test_get_hourly_forecast_requests_local_time_for_two_days(httpx_mock):
    httpx_mock.add_response(json=_fixture("open_meteo_forecast_auto.json"))
    result = await get_hourly_forecast(18.92, 72.83, now=NOW_1800_IST)

    url = str(httpx_mock.get_request().url)
    assert "timezone=auto" in url
    assert "forecast_days=2" in url
    assert result["status"] == "available"
    assert len(result["hours"]) == 24
    assert result["hours"][0]["time"] == "2026-10-22T18:00+05:30"
