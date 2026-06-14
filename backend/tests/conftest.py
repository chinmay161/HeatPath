import pytest
import os
import app.services.shade_tile_cache as tile_cache

@pytest.fixture(autouse=True)
def temp_db(tmp_path):
    # Override DB_PATH for all tests
    original_db_path = tile_cache.DB_PATH
    test_db = tmp_path / "test_tiles.db"
    tile_cache.DB_PATH = str(test_db)
    
    # Initialize the database
    tile_cache.init_db()
    
    yield test_db
    
    # Restore DB_PATH
    tile_cache.DB_PATH = original_db_path
