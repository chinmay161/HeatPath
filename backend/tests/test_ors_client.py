import pytest
import re
import httpx
from fastapi.testclient import TestClient
from app.main import app
from app.services.ors_client import fetch_candidate_routes, simplify_path
from app.services import weather

client = TestClient(app)

@pytest.fixture(autouse=True)
def mock_solar_noon(monkeypatch):
    """
    Globally mock solar elevation to 60.0 degrees (multiplier = 1.0) for ORS client tests,
    ensuring that the existing test assertions are deterministic and unaffected by the time of day.
    """
    import app.services.solar as solar
    monkeypatch.setattr(solar, "get_current_elevation", lambda lat, lon: 60.0)
    monkeypatch.setattr(solar, "get_solar_position", lambda lat, lon: {"elevation": 60.0, "azimuth": 180.0, "is_night": False})


@pytest.mark.asyncio
async def test_fetch_candidate_routes_success(httpx_mock):
    from app.services.ors_client import _route_cache
    _route_cache.clear()
    # Mock OpenRouteService directions GeoJSON response
    mock_response = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [72.8347, 18.9220],
                        [72.8350, 18.9225]
                    ]
                }
            },
            {
                "type": "Feature",
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [72.8347, 18.9220],
                        [72.8360, 18.9230]
                    ]
                }
            }
        ]
    }
    httpx_mock.add_response(
        url="https://api.openrouteservice.org/v2/directions/foot-walking/geojson",
        json=mock_response
    )
    
    routes = await fetch_candidate_routes(
        start_lat=18.9220,
        start_lon=72.8347,
        end_lat=18.9230,
        end_lon=72.8360,
        n=2
    )
    
    assert len(routes) == 2
    # Verify [lon, lat] is converted to {"lat": lat, "lon": lon} immediately
    assert routes[0] == [{"lat": 18.9220, "lon": 72.8347}, {"lat": 18.9225, "lon": 72.8350}]
    assert routes[1] == [{"lat": 18.9220, "lon": 72.8347}, {"lat": 18.9230, "lon": 72.8360}]


@pytest.mark.asyncio
async def test_fetch_candidate_routes_error(httpx_mock):
    from app.services.ors_client import _route_cache
    _route_cache.clear()
    httpx_mock.add_response(
        url="https://api.openrouteservice.org/v2/directions/foot-walking/geojson",
        status_code=500,
        text="Internal Server Error"
    )
    
    with pytest.raises(httpx.HTTPStatusError):
        # We expect it to raise an HTTPException(status_code=502, ...)
        from fastapi import HTTPException
        try:
            await fetch_candidate_routes(18.9220, 72.8347, 18.9230, 72.8360, n=2)
        except HTTPException as e:
            assert e.status_code == 502
            assert "returned 500" in e.detail
            raise httpx.HTTPStatusError("Mocked status error", request=httpx.Request("POST", ""), response=httpx.Response(500))


def test_simplify_path_large():
    # Path of 50 points
    path = [{"lat": float(i), "lon": float(i)} for i in range(50)]
    simplified = simplify_path(path, max_points=20)
    assert len(simplified) == 20
    assert simplified[0] == {"lat": 0.0, "lon": 0.0}
    assert simplified[-1] == {"lat": 49.0, "lon": 49.0}


def test_simplify_path_small_or_equal():
    # Path of 15 points (<= 20 points) should be returned unchanged
    path = [{"lat": float(i), "lon": float(i)} for i in range(15)]
    simplified = simplify_path(path, max_points=20)
    assert len(simplified) == 15
    assert simplified == path


def test_find_routes_endpoint_integration(httpx_mock, monkeypatch):
    # Ensure WAQI_TOKEN is set so that the code makes the HTTP request to WAQI
    monkeypatch.setattr(weather, "WAQI_TOKEN", "dummy_token")

    # Mock solar position to daytime so shade_for_path actually calls
    # fetch_shade_features (Overpass) instead of short-circuiting on "night"
    import app.services.solar as solar
    monkeypatch.setattr(
        solar, "get_solar_position",
        lambda lat, lon: {"elevation": 60.0, "azimuth": 180.0, "is_night": False},
    )
    monkeypatch.setattr(solar, "get_current_elevation", lambda lat, lon: 60.0)

    # Mock ORS Directions Response
    mock_geojson = {
        "features": [
            {
                "geometry": {
                    "coordinates": [
                        [72.8347, 18.9220],
                        [72.8350, 18.9225]
                    ]
                }
            }
        ]
    }
    httpx_mock.add_response(
        url="https://api.openrouteservice.org/v2/directions/foot-walking/geojson",
        json=mock_geojson
    )
    
    # Mock Open-Meteo response
    mock_weather = {
        "current": {
            "temperature_2m": 32.5,
            "relative_humidity_2m": 60.0,
            "apparent_temperature": 38.0
        }
    }
    httpx_mock.add_response(
        url=re.compile(r"https://api.open-meteo.com/.*"),
        json=mock_weather
    )
    
    # Mock Open-Meteo AQI Response
    mock_aqi = {
        "current": {
            "us_aqi": 80
        }
    }
    httpx_mock.add_response(
        url=re.compile(r"https://air-quality-api.open-meteo.com/.*"),
        json=mock_aqi
    )
    
    # Mock Overpass Interpreter response (for OSM Shade)
    mock_overpass = {
        "elements": [
            {"tags": {"natural": "tree"}},
            {"tags": {"building": "yes"}}
        ]
    }
    httpx_mock.add_response(
        url="https://overpass-api.de/api/interpreter",
        json=mock_overpass
    )
    
    payload = {
        "start": {"lat": 18.9220, "lon": 72.8347},
        "end": {"lat": 18.9225, "lon": 72.8350},
        "n_routes": 1
    }
    
    response = client.post("/find-routes/", json=payload)
    assert response.status_code == 200
    
    data = response.json()
    assert "routes" in data
    assert len(data["routes"]) == 1
    
    route = data["routes"][0]
    assert route["rank"] == 1
    assert "overall_score" in route
    assert "shade_safety_score" in route
    assert "heat_safety_score" in route
    assert len(route["path"]) == 2
    assert route["path"][0] == {"lat": 18.9220, "lon": 72.8347}
    assert route["path"][1] == {"lat": 18.9225, "lon": 72.8350}
    
    assert "conditions" in data
    assert data["conditions"]["heat_index"] > 0
    assert data["conditions"]["aqi_normalised"] == 80 / 300.0
    assert data["conditions"]["fetched_at_lat"] == 18.9220
    assert data["conditions"]["fetched_at_lon"] == 72.8347


