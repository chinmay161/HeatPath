import pytest
import asyncio
from unittest.mock import patch, MagicMock, AsyncMock
import asyncpg
from app.services.postgis_shade import fetch_shade_features_postgis, get_pool
from app.services.osm_shade import fetch_shade_for_tile, estimate_shade_percent

# Mock classes for asyncpg
class MockRecord(dict):
    """A dictionary subclass that mirrors asyncpg Record access."""
    def __getitem__(self, key):
        return super().get(key)

class MockConnection:
    def __init__(self, fetch_val=None, raise_exc=None):
        self.fetch_val = fetch_val or []
        self.raise_exc = raise_exc
        self.queries = []

    async def fetch(self, query, *args):
        self.queries.append((query, args))
        if self.raise_exc:
            raise self.raise_exc
        return self.fetch_val

class MockPoolContext:
    def __init__(self, conn):
        self.conn = conn

    async def __aenter__(self):
        return self.conn

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        pass

class MockPool:
    def __init__(self, conn):
        self.conn = conn

    def acquire(self):
        return MockPoolContext(self.conn)

@pytest.mark.asyncio
@patch("app.services.postgis_shade.get_pool")
async def test_fetch_shade_features_postgis_returns_features(mock_get_pool):
    # Prepare 3 mock rows: tree, building, forest
    rows = [
        MockRecord({
            'feature_type': 'tree', 'lat': 19.1401, 'lon': 72.8801,
            'natural': 'tree', 'crown_diameter': '6', 'diameter_crown': None,
            'radius': None, 'width': None, 'height': '15'
        }),
        MockRecord({
            'feature_type': 'building', 'lat': 19.1402, 'lon': 72.8802,
            'building': 'yes', 'height': '12.0', 'building_levels': '3', 'levels': None
        }),
        MockRecord({
            'feature_type': 'forest', 'lat': 19.1403, 'lon': 72.8803,
            'landuse': 'forest', 'natural': None
        })
    ]
    
    # Mock gather results by returning distinct lists
    # Since fetch_shade_features_postgis runs 7 queries in gather, we mock them
    mock_conn = MockConnection()
    # We will let the queries return these rows
    mock_conn.fetch = AsyncMock(side_effect=[
        [rows[0]], # trees query
        [rows[1]], # buildings query
        [rows[2]], # forest query
        [], [], [], [] # other queries
    ])
    
    mock_pool = MockPool(mock_conn)
    mock_get_pool.return_value = mock_pool
    
    features, source = await fetch_shade_features_postgis(19.14, 72.88, 60)
    
    assert source == "postgis"
    assert len(features) == 3
    assert features[0]["feature_type"] == "tree"
    assert features[1]["feature_type"] == "building"
    assert features[2]["feature_type"] == "forest"

@pytest.mark.asyncio
@patch("app.services.postgis_shade.get_pool")
async def test_fetch_shade_features_postgis_includes_forest_type(mock_get_pool):
    row = MockRecord({
        'feature_type': 'forest', 'lat': 19.1403, 'lon': 72.8803,
        'landuse': 'forest', 'natural': None
    })
    
    mock_conn = MockConnection()
    mock_conn.fetch = AsyncMock(side_effect=[
        [], [], [row], [], [], [], []
    ])
    mock_pool = MockPool(mock_conn)
    mock_get_pool.return_value = mock_pool
    
    features, source = await fetch_shade_features_postgis(19.14, 72.88, 60)
    
    assert source == "postgis"
    assert len(features) == 1
    assert features[0]["feature_type"] == "forest"
    assert features[0]["tags"]["landuse"] == "forest"
    
    # Assert estimate_shade_percent applies the +25% forest rule
    shade = estimate_shade_percent(features, solar_elevation=45.0, solar_azimuth=180.0)
    assert shade == 25.0

@pytest.mark.asyncio
@patch("app.services.postgis_shade.get_pool")
async def test_fetch_shade_features_postgis_empty_result(mock_get_pool):
    mock_conn = MockConnection()
    mock_conn.fetch = AsyncMock(return_value=[])
    mock_pool = MockPool(mock_conn)
    mock_get_pool.return_value = mock_pool
    
    features, source = await fetch_shade_features_postgis(19.14, 72.88, 60)
    assert source == "postgis_empty"
    assert features == []

