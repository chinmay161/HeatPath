"""
Comprehensive tests for Cache abstraction, RedisCache, NoOpCache, and CacheFactory.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from redis.exceptions import ConnectionError as RedisConnectionError, RedisError

from app.services.cache import (
    CacheBackend,
    NoOpCache,
    InMemoryCache,
    RedisCache,
    CacheFactory,
    get_cache,
    reset_cache,
)
from app.services.shade_tile_cache import store_tiles, get_tiles


# ─── NoOpCache Tests ──────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_noop_cache_always_returns_none():
    cache = NoOpCache()
    assert cache.name == "noop"
    assert await cache.get("any_key") is None
    assert await cache.get_many(["k1", "k2"]) == {}
    assert await cache.exists("any_key") is False


@pytest.mark.asyncio
async def test_noop_cache_operations_never_fail():
    cache = NoOpCache()
    assert await cache.set("k1", {"data": 123}, ttl=60) is True
    assert await cache.set_many({"k1": 1, "k2": 2}) is True
    assert await cache.delete("k1") is True
    assert await cache.clear() is True
    assert await cache.health_check() is True
    await cache.close()


# ─── RedisCache Unit Tests (Mocked Redis Client) ──────────────────────────────

@pytest.fixture
def mock_redis_client():
    client = MagicMock()
    client.get = AsyncMock()
    client.set = AsyncMock()
    client.delete = AsyncMock()
    client.exists = AsyncMock()
    client.ping = AsyncMock(return_value=True)
    client.mget = AsyncMock()
    client.aclose = AsyncMock()
    return client


@pytest.mark.asyncio
async def test_redis_cache_get_hit(mock_redis_client):
    mock_redis_client.get.return_value = '{"shade_pct": 42.5, "source": "overpass"}'
    cache = RedisCache(client=mock_redis_client, namespace="testns")

    val = await cache.get("18.9337_72.8347")
    mock_redis_client.get.assert_awaited_once_with("testns:18.9337_72.8347")
    assert val == {"shade_pct": 42.5, "source": "overpass"}


@pytest.mark.asyncio
async def test_redis_cache_get_miss(mock_redis_client):
    mock_redis_client.get.return_value = None
    cache = RedisCache(client=mock_redis_client, namespace="testns")

    val = await cache.get("missing_key")
    assert val is None


@pytest.mark.asyncio
async def test_redis_cache_set_with_ttl(mock_redis_client):
    cache = RedisCache(client=mock_redis_client, default_ttl=3600, namespace="testns")

    success = await cache.set("tile_1", {"pct": 20}, ttl=1800)
    assert success is True
    mock_redis_client.set.assert_awaited_once_with(
        "testns:tile_1",
        '{"pct": 20}',
        ex=1800,
    )


@pytest.mark.asyncio
async def test_redis_cache_delete_and_exists(mock_redis_client):
    mock_redis_client.exists.return_value = 1
    cache = RedisCache(client=mock_redis_client, namespace="testns")

    assert await cache.exists("key1") is True
    mock_redis_client.exists.assert_awaited_once_with("testns:key1")

    assert await cache.delete("key1") is True
    mock_redis_client.delete.assert_awaited_once_with("testns:key1")


@pytest.mark.asyncio
async def test_redis_cache_get_many_bulk_lookup(mock_redis_client):
    mock_redis_client.mget.return_value = [
        '{"shade_pct": 30.0}',
        None,
        '{"shade_pct": 75.0}',
    ]
    cache = RedisCache(client=mock_redis_client, namespace="testns")

    keys = ["k1", "k2", "k3"]
    result = await cache.get_many(keys)
    mock_redis_client.mget.assert_awaited_once_with(["testns:k1", "testns:k2", "testns:k3"])

    assert len(result) == 2
    assert result["k1"] == {"shade_pct": 30.0}
    assert "k2" not in result
    assert result["k3"] == {"shade_pct": 75.0}


@pytest.mark.asyncio
async def test_redis_cache_set_many_uses_pipeline(mock_redis_client):
    mock_pipe = MagicMock()
    mock_pipe.set = MagicMock()
    mock_pipe.execute = AsyncMock()

    class AsyncContextManager:
        async def __aenter__(self):
            return mock_pipe
        async def __aexit__(self, *args):
            pass

    mock_redis_client.pipeline.return_value = AsyncContextManager()
    cache = RedisCache(client=mock_redis_client, default_ttl=500, namespace="testns")

    items = {"k1": 10, "k2": 20}
    success = await cache.set_many(items, ttl=300)
    assert success is True
    assert mock_pipe.set.call_count == 2
    mock_pipe.execute.assert_awaited_once()


@pytest.mark.asyncio
async def test_redis_cache_handles_connection_error_gracefully(mock_redis_client):
    mock_redis_client.get.side_effect = RedisConnectionError("Connection refused")
    mock_redis_client.set.side_effect = RedisConnectionError("Connection reset")
    cache = RedisCache(client=mock_redis_client, namespace="testns")

    # Must NOT raise exception; should return None / False gracefully
    assert await cache.get("k1") is None
    assert await cache.set("k1", "val") is False
    assert await cache.get_many(["k1"]) == {}


@pytest.mark.asyncio
async def test_redis_cache_health_check(mock_redis_client):
    cache = RedisCache(client=mock_redis_client)
    assert await cache.health_check() is True

    mock_redis_client.ping.side_effect = RedisError("Ping failed")
    assert await cache.health_check() is False


# ─── CacheFactory Selection & Fallback Tests ──────────────────────────────────

@pytest.mark.asyncio
async def test_cache_factory_returns_redis_when_available(monkeypatch):
    await reset_cache()

    mock_redis = MagicMock(spec=RedisCache)
    mock_redis.name = "redis"
    mock_redis.health_check = AsyncMock(return_value=True)

    with patch("app.services.cache.factory.RedisCache", return_value=mock_redis):
        cache = await CacheFactory.create_cache()
        assert cache.name == "redis"


@pytest.mark.asyncio
async def test_cache_factory_falls_back_to_noop_when_redis_offline(monkeypatch):
    await reset_cache()

    mock_redis = MagicMock(spec=RedisCache)
    mock_redis.name = "redis"
    mock_redis.health_check = AsyncMock(return_value=False)
    mock_redis.close = AsyncMock()

    with patch("app.services.cache.factory.RedisCache", return_value=mock_redis):
        cache = await CacheFactory.create_cache()
        assert cache.name == "noop"
        assert isinstance(cache, NoOpCache)


@pytest.mark.asyncio
async def test_cache_factory_falls_back_on_init_exception(monkeypatch):
    await reset_cache()

    with patch("app.services.cache.factory.RedisCache", side_effect=Exception("Driver failure")):
        cache = await CacheFactory.create_cache()
        assert cache.name == "noop"
        assert isinstance(cache, NoOpCache)


# ─── Shade Cache Business Logic Tests ─────────────────────────────────────────

@pytest.mark.asyncio
async def test_shade_cache_never_stores_failed_or_fallback_tiles():
    mem_cache = InMemoryCache()
    await reset_cache(mem_cache)

    tiles_to_store = {
        "18.9000_72.8000": {"shade_pct": 50.0, "source": "overpass"},
        "18.9000_72.8001": {"shade_pct": 25.0, "source": "fallback"},
        "18.9000_72.8002": {"shade_pct": 0.0,  "source": "failed"},
        "18.9000_72.8003": {"shade_pct": 100.0, "source": "night"},
    }

    await store_tiles(tiles_to_store)

    retrieved = await get_tiles(list(tiles_to_store.keys()))

    # Only successful results (overpass, night) are cached
    assert "18.9000_72.8000" in retrieved
    assert "18.9000_72.8003" in retrieved
    # Fallback/failed results must NEVER be cached
    assert "18.9000_72.8001" not in retrieved
    assert "18.9000_72.8002" not in retrieved


# ─── Health Endpoint with Cache Status ────────────────────────────────────────

def test_health_endpoint_reports_cache_status():
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()

    assert data["status"] == "ok"
    assert "cache" in data
    assert "cache_backend" in data
    assert "postgis" in data
    assert data["cache_backend"] in ("redis", "noop", "memory")