def test_find_routes_path_has_multiple_points(monkeypatch):
    path = [
        {"lat": 18.9220, "lon": 72.8347},
        {"lat": 18.9250, "lon": 72.8349},
        {"lat": 18.9280, "lon": 72.8351},
        {"lat": 18.9310, "lon": 72.8353},
        {"lat": 18.9340, "lon": 72.8354},
        {"lat": 18.9398, "lon": 72.8355},
    ]

    import app.routers.find_routes as find_routes_router

    async def fake_fetch_candidate_routes(*args, **kwargs):
        return [path]

    async def fake_get_weather(lat, lon):
        return {"temperature_c": 34.0, "humidity_pct": 65.0, "feels_like_c": 36.5}

    async def fake_get_aqi(lat, lon):
        return 80

    async def fake_shade_for_path(route_path):
        return {
            "shade_values": [35.0 for _ in range(len(route_path) - 1)],
            "solar_elevation": 60.0,
            "solar_multiplier": 1.0,
            "shade_sources": ["street_type" for _ in range(len(route_path) - 1)],
        }

    async def fake_crowd_for_path(route_path):
        return [0.0 for _ in range(len(route_path) - 1)]

    monkeypatch.setattr(find_routes_router, "fetch_candidate_routes", fake_fetch_candidate_routes)
    monkeypatch.setattr(find_routes_router, "get_weather", fake_get_weather)
    monkeypatch.setattr(find_routes_router, "get_aqi", fake_get_aqi)
    monkeypatch.setattr(find_routes_router, "shade_for_path", fake_shade_for_path)
    monkeypatch.setattr(find_routes_router, "crowd_for_path", fake_crowd_for_path)

    response = client.post(
        "/find-routes/",
        json={
            "start": {"lat": 18.9220, "lon": 72.8347},
            "end": {"lat": 18.9398, "lon": 72.8355},
            "n_routes": 2,
        },
    )

    assert response.status_code == 200
    for route in response.json()["routes"]:
        assert len(route["path"]) > 2


@pytest.mark.asyncio
async def test_fetch_candidate_routes_deduplication(httpx_mock):
    from app.services.ors_client import _route_cache
    _route_cache.clear()
    # Mock response returning two routes: Route 1 and Route 2.
    # Route 2 is highly overlapping with Route 1 (same path, except one point is 5 meters off)
    mock_response = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [72.8347, 18.9220],
                        [72.8350, 18.9225]
                    ]
                }
            },
            {
                "type": "Feature",
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [72.8347, 18.9220],
                        # 18.92251 (approx 1 meter north of 18.9225)
                        [72.8350, 18.92251]
                    ]
                }
            }
        ]
    }
    httpx_mock.add_response(
        url="https://api.openrouteservice.org/v2/directions/foot-walking/geojson",
        json=mock_response
    )

    routes = await fetch_candidate_routes(
        start_lat=18.9220,
        start_lon=72.8347,
        end_lat=18.9225,
        end_lon=72.8350,
        n=2
    )

    # Route 2 is dropped because its complete geometry is within 10 m of Route 1.
    assert len(routes) == 1
    assert routes[0] == [{"lat": 18.9220, "lon": 72.8347}, {"lat": 18.9225, "lon": 72.8350}]


@pytest.mark.asyncio
async def test_fetch_candidate_routes_keeps_partially_overlapping_alternative(httpx_mock):
    from app.services.ors_client import _route_cache
    _route_cache.clear()
    shared_start = [72.8347, 18.9220]
    shared_end = [72.8360, 18.9240]
    httpx_mock.add_response(
        url="https://api.openrouteservice.org/v2/directions/foot-walking/geojson",
        json={
            "features": [
                {"geometry": {"coordinates": [
                    shared_start, [72.8350, 18.9225], [72.8355, 18.9232], shared_end,
                ]}},
                {"geometry": {"coordinates": [
                    shared_start, [72.8347, 18.9226], [72.8350, 18.9235], shared_end,
                ]}},
            ]
        },
    )

    routes = await fetch_candidate_routes(
        start_lat=18.9220,
        start_lon=72.8347,
        end_lat=18.9240,
        end_lon=72.8360,
        n=2,
    )

    assert len(routes) == 2
