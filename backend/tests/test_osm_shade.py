import pytest
from app.services.osm_shade import estimate_shade_percent, shade_for_path, fetch_shade_features
import httpx

def test_estimate_shade_percent():
    features = [
        {"tags": {"natural": "tree"}},          # 5%
        {"tags": {"natural": "tree"}},          # 5%
        {"tags": {"building": "yes"}},          # 8%
        {"tags": {"landuse": "forest"}},        # 10%
        {"tags": {"natural": "wood"}},          # 10%
    ]
    # Total expected: 5 + 5 + 8 + 10 + 10 = 38
    assert estimate_shade_percent(features, 100.0) == 38.0

def test_estimate_shade_percent_cap():
    features = [{"tags": {"landuse": "forest"}} for _ in range(10)]
    # 100% cap at 95%
    assert estimate_shade_percent(features, 100.0) == 95.0

@pytest.mark.asyncio
async def test_shade_for_path(httpx_mock):
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
    
    shade_percentages = await shade_for_path(path)
    
    assert len(shade_percentages) == 2
    # 5 + 8 = 13% for both segments since same mock is returned
    assert shade_percentages[0] == 13.0
    assert shade_percentages[1] == 13.0

@pytest.mark.asyncio
async def test_shade_for_path_error(httpx_mock):
    # Mock an error response
    httpx_mock.add_exception(httpx.ReadTimeout("Timeout"))
    
    path = [
        {"lat": 0.0, "lon": 0.0},
        {"lat": 0.0, "lon": 0.01}
    ]
    
    shade_percentages = await shade_for_path(path)
    
    assert len(shade_percentages) == 1
    assert shade_percentages[0] == 0.0
