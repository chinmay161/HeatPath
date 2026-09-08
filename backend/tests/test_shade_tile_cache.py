import pytest
import asyncio
import re
from unittest.mock import AsyncMock, MagicMock
import httpx

import app.services.shade_tile_cache as tile_cache
from app.services.shade_tile_cache import snap_to_tile, tile_key, get_tiles, store_tiles, cache_stats
import app.services.osm_shade as osm_shade
from app.services.osm_shade import shade_for_path

@pytest.fixture(autouse=True)
def mock_solar_noon(monkeypatch):
    """
    Globally mock solar elevation to 60.0 degrees (multiplier = 1.0) for OSM shade tests,
    ensuring that test assertions are deterministic and unaffected by the time of day.
    """
    import app.services.solar as solar
    monkeypatch.setattr(solar, "get_current_elevation", lambda lat, lon: 60.0)
    monkeypatch.setattr(
        solar, "get_solar_position",
        lambda lat, lon: {"elevation": 60.0, "azimuth": 180.0, "is_night": False},
    )

def test_snap_to_tile_precision():
    lat, lon = snap_to_tile(18.9347, 72.8353)
    assert lat == 18.9337
    assert lon == 72.8347
    assert len(str(lat).split('.')[1]) == 4
    assert len(str(lon).split('.')[1]) == 4

def test_tile_key_format():
    key = tile_key(18.9347, 72.8353)
    assert re.match(r"^\d+\.\d{4}_\d+\.\d{4}$", key)

@pytest.mark.asyncio
async def test_fetch_shade_tiles_limited_caps_concurrency(monkeypatch):
    active = 0
    max_active = 0

    async def fake_fetch_shade_for_tile(key):
        nonlocal active, max_active
        active += 1
        max_active = max(max_active, active)
        await asyncio.sleep(0.01)
        active -= 1
        return {"shade_pct": 25.0, "source": "street_type"}

    monkeypatch.setattr(osm_shade, "MAX_CONCURRENT_TILE_FETCHES", 2)
    monkeypatch.setattr(osm_shade, "fetch_shade_for_tile", fake_fetch_shade_for_tile)

    results = await osm_shade._fetch_shade_tiles_limited([f"18.9000_72.{i:04d}" for i in range(8)])

    assert len(results) == 8
    assert max_active == 2

@pytest.mark.asyncio
async def test_bulk_lookup_returns_hits_only():
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
    assert shade_percentages == [36.0, 36.0, 36.0]
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
    assert shade_percentages[0] == 12.0
    assert sources[0] == "overpass"
    assert mock_fetch.call_count == 1

    # Second call (identical path)
    mock_fetch.reset_mock()
    res2 = await shade_for_path(path)
    shade_percentages2 = res2["shade_values"]
    sources2 = res2["shade_sources"]
    assert shade_percentages2 == [12.0]
    assert sources2 == ["cached"]
    assert mock_fetch.call_count == 0

@pytest.mark.asyncio
async def test_fetch_failure_returns_fallback(monkeypatch):
    mock_fetch = MagicMock(side_effect=httpx.TimeoutException("Connection timed out"))
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
