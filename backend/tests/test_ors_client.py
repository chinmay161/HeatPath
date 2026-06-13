import pytest
import re
import httpx
from fastapi.testclient import TestClient
from app.main import app
from app.services.ors_client import fetch_candidate_routes, simplify_path
from app.services import weather

client = TestClient(app)

@pytest.mark.asyncio
async def test_fetch_candidate_routes_success(httpx_mock):
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
            assert "returned error status 500" in e.detail
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
    
    # Mock WAQI AQI Response
    mock_aqi = {
        "status": "ok",
        "data": {
            "aqi": 80
        }
    }
    httpx_mock.add_response(
        url=re.compile(r"https://api.waqi.info/.*"),
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


@pytest.mark.asyncio
async def test_fetch_candidate_routes_deduplication(httpx_mock):
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

    # Route 2 is dropped by deduplication because > 80% of its waypoints are within 30m of Route 1.
    assert len(routes) == 1
    assert routes[0] == [{"lat": 18.9220, "lon": 72.8347}, {"lat": 18.9225, "lon": 72.8350}]

