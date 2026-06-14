import pytest
import logging
import sqlite3
import httpx
from app.services.shade_tile_cache import DB_PATH
from app.services.osm_shade import (
    estimate_shade_percent,
    shade_for_path,
    fetch_shade_features,
    estimate_shade_from_street_type,
)

def clear_db():
    conn = sqlite3.connect(DB_PATH)
    try:
        with conn:
            conn.execute("DELETE FROM shade_tiles")
    finally:
        conn.close()

def test_estimate_shade_percent():
    features = [
        {"tags": {"natural": "tree"}},          # 5%
        {"tags": {"natural": "tree"}},          # 5%
        {"tags": {"building": "yes"}},          # 8%
        {"tags": {"landuse": "forest"}},        # 10%
        {"tags": {"natural": "wood"}},          # 10%
        {"tags": {"amenity": "shelter"}},       # 5%
    ]
    # Total expected: 5 + 5 + 8 + 10 + 10 + 5 = 43
    assert estimate_shade_percent(features, 100.0) == 43.0

def test_estimate_shade_percent_cap():
    features = [{"tags": {"landuse": "forest"}} for _ in range(10)]
    # 100% cap at 95%
    assert estimate_shade_percent(features, 100.0) == 95.0

@pytest.mark.asyncio
async def test_shade_for_path(httpx_mock):
    clear_db()
    # Mock the Overpass API response
    mock_response = {
        "elements": [
            {"tags": {"natural": "tree"}},
            {"tags": {"building": "yes"}}
        ]
    }
    httpx_mock.add_response(url="https://overpass-api.de/api/interpreter", json=mock_response)
    httpx_mock.add_response(url="https://overpass-api.de/api/interpreter", json=mock_response)
    
    path = [
        {"lat": 0.0, "lon": 0.0},
        {"lat": 0.0, "lon": 0.01},
        {"lat": 0.0, "lon": 0.02}
    ]
    
    shade_percentages, sources = await shade_for_path(path)
    
    assert len(shade_percentages) == 2
    # 5 + 8 = 13% for both segments since same mock is returned
    assert shade_percentages[0] == 13.0
    assert shade_percentages[1] == 13.0
    assert sources[0] == "overpass"
    assert sources[1] == "overpass"

@pytest.mark.asyncio
async def test_shade_for_path_error(httpx_mock):
    clear_db()
    # Mock an error response (timeout)
    httpx_mock.add_exception(httpx.ReadTimeout("Timeout"))
    # The fallback street-type query is also triggered, let's mock it to fail/timeout too
    httpx_mock.add_exception(httpx.ReadTimeout("Timeout"))
    
    path = [
        {"lat": 0.0, "lon": 0.0},
        {"lat": 0.0, "lon": 0.01}
    ]
    
    shade_percentages, sources = await shade_for_path(path)
    
    assert len(shade_percentages) == 1
    assert shade_percentages[0] == 25.0  # fallback defaults to 25.0
    assert sources[0] == "failed_fallback"

@pytest.mark.asyncio
async def test_fetch_shade_features_returns_tuple(httpx_mock):
    clear_db()
    mock_response = {
        "elements": [
            {"tags": {"building": "yes"}},
            {"tags": {"building": "yes"}}
        ]
    }
    httpx_mock.add_response(url="https://overpass-api.de/api/interpreter", json=mock_response)
    features, source = await fetch_shade_features(18.9347, 72.8353)
    assert len(features) == 2
    assert source == "overpass"

@pytest.mark.asyncio
async def test_fetch_shade_features_429_returns_failed(httpx_mock, caplog):
    clear_db()
    httpx_mock.add_response(url="https://overpass-api.de/api/interpreter", status_code=429)
    with caplog.at_level(logging.WARNING):
        features, source = await fetch_shade_features(18.9347, 72.8353)
    assert features == []
    assert source == "failed"
    assert "status=429" in caplog.text

@pytest.mark.asyncio
async def test_estimate_shade_from_street_type_commercial(httpx_mock):
    mock_response = {
        "elements": [
            {"tags": {"landuse": "commercial"}}
        ]
    }
    httpx_mock.add_response(url="https://overpass-api.de/api/interpreter", json=mock_response)
    shade_pct, source = await estimate_shade_from_street_type(18.9347, 72.8353)
    assert shade_pct == 35.0
    assert source == "street_type"

@pytest.mark.asyncio
async def test_estimate_shade_from_street_type_no_tags(httpx_mock):
    mock_response = {
        "elements": []
    }
    httpx_mock.add_response(url="https://overpass-api.de/api/interpreter", json=mock_response)
    shade_pct, source = await estimate_shade_from_street_type(18.9347, 72.8353)
    assert shade_pct == 25.0
    assert source == "street_type"

@pytest.mark.asyncio
async def test_cache_hit_skips_api(httpx_mock):
    clear_db()
    mock_response = {
        "elements": [
            {"tags": {"natural": "tree"}}
        ]
    }
    # Mocking only once. If a second HTTP call is made, it will fail.
    httpx_mock.add_response(url="https://overpass-api.de/api/interpreter", json=mock_response)
    
    path = [
        {"lat": 18.9347, "lon": 72.8353},
        {"lat": 18.9348, "lon": 72.8354}
    ]
    
    # First call: cache miss, calls API
    p1, s1 = await shade_for_path(path)
    # Second call: cache hit, skips API
    p2, s2 = await shade_for_path(path)
    
    assert p1 == p2
    assert s1 == ["overpass"]
    assert s2 == ["cached"]

@pytest.mark.asyncio
async def test_shade_for_path_uses_fallback_on_failure(httpx_mock):
    clear_db()
    # Mock primary query to return 429
    httpx_mock.add_response(url="https://overpass-api.de/api/interpreter", status_code=429)
    # Mock fallback query to return commercial (35%)
    mock_fallback_response = {
        "elements": [
            {"tags": {"landuse": "commercial"}}
        ]
    }
    httpx_mock.add_response(url="https://overpass-api.de/api/interpreter", json=mock_fallback_response)
    
    path = [
        {"lat": 18.9347, "lon": 72.8353},
        {"lat": 18.9348, "lon": 72.8354}
    ]
    
    shade_percentages, sources = await shade_for_path(path)
    assert shade_percentages[0] == 35.0
    assert sources[0] == "failed_fallback"
