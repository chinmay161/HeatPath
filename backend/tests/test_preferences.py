"""
Unit tests for user preferences endpoint and persistence.
"""
import pytest
from httpx import AsyncClient
from app.main import app
from app.services.user_store import reset_db, DEFAULT_PREFERENCES


@pytest.fixture(autouse=True)
def clean_user_db():
    reset_db()
    yield
    reset_db()


@pytest.mark.anyio
async def test_get_preferences_returns_defaults():
    async with AsyncClient(app=app, base_url="http://test") as client:
        res = await client.get("/preferences/")
        assert res.status_code == 200
        data = res.json()
        assert data["heat_sensitivity"] == DEFAULT_PREFERENCES["heat_sensitivity"]
        assert data["aqi_sensitivity"] == DEFAULT_PREFERENCES["aqi_sensitivity"]
        assert data["units"] == DEFAULT_PREFERENCES["units"]
        assert data["walking_speed"] == DEFAULT_PREFERENCES["walking_speed"]
        assert data["favorite_routes"] == []


@pytest.mark.anyio
async def test_update_preferences_persists():
    async with AsyncClient(app=app, base_url="http://test") as client:
        payload = {
            "heat_sensitivity": 8,
            "aqi_sensitivity": 7,
            "avoid_crowds": True,
            "walking_speed": "brisk",
            "accessibility": "flat_ground",
            "units": "fahrenheit",
            "theme": "dark",
            "favorite_routes": [
                {
                    "id": "fav_1",
                    "name": "Gateway of India Promenade",
                    "start_lat": 18.9220,
                    "start_lon": 72.8347,
                    "end_lat": 18.9250,
                    "end_lon": 72.8330,
                    "created_at": "2026-09-08T00:00:00Z",
                }
            ],
        }
        res = await client.post("/preferences/", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "success"
        assert data["preferences"]["heat_sensitivity"] == 8
        assert data["preferences"]["units"] == "fahrenheit"
        assert len(data["preferences"]["favorite_routes"]) == 1

        # Check persistence with subsequent GET
        get_res = await client.get("/preferences/")
        assert get_res.status_code == 200
        saved = get_res.json()
        assert saved["heat_sensitivity"] == 8
        assert saved["walking_speed"] == "brisk"
        assert saved["units"] == "fahrenheit"
        assert len(saved["favorite_routes"]) == 1
        assert saved["favorite_routes"][0]["name"] == "Gateway of India Promenade"


@pytest.mark.anyio
async def test_update_preferences_validation():
    async with AsyncClient(app=app, base_url="http://test") as client:
        # Invalid heat sensitivity
        res = await client.post("/preferences/", json={"heat_sensitivity": 15})
        assert res.status_code == 422

        # Invalid units
        res2 = await client.post("/preferences/", json={"heat_sensitivity": 5, "units": "kelvin"})
        assert res2.status_code == 422

        # Invalid walking_speed
        res3 = await client.post("/preferences/", json={"heat_sensitivity": 5, "walking_speed": "run"})
        assert res3.status_code == 422
