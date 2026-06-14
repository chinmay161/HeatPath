"""
Smoke tests for main application and stub endpoints.
"""
import re
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

import pytest

@pytest.fixture(autouse=True)
def mock_solar_noon(monkeypatch):
    """
    Globally mock solar elevation to 60.0 degrees (multiplier = 1.0) for smoke tests,
    ensuring that the existing test assertions are deterministic and unaffected by the time of day.
    """
    import app.services.solar as solar
    monkeypatch.setattr(solar, "get_current_elevation", lambda lat, lon: 60.0)
    monkeypatch.setattr(solar, "get_solar_position", lambda lat, lon: {"elevation": 60.0, "azimuth": 180.0, "is_night": False})


def test_health_check():
    """Test the health check endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert "env" in response.json()

def test_get_conditions_live():
    """Test that conditions endpoint returns real data."""
    response = client.get("/conditions/?lat=40.7128&lon=-74.0060")
    assert response.status_code == 200
    data = response.json()
    assert "heat_index" in data
    assert "aqi_index" in data
    assert "shade_index" in data
    assert isinstance(data["heat_index"], float)
    assert 0.0 <= data["aqi_index"] <= 1.0

def test_score_route(httpx_mock, monkeypatch):
    """Test the score route endpoint with auto-fetched live conditions."""
    from app.services import weather
    # Force WAQI_TOKEN to be absent to test the fallback behavior
    monkeypatch.setattr(weather, "WAQI_TOKEN", "")

    # Mock Open-Meteo weather response
    mock_weather = {
        "current": {
            "temperature_2m": 25.0,
            "relative_humidity_2m": 50.0,
            "apparent_temperature": 25.0
        }
    }
    httpx_mock.add_response(
        url=re.compile(r"https://api.open-meteo.com/.*"),
        json=mock_weather
    )

    httpx_mock.add_response(
        url=re.compile(r"https://air-quality-api\.open-meteo\.com/.*"),
        json={"current": {"us_aqi": 50}}
    )

    mock_response = {
        "elements": [
            {"tags": {"natural": "tree"}}
        ]
    }
    httpx_mock.add_response(url="https://overpass-api.de/api/interpreter", json=mock_response)
    httpx_mock.add_response(url="https://overpass-api.de/api/interpreter", json=mock_response)
    
    payload = {
        "path": [
            {"lat": 40.7128, "lon": -74.0060},
            {"lat": 40.7580, "lon": -73.9855},
            {"lat": 40.7829, "lon": -73.9654}
        ]
    }
    # Trigger auto-fetch by omitting heat_index and aqi query parameters
    response = client.post("/score-route/", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "heat_safety_score" in data
    assert "shade_safety_score" in data
    assert "overall_score" in data
    assert isinstance(data["heat_safety_score"], float)
    assert isinstance(data["shade_safety_score"], float)
    assert isinstance(data["overall_score"], float)
    
    # Assert scores are non-zero
    assert data["heat_safety_score"] > 0.0
    assert data["shade_safety_score"] > 0.0
    assert data["overall_score"] > 0.0

def test_update_preferences():
    """Test that preferences endpoint saves and returns settings."""
    payload = {"heat_sensitivity": 8, "aqi_sensitivity": 3}
    response = client.post("/preferences/", json=payload)
    assert response.status_code == 200
    assert response.json()["status"] == "success"

def test_get_preferences():
    """Test that GET /preferences returns current settings."""
    response = client.get("/preferences/")
    assert response.status_code == 200
    data = response.json()
    assert "heat_sensitivity" in data
    assert "aqi_sensitivity" in data
    assert 1 <= data["heat_sensitivity"] <= 10
    assert 1 <= data["aqi_sensitivity"] <= 10