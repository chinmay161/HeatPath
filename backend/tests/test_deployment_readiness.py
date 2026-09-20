"""
Unit tests for deployment readiness:
- Dynamic SSL resolution for Neon vs local development
- CORS handling for Vercel preview & production domains
- Resilient in-memory fallback for user profile and preferences when database is unreachable
- Health check endpoint verification
"""
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.services.postgis_shade import resolve_ssl_mode
from app.services.user_store import get_profile, update_profile, get_preferences, update_preferences


def test_resolve_ssl_mode():
    """Verify dynamic SSL resolution for Neon vs local connections."""
    neon_dsn = "postgresql://neondb_owner:password@ep-cool-snow-123456.us-east-2.aws.neon.tech/neondb?sslmode=require"
    assert resolve_ssl_mode(neon_dsn) == "require"

    render_dsn = "postgresql://user:pass@dpg-xyz-a.oregon-postgres.render.com/heatpath"
    assert resolve_ssl_mode(render_dsn) == "require"

    local_dsn = "postgresql://heatpath_app:pass@127.0.0.1:5433/heatpath_osm"
    assert resolve_ssl_mode(local_dsn) == "disable"

    localhost_dsn = "postgresql://heatpath_app:pass@localhost:5432/heatpath_osm"
    assert resolve_ssl_mode(localhost_dsn) == "disable"

    wsl_ip_dsn = "postgresql://heatpath_app:pass@172.23.85.143:5433/heatpath_osm"
    assert resolve_ssl_mode(wsl_ip_dsn) == "disable"


@pytest.mark.asyncio
async def test_cors_vercel_origins():
    """Verify CORS preflight headers for Vercel and local origins."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Vercel production domain
        resp = await client.options(
            "/health",
            headers={
                "Origin": "https://heatpath.vercel.app",
                "Access-Control-Request-Method": "GET",
            },
        )
        assert resp.status_code == 200
        assert resp.headers.get("access-control-allow-origin") == "https://heatpath.vercel.app"

        # Vercel preview / branch deployment domain
        resp_preview = await client.options(
            "/health",
            headers={
                "Origin": "https://heatpath-git-main-chinmay.vercel.app",
                "Access-Control-Request-Method": "GET",
            },
        )
        assert resp_preview.status_code == 200
        assert resp_preview.headers.get("access-control-allow-origin") == "https://heatpath-git-main-chinmay.vercel.app"

        # Localhost development origin
        resp_local = await client.options(
            "/health",
            headers={
                "Origin": "http://localhost:8081",
                "Access-Control-Request-Method": "GET",
            },
        )
        assert resp_local.status_code == 200
        assert resp_local.headers.get("access-control-allow-origin") == "http://localhost:8081"


@pytest.mark.asyncio
async def test_user_store_graceful_offline_fallback(monkeypatch):
    """Verify profile and preferences gracefully fall back to in-memory store when database is down."""
    # Force get_db_pool to fail as if database is offline or unreachable
    async def mock_fail_pool():
        raise ConnectionRefusedError("Simulated database offline error")

    import app.services.user_store as user_store_mod
    monkeypatch.setattr(user_store_mod, "get_db_pool", mock_fail_pool)

    # 1. get_profile should return default profile without raising an exception
    profile = await get_profile()
    assert isinstance(profile, dict)
    assert profile["name"] is not None
    assert "avatar_id" in profile

    # 2. update_profile should return updated profile data without raising an exception
    updated_profile = await update_profile({"name": "Test Explorer", "avatar_id": "water"})
    assert updated_profile["name"] == "Test Explorer"
    assert updated_profile["avatar_id"] == "water"

    # 3. get_preferences should return default preferences without raising an exception
    prefs = await get_preferences()
    assert isinstance(prefs, dict)
    assert "heat_sensitivity" in prefs
    assert "units" in prefs

    # 4. update_preferences should succeed in memory
    updated_prefs = await update_preferences({"heat_sensitivity": 8, "units": "fahrenheit"})
    assert updated_prefs["heat_sensitivity"] == 8
    assert updated_prefs["units"] == "fahrenheit"


@pytest.mark.asyncio
async def test_health_check_endpoint():
    """Verify that /health returns HTTP 200 with all diagnostic metrics."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert "database" in data
        assert "cache" in data
        assert "postgis" in data


@pytest.mark.asyncio
async def test_consecutive_slash_normalization():
    """Verify that requests with double slashes (e.g. //preferences/) are normalized and succeed."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        req = client.build_request("GET", "http://test//preferences/")
        resp = await client.send(req)
        assert resp.status_code == 200
        data = resp.json()
        assert "heat_sensitivity" in data

