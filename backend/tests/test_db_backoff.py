"""
After a failed pool connect, the database is skipped for a cooldown (60 s, doubling up to 10 min)
so callers fail fast to their fallbacks instead of reconnecting on every request.
"""
import asyncio
import logging

import asyncpg
import pytest

import app.services.osm_shade as osm_shade
import app.services.postgis_shade as postgis_shade
import app.services.user_store as user_store
from app.config import config
from app.services.db_backoff import ConnectBackoff, DatabaseUnavailableError

FAKE_DSN = "postgresql://user:pass@db.example.com:5432/shade_db?sslmode=require"


class FakeClock:
    def __init__(self):
        self.now = 1000.0

    def __call__(self):
        return self.now


class FakePool:
    def __init__(self, loop=None):
        self._loop = loop

    async def close(self):
        pass


@pytest.fixture
def clock():
    return FakeClock()


@pytest.fixture
def backoffs(monkeypatch, clock):
    """Fresh backoffs on a fake clock, and no pools open."""
    monkeypatch.setattr(config, "POSTGIS_DSN", FAKE_DSN)
    monkeypatch.setattr(postgis_shade, "_pool", None)
    monkeypatch.setattr(user_store, "_db_pool", None)
    monkeypatch.setattr(user_store, "_db_initialized", False)
    monkeypatch.setattr(postgis_shade, "_pool_backoff", ConnectBackoff("PostGIS pool", clock=clock))
    monkeypatch.setattr(user_store, "_db_pool_backoff", ConnectBackoff("user_store pool", clock=clock))


@pytest.fixture
def connects(monkeypatch):
    """Count create_pool calls; fails while `connects.fail` is True."""
    class Connects:
        fail = True
        count = 0

    state = Connects()

    async def _create_pool(*args, **kwargs):
        state.count += 1
        if state.fail:
            raise OSError("connection refused")
        return FakePool(asyncio.get_running_loop())
    monkeypatch.setattr(asyncpg, "create_pool", _create_pool)
    return state


# --- ConnectBackoff -------------------------------------------------------

def test_no_cooldown_before_any_failure(clock):
    backoff = ConnectBackoff("db", clock=clock)
    backoff.check()
    assert backoff.remaining() == 0


def test_failure_starts_60s_cooldown(clock):
    backoff = ConnectBackoff("db", clock=clock)
    backoff.record_failure(OSError("down"))
    with pytest.raises(DatabaseUnavailableError):
        backoff.check()
    clock.now += 59.9
    with pytest.raises(DatabaseUnavailableError):
        backoff.check()
    clock.now += 0.1
    backoff.check()


def test_cooldown_doubles_up_to_10_minutes(clock):
    backoff = ConnectBackoff("db", clock=clock)
    seen = []
    for _ in range(6):
        backoff.record_failure(OSError("down"))
        seen.append(backoff.remaining())
        clock.now += backoff.remaining()
    assert seen == [60, 120, 240, 480, 600, 600]


def test_success_resets_cooldown(clock):
    backoff = ConnectBackoff("db", clock=clock)
    backoff.record_failure(OSError("down"))
    clock.now += 60
    backoff.record_failure(OSError("down"))
    clock.now += 120
    backoff.record_success()
    backoff.check()
    backoff.record_failure(OSError("down"))
    assert backoff.remaining() == 60


def test_concurrent_failures_count_once(clock):
    backoff = ConnectBackoff("db", clock=clock)
    for _ in range(8):
        backoff.record_failure(OSError("down"))
    assert backoff.remaining() == 60
    clock.now += 60
    backoff.record_failure(OSError("down"))
    assert backoff.remaining() == 120


def test_failure_logged_once_per_cooldown(clock, caplog):
    backoff = ConnectBackoff("db", clock=clock)
    with caplog.at_level(logging.WARNING, logger="app.services.db_backoff"):
        for _ in range(5):
            backoff.record_failure(OSError("down"))
    assert len([r for r in caplog.records if "Skipping the database for 60s" in r.getMessage()]) == 1


# --- postgis_shade.get_pool -----------------------------------------------

