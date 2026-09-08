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
