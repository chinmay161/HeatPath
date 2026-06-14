import pytest
import os
import re
import sqlite3
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock
import httpx

import app.services.shade_tile_cache as tile_cache
from app.services.shade_tile_cache import snap_to_tile, tile_key, get_tiles, store_tiles, cache_stats
import app.services.osm_shade as osm_shade
from app.services.osm_shade import shade_for_path

# Shared temp_db fixture from conftest.py handles DB isolation automatically

@pytest.fixture(autouse=True)
def mock_solar_noon(monkeypatch):
    """
    Globally mock solar elevation to 60.0 degrees (multiplier = 1.0) for OSM shade tests,
    ensuring that the existing test assertions are deterministic and unaffected by the time of day.
    """
    import app.services.solar as solar
    monkeypatch.setattr(solar, "get_current_elevation", lambda lat, lon: 60.0)

def test_snap_to_tile_precision():
    # snap_to_tile(18.9347, 72.8353)
    # Assert result rounds to nearest 0.00225 boundary
    # Assert both values have exactly 4 decimal places
    lat, lon = snap_to_tile(18.9347, 72.8353)
    assert lat == 18.9337
    assert lon == 72.8347
    
    assert len(str(lat).split('.')[1]) == 4
    assert len(str(lon).split('.')[1]) == 4

def test_tile_key_format():
    key = tile_key(18.9347, 72.8353)
    assert re.match(r"^\d+\.\d{4}_\d+\.\d{4}$", key)

@pytest.mark.asyncio
async def test_bulk_lookup_returns_hits_only():
    # Store 2 tiles, lookup 3 keys (2 stored + 1 missing)
    # Assert returned dict has exactly 2 keys, missing key absent
    tiles = {
        "18.9338_72.8348": {"shade_pct": 35.0, "source": "overpass"},
        "18.9360_72.8370": {"shade_pct": 50.0, "source": "street_type"},
    }
    await store_tiles(tiles)
    
    keys_to_lookup = ["18.9338_72.8348", "18.9360_72.8370", "18.9400_72.8400"]
    result = await get_tiles(keys_to_lookup)
    
    assert len(result) == 2
    assert "18.9338_72.8348" in result
    assert "18.9360_72.8370" in result
    assert "18.9400_72.8400" not in result
    
    assert result["18.9338_72.8348"]["shade_pct"] == 35.0
    assert result["18.9338_72.8348"]["source"] == "overpass"

@pytest.mark.asyncio
async def test_store_tiles_single_transaction(temp_db):
    # Store 5 tiles, assert all 5 present in one SELECT
    # Assert computed_at is a valid ISO-8601 string
    tiles = {
        f"18.9000_{72.8000 + i*0.00225:.4f}": {"shade_pct": float(10 + i), "source": "overpass"}
        for i in range(5)
    }
    await store_tiles(tiles)
    
    # Query database directly
    conn = sqlite3.connect(str(temp_db))
    cursor = conn.cursor()
    cursor.execute("SELECT tile_key, shade_pct, source, computed_at FROM shade_tiles")
    rows = cursor.fetchall()
    conn.close()
    
    assert len(rows) == 5
    for row in rows:
        key, shade, source, computed_at = row
        assert key in tiles
        assert shade == tiles[key]["shade_pct"]
        assert source == tiles[key]["source"]
        
        # Verify ISO-8601 string
        parsed_dt = datetime.fromisoformat(computed_at)
        assert isinstance(parsed_dt, datetime)

@pytest.mark.asyncio
async def test_ttl_is_6_hours_not_30_days(temp_db):
    # Insert a tile with computed_at = 7 hours ago
    conn = sqlite3.connect(str(temp_db))
    old_time = (datetime.now(timezone.utc) - timedelta(hours=7)).isoformat()
    conn.execute(
        "INSERT INTO shade_tiles (tile_key, shade_pct, source, computed_at, radius_m) VALUES (?, ?, ?, ?, ?)",
        ("18.9000_72.8000", 15.0, "overpass", old_time, 60)
    )
    conn.commit()
    conn.close()
    
    # Run eviction by calling init_db again (which does eviction)
    tile_cache.init_db()
    
    # Assert tile is gone
    conn = sqlite3.connect(str(temp_db))
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM shade_tiles WHERE tile_key = ?", ("18.9000_72.8000",))
    count = cursor.fetchone()[0]
    conn.close()
    
    assert count == 0

@pytest.mark.asyncio
async def test_shade_for_path_batches_correctly(monkeypatch):
    mock_fetch = AsyncMock(return_value=([{"tags": {"natural": "tree"}}, {"tags": {"natural": "tree"}}, {"tags": {"natural": "tree"}}], "overpass"))
    monkeypatch.setattr(osm_shade, "fetch_shade_features", mock_fetch)
    
    path = [
        {"lat": 18.9340, "lon": 72.8350},
        {"lat": 18.9341, "lon": 72.8351},
        {"lat": 18.9342, "lon": 72.8352},
        {"lat": 18.9343, "lon": 72.8353}
    ]
    
    res = await shade_for_path(path)
    shade_percentages = res["shade_values"]
    sources = res["shade_sources"]
    
    assert len(shade_percentages) == 3
    assert len(sources) == 3
    # 3 trees * 5.0% = 15.0%
    assert shade_percentages == [15.0, 15.0, 15.0]
    assert mock_fetch.call_count == 1

@pytest.mark.asyncio
async def test_shade_for_path_stores_misses_after_fetch(monkeypatch):
    mock_fetch = AsyncMock(return_value=([{"tags": {"natural": "tree"}}], "overpass"))
    monkeypatch.setattr(osm_shade, "fetch_shade_features", mock_fetch)
    
    path = [
        {"lat": 18.9340, "lon": 72.8350},
        {"lat": 18.9341, "lon": 72.8351}
    ]
    
    res = await shade_for_path(path)
    shade_percentages = res["shade_values"]
    sources = res["shade_sources"]
    assert len(shade_percentages) == 1
    assert shade_percentages[0] == 5.0
    assert sources[0] == "overpass"
    assert mock_fetch.call_count == 1
    
    # Second call (identical path)
    mock_fetch.reset_mock()
    res2 = await shade_for_path(path)
    shade_percentages2 = res2["shade_values"]
    sources2 = res2["shade_sources"]
    assert shade_percentages2 == [5.0]
    assert sources2 == ["cached"]
    assert mock_fetch.call_count == 0

@pytest.mark.asyncio
async def test_fetch_failure_returns_fallback(monkeypatch):
    mock_fetch = MagicMock(side_effect=httpx.TimeoutException("Connection timed out"))
    # Wrap in async mock so fetch_shade_features can be awaited
    async_mock_fetch = AsyncMock(side_effect=mock_fetch)
    monkeypatch.setattr(osm_shade, "fetch_shade_features", async_mock_fetch)
    
    mock_street = AsyncMock(side_effect=Exception("Street fallback error"))
    monkeypatch.setattr(osm_shade, "estimate_shade_from_street_type", mock_street)
    
    path = [
        {"lat": 18.9340, "lon": 72.8350},
        {"lat": 18.9341, "lon": 72.8351}
    ]
    
    res = await shade_for_path(path)
    shade_percentages = res["shade_values"]
    sources = res["shade_sources"]
    assert len(shade_percentages) == 1
    assert shade_percentages[0] == 25.0
    assert sources[0] == "failed_fallback"
