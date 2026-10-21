"""
Tests for uptime-monitor endpoints (/ping liveness probe, /health).
"""
from fastapi.testclient import TestClient
import pytest

import app.services.postgis_shade as postgis_shade
from app.main import app

client = TestClient(app)


@pytest.fixture
def forbid_postgis_pool(monkeypatch):
    """Fail the test if anything tries to acquire the PostGIS pool."""
    async def _fail():
        raise AssertionError("PostGIS pool must not be touched")
    monkeypatch.setattr(postgis_shade, "get_pool", _fail)


@pytest.mark.parametrize("method", ["GET", "HEAD"])
def test_ping_returns_200(method):
    response = client.request(method, "/ping")
    assert response.status_code == 200
    if method == "GET":
        assert response.json() == {"status": "ok"}


def test_ping_never_touches_postgis_pool(forbid_postgis_pool):
    assert client.get("/ping").status_code == 200
    assert client.head("/ping").status_code == 200


@pytest.fixture
def stub_postgis_pool(monkeypatch):
    """Avoid real PostGIS connection attempts during /health checks."""
    async def _no_pool():
        return None
    monkeypatch.setattr(postgis_shade, "get_pool", _no_pool)


@pytest.mark.parametrize("method", ["GET", "HEAD"])
def test_health_returns_200(method, stub_postgis_pool):
    response = client.request(method, "/health")
    assert response.status_code == 200
    if method == "GET":
        assert response.json()["status"] == "ok"
