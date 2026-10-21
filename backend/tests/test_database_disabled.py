"""
Production state: POSTGIS_DSN is unset, so PostGIS and the user database are disabled.
The app must start, never attempt a connection, and serve every feature from fallbacks.
"""
import logging

import asyncpg
import pytest
from fastapi.testclient import TestClient

import app.services.osm_shade as osm_shade
import app.services.postgis_shade as postgis_shade
import app.services.user_store as user_store
from app.config import config
from app.main import app

GUEST_HEADERS = {"X-Guest-ID": "guest|550e8400-e29b-41d4-a716-446655440000"}


@pytest.fixture(autouse=True)
def database_disabled(monkeypatch):
    """Unset the DSN, reset pool state, and fail loudly on any connection attempt."""
    monkeypatch.setattr(config, "POSTGIS_DSN", "")
    monkeypatch.setattr(postgis_shade, "_pool", None)
    monkeypatch.setattr(postgis_shade, "_disabled_warning_logged", False)
    monkeypatch.setattr(user_store, "_db_pool", None)
    monkeypatch.setattr(user_store, "_db_initialized", False)

    # Isolate user_store's in-memory fallback state from other tests
    prefs = {"1": dict(user_store.DEFAULT_PREFERENCES)}
    profiles = {"1": dict(user_store.DEFAULT_PROFILE)}
    monkeypatch.setattr(user_store, "_user_cached_preferences", prefs)
    monkeypatch.setattr(user_store, "_cached_preferences", prefs["1"])
    monkeypatch.setattr(user_store, "_user_cached_profile", profiles)
    monkeypatch.setattr(user_store, "_cached_profile", profiles["1"])

    async def _no_connections(*args, **kwargs):
        raise AssertionError("No database connection may be attempted when POSTGIS_DSN is unset")
    monkeypatch.setattr(asyncpg, "create_pool", _no_connections)


def test_app_starts_and_health_reports_disabled():
    with TestClient(app) as client:
        response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["postgis"] == "disabled"
    assert data["database"] == "disabled"


def test_health_head_ok_when_disabled():
    with TestClient(app) as client:
        assert client.head("/health").status_code == 200


@pytest.mark.asyncio
async def test_get_pool_returns_none_without_connecting():
    assert postgis_shade.is_postgis_enabled() is False
    assert await postgis_shade.get_pool() is None


@pytest.mark.asyncio
async def test_disabled_warning_logged_once(caplog):
    with caplog.at_level(logging.WARNING, logger="app.services.postgis_shade"):
        await postgis_shade.get_pool()
        await postgis_shade.get_pool()
        postgis_shade.is_postgis_enabled()
    warnings = [r for r in caplog.records if "POSTGIS_DSN is not set" in r.getMessage()]
    assert len(warnings) == 1


@pytest.mark.asyncio
async def test_postgis_feature_lookup_reports_disabled():
    features, source = await postgis_shade.fetch_shade_features_postgis(18.92, 72.83)
    assert features == []
    assert source == "postgis_disabled"


@pytest.mark.asyncio
async def test_shade_tile_falls_through_to_overpass(monkeypatch):
    monkeypatch.setattr(
        osm_shade.solar_service,
        "get_solar_position",
        lambda lat, lon: {"elevation": 60.0, "azimuth": 180.0, "is_night": False},
    )
    overpass_calls = []

    async def fake_overpass(lat, lon, radius_m=100):
        overpass_calls.append((lat, lon, radius_m))
        return [{"tags": {"natural": "tree"}}], "overpass"
    monkeypatch.setattr(osm_shade, "fetch_shade_features", fake_overpass)

    result = await osm_shade.fetch_shade_for_tile("18.9225_72.8325")
    assert overpass_calls, "Overpass must be queried when PostGIS is disabled"
    assert result["source"] == "overpass"
    assert result["shade_pct"] > 0


@pytest.mark.asyncio
async def test_user_store_uses_fallbacks(caplog):
    with caplog.at_level(logging.WARNING, logger="app.services.user_store"):
        profile = await user_store.get_profile()
        assert profile["name"] == "Guest"

        updated = await user_store.update_profile({"name": "Asha", "email": None, "bio": "hi", "avatar_id": "tree"})
        assert updated["name"] == "Asha"
        assert (await user_store.get_profile())["name"] == "Asha"

        prefs = await user_store.get_preferences()
        assert prefs["heat_sensitivity"] == 5

        prefs = await user_store.update_preferences({"heat_sensitivity": 8})
        assert prefs["heat_sensitivity"] == 8
        assert (await user_store.get_preferences())["heat_sensitivity"] == 8

    # Disabled DB is an expected state, not a per-request failure
    assert not [r for r in caplog.records if "database operation failed" in r.getMessage()]


def test_endpoints_work_without_database():
    with TestClient(app) as client:
        assert client.get("/profile/").status_code == 200
        put = client.put("/profile/", json={"name": "Asha", "avatar_id": "tree"})
        assert put.status_code == 200
        assert put.json()["name"] == "Asha"

        assert client.get("/preferences/", headers=GUEST_HEADERS).status_code == 200
        post = client.post("/preferences/", json={"heat_sensitivity": 7}, headers=GUEST_HEADERS)
        assert post.status_code == 200
        assert post.json()["preferences"]["heat_sensitivity"] == 7
