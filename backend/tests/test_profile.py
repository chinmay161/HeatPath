"""
Tests for profile management endpoints.
"""
import pytest
from httpx import AsyncClient
from app.main import app
from app.services.user_store import DEFAULT_PROFILE, reset_db


@pytest.fixture(autouse=True)
async def clean_user_db():
    await reset_db()
    yield
    await reset_db()


@pytest.mark.anyio

async def test_get_profile_returns_default_initially():
    async with AsyncClient(app=app, base_url="http://test") as client:
        res = await client.get("/profile/")
        assert res.status_code == 200
        data = res.json()
        assert "name" in data
        assert data["name"] == DEFAULT_PROFILE["name"]
        assert "avatar_id" in data


@pytest.mark.anyio
async def test_put_profile_updates_and_persists():
    async with AsyncClient(app=app, base_url="http://test") as client:
        update_payload = {
            "name": "Maya Sharma",
            "email": "maya@urbanwalks.org",
            "bio": "Always choosing tree canopies over asphalt.",
            "avatar_id": "leaf",
        }
        put_res = await client.put("/profile/", json=update_payload)
        assert put_res.status_code == 200
        updated = put_res.json()
        assert updated["name"] == "Maya Sharma"
        assert updated["email"] == "maya@urbanwalks.org"
        assert updated["bio"] == "Always choosing tree canopies over asphalt."
        assert updated["avatar_id"] == "leaf"

        # Verify get returns updated profile
        get_res = await client.get("/profile/")
        assert get_res.status_code == 200
        assert get_res.json()["name"] == "Maya Sharma"
        assert get_res.json()["avatar_id"] == "leaf"


@pytest.mark.anyio
async def test_put_profile_validation_rejects_empty_name():
    async with AsyncClient(app=app, base_url="http://test") as client:
        res = await client.put("/profile/", json={"name": "   ", "email": "valid@test.com"})
        assert res.status_code == 422


@pytest.mark.anyio
async def test_put_profile_validation_rejects_invalid_email():
    async with AsyncClient(app=app, base_url="http://test") as client:
        res = await client.put("/profile/", json={"name": "Valid Name", "email": "not-an-email"})
        assert res.status_code == 422


@pytest.mark.anyio
async def test_put_profile_validation_rejects_long_bio():
    async with AsyncClient(app=app, base_url="http://test") as client:
        res = await client.put("/profile/", json={"name": "Valid Name", "bio": "x" * 201})
        assert res.status_code == 422
