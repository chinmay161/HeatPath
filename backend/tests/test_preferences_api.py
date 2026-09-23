"""
Integration tests for migrated preference endpoints (Phase 6).
Verifies GET, PUT, and POST /preferences with resolved guest and Auth0 identities,
validates 400 on malformed guest ID, and 401 on missing identity headers.
"""

import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.services.preferences_store import get_preferences_store, DEFAULT_PREFERENCES
from app.constants.identity import HEADER_GUEST_ID, HEADER_AUTHORIZATION

VALID_GUEST_1 = "guest|550e8400-e29b-41d4-a716-446655440001"
VALID_GUEST_2 = "guest|550e8400-e29b-41d4-a716-446655440002"


@pytest.fixture(autouse=True)
async def clean_preferences():
    """Reset preferences store before and after each test."""
    store = get_preferences_store()
    await store.reset()
    yield
    await store.reset()


@pytest.mark.anyio
async def test_get_preferences_requires_identity():
    """Verify GET /preferences returns 401 when identity headers are missing."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/preferences/")
        assert res.status_code == 401
        assert "Missing user identity" in res.json()["detail"]


@pytest.mark.anyio
async def test_get_preferences_with_valid_guest():
    """Verify GET /preferences returns default preferences for a new guest."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/preferences/", headers={HEADER_GUEST_ID: VALID_GUEST_1})
        assert res.status_code == 200
        data = res.json()
        assert data["heat_sensitivity"] == DEFAULT_PREFERENCES["heat_sensitivity"]
        assert data["units"] == DEFAULT_PREFERENCES["units"]


@pytest.mark.anyio
async def test_put_and_post_preferences_persists_per_user():
    """Verify both PUT and POST /preferences update and isolate preferences."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Update User 1 via PUT
        payload1 = {
            "heat_sensitivity": 9,
            "units": "fahrenheit",
            "theme": "dark",
        }
        put_res = await client.put(
            "/preferences/",
            json=payload1,
            headers={HEADER_GUEST_ID: VALID_GUEST_1},
        )
        assert put_res.status_code == 200
        assert put_res.json()["preferences"]["heat_sensitivity"] == 9
        assert put_res.json()["preferences"]["units"] == "fahrenheit"

        # 2. Update User 2 via POST (backwards compatibility)
        payload2 = {
            "heat_sensitivity": 3,
            "units": "celsius",
            "theme": "light",
        }
        post_res = await client.post(
            "/preferences/",
            json=payload2,
            headers={HEADER_GUEST_ID: VALID_GUEST_2},
        )
        assert post_res.status_code == 200
        assert post_res.json()["preferences"]["heat_sensitivity"] == 3
        assert post_res.json()["preferences"]["units"] == "celsius"

        # 3. Verify GET returns isolated data for both users
        get1 = await client.get("/preferences/", headers={HEADER_GUEST_ID: VALID_GUEST_1})
        get2 = await client.get("/preferences/", headers={HEADER_GUEST_ID: VALID_GUEST_2})

        assert get1.json()["heat_sensitivity"] == 9
        assert get1.json()["units"] == "fahrenheit"

        assert get2.json()["heat_sensitivity"] == 3
        assert get2.json()["units"] == "celsius"


@pytest.mark.anyio
async def test_update_preferences_malformed_guest_returns_400():
    """Verify malformed guest ID returns 400 Bad Request."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.put(
            "/preferences/",
            json={"heat_sensitivity": 5},
            headers={HEADER_GUEST_ID: "guest|malformed-id-123"},
        )
        assert res.status_code == 400
        assert "Invalid guest identity" in res.json()["detail"]


@pytest.mark.anyio
async def test_update_preferences_validation():
    """Verify validation errors return 422 Unprocessable Entity."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Invalid heat sensitivity (out of bounds)
        res1 = await client.put(
            "/preferences/",
            json={"heat_sensitivity": 15},
            headers={HEADER_GUEST_ID: VALID_GUEST_1},
        )
        assert res1.status_code == 422

        # Invalid units
        res2 = await client.put(
            "/preferences/",
            json={"heat_sensitivity": 5, "units": "kelvin"},
            headers={HEADER_GUEST_ID: VALID_GUEST_1},
        )
        assert res2.status_code == 422
