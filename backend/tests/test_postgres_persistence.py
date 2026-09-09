"""
Integration tests verifying user data persistence in PostgreSQL/PostGIS.
Tests verify persistence across process restart simulation, normalized favorite routes CRUD,
Redis cache read-through, cache invalidation, and graceful error fallback.
"""
import pytest
from unittest.mock import patch, AsyncMock

from app.services.user_store import (
    get_profile,
    update_profile,
    get_preferences,
    update_preferences,
    reset_db,
    get_db_pool,
    DEFAULT_PROFILE,
    DEFAULT_PREFERENCES,
)
import app.services.user_store as user_store_module
from app.services.cache import get_cache


@pytest.fixture(autouse=True)
async def clean_db():
    await reset_db()
    yield
    await reset_db()


@pytest.mark.anyio
async def test_profile_persistence_across_simulated_restart():
    """Verify profile survives pool shutdown and service re-initialization."""
    # 1. Update profile with custom values
    custom_profile = {
        "name": "Jordan Climber",
        "email": "jordan.climber@test.org",
        "bio": "Searching for high-elevation shade corridors.",
        "avatar_id": "water",
    }
    updated = await update_profile(custom_profile)
    assert updated["name"] == "Jordan Climber"
    assert updated["email"] == "jordan.climber@test.org"
    assert updated["avatar_id"] == "water"

    # 2. Simulate application restart:
    # Close pool, destroy pool singleton, purge in-memory cache
    if user_store_module._db_pool is not None:
        await user_store_module._db_pool.close()
    user_store_module._db_pool = None
    user_store_module._db_initialized = False

    # Also invalidate any cache to force DB read
    cache = await get_cache()
    await cache.delete("user:1:profile")

    # 3. Read profile after restart simulation
    persisted = await get_profile()
    assert persisted["name"] == "Jordan Climber"
    assert persisted["email"] == "jordan.climber@test.org"
    assert persisted["bio"] == "Searching for high-elevation shade corridors."
    assert persisted["avatar_id"] == "water"


@pytest.mark.anyio
async def test_preferences_persistence_across_simulated_restart():
    """Verify preferences survive pool shutdown and service re-initialization."""
    # 1. Update preferences
    custom_prefs = {
        "heat_sensitivity": 9,
        "aqi_sensitivity": 8,
        "avoid_crowds": True,
        "walking_speed": "brisk",
        "accessibility": "wheelchair",
        "units": "fahrenheit",
        "theme": "dark",
        "favorite_routes": [
            {
                "id": "fav_restart_1",
                "name": "River Run",
                "start_lat": 12.9716,
                "start_lon": 77.5946,
                "end_lat": 12.9750,
                "end_lon": 77.6000,
            }
        ],
    }
    updated = await update_preferences(custom_prefs)
    assert updated["heat_sensitivity"] == 9
    assert updated["theme"] == "dark"
    assert len(updated["favorite_routes"]) == 1

    # 2. Simulate restart
    if user_store_module._db_pool is not None:
        await user_store_module._db_pool.close()
    user_store_module._db_pool = None
    user_store_module._db_initialized = False
    user_store_module._cached_preferences = DEFAULT_PREFERENCES.copy()

    cache = await get_cache()
    await cache.delete("user:1:preferences")

    # 3. Read preferences after restart simulation
    persisted = await get_preferences()
    assert persisted["heat_sensitivity"] == 9
    assert persisted["aqi_sensitivity"] == 8
    assert persisted["avoid_crowds"] is True
    assert persisted["walking_speed"] == "brisk"
    assert persisted["accessibility"] == "wheelchair"
    assert persisted["units"] == "fahrenheit"
    assert persisted["theme"] == "dark"
    assert len(persisted["favorite_routes"]) == 1
    assert persisted["favorite_routes"][0]["name"] == "River Run"


