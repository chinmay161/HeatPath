"""
Unit tests for user preferences endpoint and persistence.
Validates guest identity workflow, 401 unauthorized on missing identity,
and per-user preference persistence.
"""

import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.services.user_store import reset_db, DEFAULT_PREFERENCES
from app.constants.identity import HEADER_GUEST_ID

TEST_GUEST_ID = "guest|550e8400-e29b-41d4-a716-446655440000"
GUEST_HEADERS = {HEADER_GUEST_ID: TEST_GUEST_ID}


@pytest.fixture(autouse=True)
async def clean_user_db():
    await reset_db()
    yield
    await reset_db()


@pytest.mark.anyio
async def test_get_preferences_returns_defaults():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Unauthenticated request must return 401
        unauth_res = await client.get("/preferences/")
        assert unauth_res.status_code == 401
        assert "Missing user identity" in unauth_res.json()["detail"]

        # 2. Authenticated guest request returns default preferences
        res = await client.get("/preferences/", headers=GUEST_HEADERS)
        assert res.status_code == 200
        data = res.json()
        assert data["heat_sensitivity"] == DEFAULT_PREFERENCES["heat_sensitivity"]
        assert data["aqi_sensitivity"] == DEFAULT_PREFERENCES["aqi_sensitivity"]
        assert data["units"] == DEFAULT_PREFERENCES["units"]
        assert data["walking_speed"] == DEFAULT_PREFERENCES["walking_speed"]
        assert data["favorite_routes"] == []


@pytest.mark.anyio
async def test_update_preferences_persists():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
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
        res = await client.post("/preferences/", json=payload, headers=GUEST_HEADERS)
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "success"
        assert data["preferences"]["heat_sensitivity"] == 8
        assert data["preferences"]["units"] == "fahrenheit"
        assert len(data["preferences"]["favorite_routes"]) == 1

        # Check persistence with subsequent GET
        get_res = await client.get("/preferences/", headers=GUEST_HEADERS)
        assert get_res.status_code == 200
        saved = get_res.json()
        assert saved["heat_sensitivity"] == 8
        assert saved["walking_speed"] == "brisk"
        assert saved["units"] == "fahrenheit"
        assert len(saved["favorite_routes"]) == 1
        assert saved["favorite_routes"][0]["name"] == "Gateway of India Promenade"


@pytest.mark.anyio
async def test_update_preferences_validation():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Invalid heat sensitivity
        res = await client.post("/preferences/", json={"heat_sensitivity": 15}, headers=GUEST_HEADERS)
        assert res.status_code == 422

        # Invalid units
        res2 = await client.post("/preferences/", json={"heat_sensitivity": 5, "units": "kelvin"}, headers=GUEST_HEADERS)
        assert res2.status_code == 422

        # Invalid walking_speed
        res3 = await client.post("/preferences/", json={"heat_sensitivity": 5, "walking_speed": "run"}, headers=GUEST_HEADERS)
        assert res3.status_code == 422
