import pytest
from unittest.mock import patch, AsyncMock
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.mark.asyncio
async def test_find_routes_environmental_breakdown():
    mock_paths = [
        [
            {"lat": 12.9716, "lon": 77.5946},
            {"lat": 12.9720, "lon": 77.5950},
            {"lat": 12.9725, "lon": 77.5955},
        ]
    ]
    mock_weather = {
        "status": "available",
        "temperature_c": 32.0,
        "humidity_pct": 65.0,
        "observed_at": "2026-09-08T12:00:00Z",
        "provider": "Open-Meteo",
        "uv_index": 7.5,
    }
    mock_aqi = {
        "status": "available",
        "value": 115.0,
        "observed_at": "2026-09-08T12:00:00Z",
        "provider": "Open-Meteo",
    }
    mock_shade = {
        "shade_values": [65.0, 70.0],
        "shade_sources": ["overpass", "street_type"],
    }

    with patch("app.routers.find_routes.fetch_candidate_routes", new=AsyncMock(return_value=mock_paths)), \
         patch("app.routers.find_routes.get_weather", new=AsyncMock(return_value=mock_weather)), \
         patch("app.routers.find_routes.get_aqi", new=AsyncMock(return_value=mock_aqi)), \
         patch("app.routers.find_routes.shade_for_path", new=AsyncMock(return_value=mock_shade)):

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/find-routes/",
                json={
                    "start": {"lat": 12.9716, "lon": 77.5946},
                    "end": {"lat": 12.9725, "lon": 77.5955},
                    "n_routes": 1,
                },
            )
            assert resp.status_code == 200
            data = resp.json()
            assert "routes" in data
            assert len(data["routes"]) == 1
            route = data["routes"][0]

            assert route["distance_m"] > 0
            assert route["duration_min"] >= 1
            assert route["heat_hours_avoided"] >= 0
            assert route["energy_savings_kcal"] >= 0
            assert "warnings" in route
            assert isinstance(route["warnings"], list)
            assert "provider_freshness" in route
            assert route["provider_freshness"]["weather_provider"] == "Open-Meteo"
            assert route["aqi_val"] == 115.0
            assert route["aqi_category"] == "Unhealthy for Sensitive Groups"
            assert "Maximized tree canopy" in route["selection_reason"] or "shade" in route["selection_reason"]
