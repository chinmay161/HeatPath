"""
Smoke tests for main application and stub endpoints.
"""
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

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

def test_score_route(httpx_mock):
    """Test the score route endpoint."""
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
    response = client.post("/score-route/?heat_index=30.0&aqi=50.0&heat_sensitivity=5&aqi_sensitivity=5", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "heat_safety_score" in data
    assert "shade_safety_score" in data
    assert "overall_score" in data
    assert isinstance(data["heat_safety_score"], float)
    assert isinstance(data["shade_safety_score"], float)
    assert isinstance(data["overall_score"], float)

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