@pytest.mark.asyncio
@patch("app.services.postgis_shade.get_pool")
async def test_fetch_shade_features_postgis_connection_error(mock_get_pool):
    # Make get_pool raise an exception to simulate connection error
    mock_get_pool.side_effect = Exception("Connection Refused")
    
    features, source = await fetch_shade_features_postgis(19.14, 72.88, 60)
    assert source == "postgis_error"
    assert features == []

@pytest.mark.asyncio
@patch("app.services.osm_shade.fetch_shade_features_postgis")
@patch("app.services.osm_shade.fetch_shade_features")
@patch("app.services.osm_shade.estimate_shade_from_street_type")
@patch("app.services.solar.get_solar_position")
async def test_fetch_shade_for_tile_falls_back_to_overpass_on_empty(
    mock_solar, mock_street, mock_overpass, mock_postgis
):
    # Mock daytime solar position
    mock_solar.return_value = {
        "is_night": False,
        "elevation": 45.0,
        "azimuth": 180.0
    }
    # Mock postgis to return empty
    mock_postgis.return_value = ([], "postgis_empty")
    
    # Mock overpass to return real features
    mock_overpass.return_value = ([
        {"lat": 19.14, "lon": 72.88, "tags": {"natural": "tree"}}
    ], "overpass")
    
    res = await fetch_shade_for_tile("19.1400_72.8800")
    
    assert res["source"] == "overpass"
    mock_overpass.assert_called_once()

@pytest.mark.asyncio
@patch("app.services.osm_shade.fetch_shade_features_postgis")
@patch("app.services.osm_shade.fetch_shade_features")
@patch("app.services.osm_shade.estimate_shade_from_street_type")
@patch("app.services.solar.get_solar_position")
async def test_fetch_shade_for_tile_falls_back_to_overpass_on_postgis_error(
    mock_solar, mock_street, mock_overpass, mock_postgis
):
    # Mock daytime solar position
    mock_solar.return_value = {
        "is_night": False,
        "elevation": 45.0,
        "azimuth": 180.0
    }
    # Mock postgis to fail
    mock_postgis.return_value = ([], "postgis_error")
    
    # Mock overpass to return real features
    mock_overpass.return_value = ([
        {"lat": 19.14, "lon": 72.88, "tags": {"natural": "tree"}}
    ], "overpass")
    
    res = await fetch_shade_for_tile("19.1400_72.8800")
    
    assert res["source"] == "overpass"
    mock_overpass.assert_called_once()

@pytest.mark.asyncio
@patch("app.services.osm_shade.fetch_shade_features_postgis")
@patch("app.services.osm_shade.fetch_shade_features")
@patch("app.services.solar.get_solar_position")
async def test_fetch_shade_for_tile_uses_postgis_when_available(
    mock_solar, mock_overpass, mock_postgis
):
    # Mock daytime solar position
    mock_solar.return_value = {
        "is_night": False,
        "elevation": 45.0,
        "azimuth": 180.0
    }
    # Mock postgis to return real features
    mock_postgis.return_value = ([
        {"lat": 19.14, "lon": 72.88, "tags": {"natural": "tree"}, "feature_type": "tree"}
    ], "postgis")
    
    res = await fetch_shade_for_tile("19.1400_72.8800")
    
    assert res["source"] == "postgis"
    mock_overpass.assert_not_called()

# Live integration test, skipped by default
@pytest.mark.live
@pytest.mark.asyncio
@pytest.mark.skip(reason="Live integration test, skipped by default")
async def test_live_postgis_forest_query():
    # Coordinates inside Sanjay Gandhi National Park / Aarey Colony area
    lat, lon = 19.166, 72.894
    features, source = await fetch_shade_features_postgis(lat, lon, radius_m=300)
    
    assert source == "postgis"
    assert len(features) > 0
    
    # Verify that at least one forest or wood polygon was returned, showing forests survived the migration
    forests = [f for f in features if f["feature_type"] == "forest"]
    assert len(forests) > 0, "No forest features retrieved from local database near green space!"
    
    # Log the number of forest features found
    print(f"Successfully retrieved {len(forests)} forest features near Sanjay Gandhi National Park / Aarey Colony.")
