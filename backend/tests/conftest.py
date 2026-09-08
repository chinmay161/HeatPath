import pytest
import app.services.shade_tile_cache as tile_cache

@pytest.fixture(autouse=True)
def clean_tile_cache():
    """Ensure a clean tile cache for every test."""
    tile_cache.clear_cache()
    yield
    tile_cache.clear_cache()
