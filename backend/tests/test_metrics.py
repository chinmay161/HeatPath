"""
Tests for operational metrics collection and observability endpoints.
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.metrics import metrics

client = TestClient(app)


def setup_function():
    """Reset metrics before each test."""
    metrics.reset_for_testing()


def test_metrics_initial_state():
    """Verify initial counters and hit rate."""
    data = metrics.get_metrics()
    assert data["weather_provider_failures_total"] == 0
    assert data["aqi_provider_failures_total"] == 0
    assert data["shade_provider_failures_total"] == 0
    assert data["cache_hits_total"] == 0
    assert data["cache_misses_total"] == 0
    assert data["cache_hit_rate"] == 0.0


def test_record_provider_failures():
    """Verify failure counters increment on provider errors."""
    metrics.record_provider_call("weather", duration_ms=45.2, success=False, failure_type="timeout")
    metrics.record_provider_call("weather", duration_ms=50.1, success=False, failure_type="rate_limited")
    metrics.record_provider_call("aqi", duration_ms=25.0, success=False, failure_type="http_error")
    metrics.record_provider_call("shade", duration_ms=120.5, success=False, failure_type="unreachable")

    data = metrics.get_metrics()
    assert data["weather_provider_failures_total"] == 2
    assert data["aqi_provider_failures_total"] == 1
    assert data["shade_provider_failures_total"] == 1


def test_cache_hit_rate_computation():
    """Verify hit rate is computed as hits / (hits + misses)."""
    metrics.record_cache_access(hits=8, misses=2)
    assert metrics.cache_hit_rate == 0.8

    metrics.record_cache_access(hits=2, misses=0)
    # Total hits=10, misses=2 -> 10/12 = 0.8333
    assert metrics.cache_hit_rate == 0.8333


def test_provider_latency_summary():
    """Verify provider latency samples calculate avg, last, p95."""
    for lat in [10.0, 20.0, 30.0, 40.0, 50.0]:
        metrics.record_provider_call("weather", duration_ms=lat, success=True)

    data = metrics.get_metrics()
    weather_lat = data["provider_latency_ms"]["weather"]
    assert weather_lat["count"] == 5
    assert weather_lat["avg_ms"] == 30.0
    assert weather_lat["last_ms"] == 50.0


def test_get_metrics_endpoint():
    """Verify GET /metrics exposes operational metrics in JSON format."""
    metrics.record_provider_call("weather", duration_ms=15.0, success=True)
    metrics.record_cache_access(hits=5, misses=5)

    response = client.get("/metrics")
    assert response.status_code == 200
    json_data = response.json()
    assert "weather_provider_failures_total" in json_data
    assert "cache_hit_rate" in json_data
    assert json_data["cache_hit_rate"] == 0.5
    assert "provider_latency_ms" in json_data


def test_health_endpoint_includes_metrics():
    """Verify GET /health contains metrics summary."""
    metrics.record_provider_call("weather", duration_ms=10.0, success=False)
    metrics.record_cache_access(hits=3, misses=1)

    response = client.get("/health")
    assert response.status_code == 200
    json_data = response.json()
    assert "metrics" in json_data
    assert json_data["metrics"]["weather_provider_failures_total"] == 1
    assert json_data["metrics"]["cache_hit_rate"] == 0.75
