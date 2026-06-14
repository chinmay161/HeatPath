import pytest
import logging
import sqlite3
import httpx
from unittest.mock import AsyncMock
from app.services.shade_tile_cache import DB_PATH
from app.services.osm_shade import (
    estimate_shade_percent,
    shade_for_path,
    fetch_shade_features,
    estimate_shade_from_street_type,
    extract_building_height,
)

@pytest.fixture(autouse=True)
def mock_solar_noon(monkeypatch):
    """
    Globally mock solar elevation to 60.0 degrees (multiplier = 1.0) for OSM shade tests,
    ensuring that the existing test assertions are deterministic and unaffected by the time of day.
    """
    import app.services.solar as solar
    monkeypatch.setattr(solar, "get_current_elevation", lambda lat, lon: 60.0)

def clear_db():
    conn = sqlite3.connect(DB_PATH)
    try:
        with conn:
            conn.execute("DELETE FROM shade_tiles")
    finally:
        conn.close()

def test_estimate_shade_percent():
    features = [
        {"tags": {"natural": "tree"}},          # 12%
        {"tags": {"natural": "tree"}},          # 12%
        {"tags": {"building": "yes"}},          # height 12m @ 60deg elevation -> shadow 6.9m < 7.0m -> 2%
        {"tags": {"landuse": "forest"}},        # 25%
        {"tags": {"natural": "wood"}},          # 25%
        {"tags": {"amenity": "shelter"}},       # 8%
    ]
    # Total expected: 12 + 12 + 2 + 25 + 25 + 8 = 84
    assert estimate_shade_percent(features, solar_elevation=60.0, solar_azimuth=180.0, segment_length_m=100.0) == 84.0


def test_estimate_shade_percent_cap():
    features = [{"tags": {"landuse": "forest"}} for _ in range(10)]
    # 250% cap at 95%
    assert estimate_shade_percent(features, solar_elevation=60.0, solar_azimuth=180.0, segment_length_m=100.0) == 95.0

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
    
    res = await shade_for_path(path)
    shade_percentages = res["shade_values"]
    sources = res["shade_sources"]
    
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
    
    res = await shade_for_path(path)
    shade_percentages = res["shade_values"]
    sources = res["shade_sources"]
    
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
    res1 = await shade_for_path(path)
    p1 = res1["shade_values"]
    s1 = res1["shade_sources"]
    
    # Second call: cache hit, skips API
    res2 = await shade_for_path(path)
    p2 = res2["shade_values"]
    s2 = res2["shade_sources"]
    
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
    
    res = await shade_for_path(path)
    shade_percentages = res["shade_values"]
    sources = res["shade_sources"]
    assert shade_percentages[0] == 35.0
    assert sources[0] == "failed_fallback"

def test_bridge_feature_scores_25_percent():
    features = [{"type": "way", "tags": {"bridge": "yes", "highway": "primary"}}]
    assert estimate_shade_percent(features, solar_elevation=60.0, solar_azimuth=180.0, segment_length_m=250) == 25.0


def test_covered_way_scores_18_percent():
    features = [{"type": "way", "tags": {"covered": "yes"}}]
    assert estimate_shade_percent(features, solar_elevation=60.0, solar_azimuth=180.0, segment_length_m=250) == 18.0

@pytest.mark.asyncio
async def test_solar_multiplier_applied_in_tile_fetch(monkeypatch):
    import app.services.solar as solar
    import app.services.osm_shade as osm_shade

    # Test 1: get_current_elevation returning 0.0 (multiplier = 0.0 -> shade = 0.0)
    monkeypatch.setattr(solar, "get_current_elevation", lambda lat, lon: 0.0)
    mock_fetch = AsyncMock(return_value=([
        {"tags": {"natural": "tree"}},
        {"tags": {"natural": "tree"}},
        {"tags": {"natural": "tree"}}
    ], "overpass"))
    monkeypatch.setattr(osm_shade, "fetch_shade_features", mock_fetch)

    result = await osm_shade.fetch_shade_for_tile("18.9250_72.8250")
    assert result["shade_pct"] == 0.0
    assert result["solar_elevation"] == 0.0
    assert result["solar_multiplier"] == 0.0

    # Test 2: get_current_elevation returning 5.0 (multiplier = 0.15 -> 15% * 0.15 = 2.25)
    monkeypatch.setattr(solar, "get_current_elevation", lambda lat, lon: 5.0)
    result2 = await osm_shade.fetch_shade_for_tile("18.9250_72.8250")
    assert result2["shade_pct"] == 2.25
    assert result2["solar_elevation"] == 5.0
    assert result2["solar_multiplier"] == 0.15
    assert result2["shade_pct"] < 5.0

