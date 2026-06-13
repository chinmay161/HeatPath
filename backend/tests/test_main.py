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

def test_get_conditions_stub():
    """Test the conditions stub endpoint."""
    response = client.get("/conditions/?lat=40.7128&lon=-74.0060")
    assert response.status_code == 501
    assert response.json()["detail"] == "not implemented"

def test_score_route_stub():
    """Test the score route stub endpoint."""
    payload = {
        "path": [
            {"lat": 40.7128, "lon": -74.0060},
            {"lat": 40.7580, "lon": -73.9855}
        ]
    }
    response = client.post("/score-route/", json=payload)
    assert response.status_code == 501
    assert response.json()["detail"] == "not implemented"

def test_update_preferences_stub():
    """Test the update preferences stub endpoint."""
    payload = {
        "heat_sensitivity": 5,
        "aqi_sensitivity": 5
    }
    response = client.post("/preferences/", json=payload)
    assert response.status_code == 501
    assert response.json()["detail"] == "not implemented"
