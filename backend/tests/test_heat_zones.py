from fastapi.testclient import TestClient

import app.routers.heat_zones as heat_zones
from app.main import app

client = TestClient(app)


def _tile_fixture(key: str) -> dict:
    """Build deterministic tile data for heat-zone tests."""
    return {
        "shade_pct": 40.0 + (abs(hash(key)) % 10),
        "source": "street_type",
        "solar_elevation": 60.0,
        "solar_multiplier": 1.0,
    }


def _params(resolution: int = 15) -> dict:
    """Return a small Mumbai viewport suitable for heat-zone tests."""
    return {
        "north": 18.9230,
        "south": 18.9220,
        "east": 72.8357,
        "west": 72.8347,
        "resolution": resolution,
    }


def _install_heat_zone_mocks(monkeypatch, counters: dict | None = None) -> None:
    """Patch expensive heat-zone dependencies with deterministic fakes."""
    counters = counters if counters is not None else {}
    stored_tiles = {}

    async def fake_get_tiles(keys):
        counters["get_tiles"] = counters.get("get_tiles", 0) + 1
        return {key: stored_tiles[key] for key in keys if key in stored_tiles}

    async def fake_store_tiles(tiles):
        counters["store_tiles"] = counters.get("store_tiles", 0) + 1
        stored_tiles.update(tiles)

    async def fake_fetch_shade_for_tile(key):
        counters["fetch_shade_for_tile"] = counters.get("fetch_shade_for_tile", 0) + 1
        return _tile_fixture(key)

    async def fake_get_weather(lat, lon):
        counters["get_weather"] = counters.get("get_weather", 0) + 1
        return {"temperature_c": 34.0, "humidity_pct": 65.0, "feels_like_c": 36.5}

    async def fake_get_aqi(lat, lon):
        counters["get_aqi"] = counters.get("get_aqi", 0) + 1
        return 80

    monkeypatch.setattr(heat_zones, "get_tiles", fake_get_tiles)
    monkeypatch.setattr(heat_zones, "store_tiles", fake_store_tiles)
    monkeypatch.setattr(heat_zones, "fetch_shade_for_tile", fake_fetch_shade_for_tile)
    monkeypatch.setattr(heat_zones, "get_weather", fake_get_weather)
    monkeypatch.setattr(heat_zones, "get_aqi", fake_get_aqi)
    monkeypatch.setattr(
        heat_zones,
        "get_solar_position",
        lambda lat, lon: {"elevation": 60.0, "azimuth": 180.0, "is_night": False},
    )


def setup_function():
    """Clear response-level cache between tests."""
    heat_zones._response_cache.clear()


def test_heat_zones_validates_bbox_too_large():
    response = client.get(
        "/heat-zones/",
        params={"north": 20.0, "south": 18.0, "east": 73.0, "west": 72.9},
    )

    assert response.status_code == 400
    assert "too large" in response.json()["detail"]


def test_heat_zones_validates_inverted_bounds():
    response = client.get(
        "/heat-zones/",
        params={"north": 18.0, "south": 19.0, "east": 73.0, "west": 72.9},
    )

    assert response.status_code == 400


def test_heat_zones_resolution_clamping(monkeypatch):
    _install_heat_zone_mocks(monkeypatch)

    high = client.get("/heat-zones/", params=_params(resolution=100))
    low = client.get("/heat-zones/", params=_params(resolution=2))

    assert high.status_code == 200
    assert high.json()["resolution"] == 25
    assert low.status_code == 200
    assert low.json()["resolution"] == 8


def test_heat_zones_grid_point_count(monkeypatch):
    _install_heat_zone_mocks(monkeypatch)

    response = client.get("/heat-zones/", params=_params(resolution=10))

    assert response.status_code == 200
    assert len(response.json()["grid"]) == 121


def test_heat_zones_dedupes_tile_lookups(monkeypatch):
    counters = {}
    _install_heat_zone_mocks(monkeypatch, counters)

    response = client.get("/heat-zones/", params=_params(resolution=15))

    assert response.status_code == 200
    grid_count = len(response.json()["grid"])
    assert counters["fetch_shade_for_tile"] < grid_count


def test_heat_zones_single_weather_call(monkeypatch):
    counters = {}
    _install_heat_zone_mocks(monkeypatch, counters)

    response = client.get("/heat-zones/", params=_params(resolution=15))

    assert response.status_code == 200
    assert counters["get_weather"] == 1


def test_heat_zones_response_cache_hit(monkeypatch):
    counters = {}
    _install_heat_zone_mocks(monkeypatch, counters)

    first = client.get("/heat-zones/", params=_params(resolution=15))
    second = client.get("/heat-zones/", params=_params(resolution=15))

    assert first.status_code == 200
    assert second.status_code == 200
    assert counters["fetch_shade_for_tile"] > 0
    assert counters["get_tiles"] == 1
    assert first.json() == second.json()