@pytest.mark.asyncio
async def test_night_multiplier_zeros_shade(monkeypatch):
    import app.services.solar as solar
    import app.services.osm_shade as osm_shade

    # Nighttime elevation = -10.0 (multiplier = 0.0)
    monkeypatch.setattr(solar, "get_current_elevation", lambda lat, lon: -10.0)
    
    mock_fetch = AsyncMock(return_value=([
        {"tags": {"natural": "tree"}},
        {"tags": {"building": "yes"}},
        {"tags": {"landuse": "forest"}}
    ], "overpass"))
    monkeypatch.setattr(osm_shade, "fetch_shade_features", mock_fetch)

    result = await osm_shade.fetch_shade_for_tile("18.9250_72.8250")
    assert result["shade_pct"] == 0.0


def test_extract_building_height_from_tag():
    element = {"tags": {"height": "25m"}}
    assert extract_building_height(element) == 25.0


def test_extract_building_height_from_levels():
    element = {"tags": {"building:levels": "4"}}
    assert extract_building_height(element) == 14.0  # 4 * 3.5


def test_extract_building_height_default():
    element = {"tags": {"building": "yes"}}
    assert extract_building_height(element) == 12.0


def test_building_shadow_high_noon():
    features = [{"type": "way", "tags": {"building": "yes", "height": "20"}}]
    # 20m building at 70° elevation -> shadow = 20/tan(70°) = 7.3m -> 6%
    result = estimate_shade_percent(features, solar_elevation=70.0,
                                    solar_azimuth=180.0, segment_length_m=250)
    assert result == 6.0


def test_building_shadow_low_sun():
    features = [{"type": "way", "tags": {"building": "yes", "height": "20"}}]
    # 20m building at 20° elevation -> shadow = 20/tan(20°) = 54.9m -> 12%
    result = estimate_shade_percent(features, solar_elevation=20.0,
                                    solar_azimuth=180.0, segment_length_m=250)
    assert result == 12.0


def test_building_shadow_very_low_sun():
    features = [{"type": "way", "tags": {"building": "yes", "height": "20"}}]
    # 20m building at 8° elevation -> shadow = 20/tan(8°) = 142m -> 20%
    result = estimate_shade_percent(features, solar_elevation=8.0,
                                    solar_azimuth=180.0, segment_length_m=250)
    assert result == 20.0


def test_tree_contribution_sun_independent():
    features = [{"type": "node", "tags": {"natural": "tree"}}]
    result_noon = estimate_shade_percent(features, 70.0, 180.0)
    result_morning = estimate_shade_percent(features, 15.0, 90.0)
    assert result_noon == result_morning == 12.0


def test_structural_shade_sun_independent():
    features = [{"type": "way", "tags": {"bridge": "yes", "highway": "primary"}}]
    result_noon = estimate_shade_percent(features, 70.0, 180.0)
    result_morning = estimate_shade_percent(features, 15.0, 90.0)
    assert result_noon == result_morning == 25.0


def test_night_returns_zero_regardless_of_features():
    features = [
        {"type": "node", "tags": {"natural": "tree"}},
        {"type": "way", "tags": {"building": "yes", "height": "30"}},
        {"type": "way", "tags": {"bridge": "yes", "highway": "primary"}}
    ]
    assert estimate_shade_percent(features, solar_elevation=-5.0,
                                  solar_azimuth=0.0) == 0.0
