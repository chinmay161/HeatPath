import pytest
from app.services.cache import InMemoryCache
import app.services.cache.factory as cache_factory
import app.services.postgis_shade as postgis_shade
import app.services.user_store as user_store

@pytest.fixture(autouse=True)
def test_cache():
    """Ensure an isolated in-memory cache for all tests."""
    mem_cache = InMemoryCache()
    cache_factory._instance = mem_cache
    yield mem_cache
    mem_cache._store.clear()
    cache_factory._instance = None

@pytest.fixture(autouse=True)
def reset_db_backoff():
    """Clear connection cooldowns so one test's failed connect never blocks another test."""
    postgis_shade._pool_backoff.reset()
    user_store._db_pool_backoff.reset()
    yield
    postgis_shade._pool_backoff.reset()
    user_store._db_pool_backoff.reset()