@pytest.mark.anyio
async def test_favorite_routes_crud_in_postgres():
    """Verify normalized favorite_routes table properly handles insertions, updates, and removals."""
    route1 = {
        "id": "route_alpha",
        "name": "Cubbon Park Loop",
        "start_lat": 12.9763,
        "start_lon": 77.5929,
        "end_lat": 12.9790,
        "end_lon": 77.5910,
    }
    route2 = {
        "id": "route_beta",
        "name": "MG Road Promenade",
        "start_lat": 12.9730,
        "start_lon": 77.6070,
        "end_lat": 12.9750,
        "end_lon": 77.6150,
    }

    # Add 2 routes
    await update_preferences({"favorite_routes": [route1, route2]})

    # Direct query against PostgreSQL table to ensure normalized relational storage
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT id, name, start_lat, start_lon, end_lat, end_lon FROM favorite_routes WHERE user_id = 1 ORDER BY id"
        )
        assert len(rows) == 2
        ids = {r["id"] for r in rows}
        assert ids == {"route_alpha", "route_beta"}

    # Remove 1 route
    await update_preferences({"favorite_routes": [route2]})
    current = await get_preferences()
    assert len(current["favorite_routes"]) == 1
    assert current["favorite_routes"][0]["id"] == "route_beta"

    # Verify directly in DB
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT id FROM favorite_routes WHERE user_id = 1"
        )
        assert len(rows) == 1
        assert rows[0]["id"] == "route_beta"


@pytest.mark.anyio
async def test_redis_cache_read_through_and_invalidation():
    """Verify Redis cache accelerates reads and is promptly invalidated on write operations."""
    cache = await get_cache()
    profile_cache_key = "user:1:profile"
    prefs_cache_key = "user:1:preferences"

    # Clear cache keys
    await cache.delete(profile_cache_key)
    await cache.delete(prefs_cache_key)

    # 1. Read through: cache should be populated after get_profile
    profile = await get_profile()
    cached_profile = await cache.get(profile_cache_key)
    assert cached_profile is not None
    assert cached_profile["name"] == profile["name"]

    # 2. Update profile: cache should be invalidated
    await update_profile({"name": "Cache Invalidation Test"})
    # Key should have been evicted
    cached_after_update = await cache.get(profile_cache_key)
    assert cached_after_update is None

    # 3. Read again: new data should re-populate cache
    reloaded_profile = await get_profile()
    assert reloaded_profile["name"] == "Cache Invalidation Test"
    cached_reloaded = await cache.get(profile_cache_key)
    assert cached_reloaded is not None
    assert cached_reloaded["name"] == "Cache Invalidation Test"

    # 4. Preferences cache test
    prefs = await get_preferences()
    cached_prefs = await cache.get(prefs_cache_key)
    assert cached_prefs is not None
    assert cached_prefs["heat_sensitivity"] == prefs["heat_sensitivity"]

    # Update preferences: key should be evicted
    await update_preferences({"heat_sensitivity": 1})
    # Cache re-populated by update_preferences get_preferences call
    cached_prefs_after = await cache.get(prefs_cache_key)
    if cached_prefs_after is not None:
        assert cached_prefs_after["heat_sensitivity"] == 1


@pytest.mark.anyio
async def test_graceful_fallback_when_redis_fails():
    """Verify that if Redis throws unexpected errors or is down, PostgreSQL queries transparently succeed."""
    mock_broken_cache = AsyncMock()
    mock_broken_cache.get.side_effect = Exception("Redis connection refused")
    mock_broken_cache.set.side_effect = Exception("Redis write timeout")
    mock_broken_cache.delete.side_effect = Exception("Redis delete error")

    with patch("app.services.user_store.get_cache", AsyncMock(return_value=mock_broken_cache)):
        # Reads should still work transparently from PostgreSQL
        profile = await get_profile()
        assert profile["name"] is not None
        assert "@" in profile["email"]

        # Writes should still commit successfully to PostgreSQL
        updated = await update_profile({"name": "Fallback Working"})
        assert updated["name"] == "Fallback Working"

        # Preferences should also operate without issue
        prefs = await get_preferences()
        assert "heat_sensitivity" in prefs

        updated_prefs = await update_preferences({"heat_sensitivity": 4})
        assert updated_prefs["heat_sensitivity"] == 4