@pytest.mark.asyncio
async def test_postgis_pool_fails_then_cools_down_then_retries(backoffs, connects, clock):
    with pytest.raises(OSError):
        await postgis_shade.get_pool()
    assert connects.count == 1

    # Inside the window: fail fast, never reconnect
    for _ in range(20):
        with pytest.raises(DatabaseUnavailableError):
            await postgis_shade.get_pool()
    clock.now += 59
    with pytest.raises(DatabaseUnavailableError):
        await postgis_shade.get_pool()
    assert connects.count == 1

    # After the window: one retry, which succeeds and resets the backoff
    clock.now += 1
    connects.fail = False
    pool = await postgis_shade.get_pool()
    assert isinstance(pool, FakePool)
    assert connects.count == 2
    assert postgis_shade._pool_backoff.remaining() == 0


@pytest.mark.asyncio
async def test_postgis_retry_failure_doubles_cooldown(backoffs, connects, clock):
    with pytest.raises(OSError):
        await postgis_shade.get_pool()
    clock.now += 60
    with pytest.raises(OSError):
        await postgis_shade.get_pool()
    assert connects.count == 2
    clock.now += 119
    with pytest.raises(DatabaseUnavailableError):
        await postgis_shade.get_pool()
    assert connects.count == 2


@pytest.mark.asyncio
async def test_shade_lookup_reports_unavailable_during_cooldown(backoffs, connects, caplog):
    features, source = await postgis_shade.fetch_shade_features_postgis(18.92, 72.83)
    assert source == "postgis_error"

    caplog.clear()
    with caplog.at_level(logging.WARNING):
        for _ in range(10):
            features, source = await postgis_shade.fetch_shade_features_postgis(18.92, 72.83)
            assert features == []
            assert source == "postgis_unavailable"
    assert connects.count == 1
    assert not caplog.records, "Cooldown fail-fast must not log on every lookup"


@pytest.mark.asyncio
async def test_shade_tile_falls_back_to_overpass_during_cooldown(backoffs, connects, monkeypatch):
    monkeypatch.setattr(
        osm_shade.solar_service,
        "get_solar_position",
        lambda lat, lon: {"elevation": 60.0, "azimuth": 180.0, "is_night": False},
    )

    async def fake_overpass(lat, lon, radius_m=100):
        return [{"tags": {"natural": "tree"}}], "overpass"
    monkeypatch.setattr(osm_shade, "fetch_shade_features", fake_overpass)

    with pytest.raises(OSError):
        await postgis_shade.get_pool()

    result = await osm_shade.fetch_shade_for_tile("18.9225_72.8325")
    assert result["source"] == "overpass"
    assert connects.count == 1


# --- user_store.get_db_pool -----------------------------------------------

@pytest.mark.asyncio
async def test_user_store_pool_fails_then_cools_down_then_retries(backoffs, connects, clock):
    with pytest.raises(OSError):
        await user_store.get_db_pool()
    assert connects.count == 1

    for _ in range(20):
        with pytest.raises(DatabaseUnavailableError):
            await user_store.get_db_pool()
    clock.now += 59
    with pytest.raises(DatabaseUnavailableError):
        await user_store.get_db_pool()
    assert connects.count == 1

    clock.now += 1
    connects.fail = False
    pool = await user_store.get_db_pool()
    assert isinstance(pool, FakePool)
    assert connects.count == 2
    assert user_store._db_pool_backoff.remaining() == 0


@pytest.mark.asyncio
async def test_user_store_uses_fallbacks_during_cooldown(backoffs, connects, monkeypatch, caplog):
    prefs = {"1": dict(user_store.DEFAULT_PREFERENCES)}
    profiles = {"1": dict(user_store.DEFAULT_PROFILE)}
    monkeypatch.setattr(user_store, "_user_cached_preferences", prefs)
    monkeypatch.setattr(user_store, "_cached_preferences", prefs["1"])
    monkeypatch.setattr(user_store, "_user_cached_profile", profiles)
    monkeypatch.setattr(user_store, "_cached_profile", profiles["1"])

    with pytest.raises(OSError):
        await user_store.get_db_pool()

    with caplog.at_level(logging.WARNING, logger="app.services.user_store"):
        assert (await user_store.get_profile())["name"] == "Guest"
        assert (await user_store.get_preferences())["heat_sensitivity"] == 5
    assert connects.count == 1
    assert not [r for r in caplog.records if "database operation failed" in r.getMessage()]


@pytest.mark.asyncio
async def test_pools_back_off_independently(backoffs, connects):
    with pytest.raises(OSError):
        await postgis_shade.get_pool()
    with pytest.raises(OSError):
        await user_store.get_db_pool()
    assert connects.count == 2
