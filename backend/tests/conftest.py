import pytest
from app.config import config as app_config
from app.services.cache import InMemoryCache
import app.services.cache.factory as cache_factory
import app.services.postgis_shade as postgis_shade
import app.services.user_store as user_store


def pytest_collection_modifyitems(config: pytest.Config, items) -> None:
    """Skip live tests unless selected with -m live, and DB tests when POSTGIS_DSN is unset."""
    run_live = "live" in (config.getoption("markexpr") or "")
    skip_live = pytest.mark.skip(reason="live external service; run with -m live")
    skip_db = pytest.mark.skip(reason="needs a live Postgres; POSTGIS_DSN is not set")
    for item in items:
        if "live" in item.keywords and not run_live:
            item.add_marker(skip_live)
        if "requires_db" in item.keywords and not _postgis_dsn_configured():
            item.add_marker(skip_db)


def _postgis_dsn_configured() -> bool:
    return bool((app_config.POSTGIS_DSN or "").strip())

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
