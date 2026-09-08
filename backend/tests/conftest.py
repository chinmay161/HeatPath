import pytest
from app.services.cache import InMemoryCache
import app.services.cache.factory as cache_factory

@pytest.fixture(autouse=True)
def test_cache():
    """Ensure an isolated in-memory cache for all tests."""
    mem_cache = InMemoryCache()
    cache_factory._instance = mem_cache
    yield mem_cache
    mem_cache._store.clear()
    cache_factory._instance = None
