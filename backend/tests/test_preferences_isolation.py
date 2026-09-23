"""
Unit tests for user-scoped preferences storage and user isolation (Phase 5).
Verifies that preferences are completely isolated between users and that
no global state is shared between guest identities or authenticated users.
"""

import pytest
from app.services.preferences_store import MemoryPreferencesStore, DEFAULT_PREFERENCES


@pytest.fixture
def store():
    """Create fresh isolated MemoryPreferencesStore for each test."""
    return MemoryPreferencesStore()


@pytest.mark.anyio
async def test_get_preferences_returns_independent_defaults(store):
    """Verify that different users receive distinct deepcopied default preferences."""
    user1 = "guest|550e8400-e29b-41d4-a716-446655440001"
    user2 = "guest|550e8400-e29b-41d4-a716-446655440002"

    prefs1 = await store.get(user1)
    prefs2 = await store.get(user2)

    assert prefs1["heat_sensitivity"] == DEFAULT_PREFERENCES["heat_sensitivity"]
    assert prefs2["heat_sensitivity"] == DEFAULT_PREFERENCES["heat_sensitivity"]

    # Verify they are not the same object reference
    assert prefs1 is not prefs2
    assert prefs1["favorite_routes"] is not prefs2["favorite_routes"]


@pytest.mark.anyio
async def test_preferences_isolation_between_guest_users(store):
    """Verify modifying preferences for User 1 does not affect User 2."""
    user1 = "guest|11111111-1111-4111-8111-111111111111"
    user2 = "guest|22222222-2222-4222-8222-222222222222"

    # User 1 customizes their preferences
    await store.update(user1, {
        "heat_sensitivity": 9,
        "units": "fahrenheit",
        "theme": "dark",
        "favorite_routes": [{"id": "r1", "name": "Cubbon Park"}],
    })

    # Read User 1
    p1 = await store.get(user1)
    assert p1["heat_sensitivity"] == 9
    assert p1["units"] == "fahrenheit"
    assert p1["theme"] == "dark"
    assert len(p1["favorite_routes"]) == 1

    # Read User 2: must remain at DEFAULT_PREFERENCES
    p2 = await store.get(user2)
    assert p2["heat_sensitivity"] == DEFAULT_PREFERENCES["heat_sensitivity"]
    assert p2["units"] == "celsius"
    assert p2["theme"] == "system"
    assert len(p2["favorite_routes"]) == 0


@pytest.mark.anyio
async def test_preferences_isolation_between_guest_and_auth0_user(store):
    """Verify complete isolation between guest identity and Auth0 identity."""
    guest_user = "guest|33333333-3333-4333-8333-333333333333"
    auth0_user = "auth0|google-oauth2|123456789"

    await store.update(guest_user, {"walking_speed": "slow"})
    await store.update(auth0_user, {"walking_speed": "brisk"})

    g_prefs = await store.get(guest_user)
    a_prefs = await store.get(auth0_user)

    assert g_prefs["walking_speed"] == "slow"
    assert a_prefs["walking_speed"] == "brisk"


@pytest.mark.anyio
async def test_store_reset_clears_all_users(store):
    """Verify reset purges all user data."""
    u1 = "guest|aaaa-bbbb"
    u2 = "auth0|sub-123"

    await store.update(u1, {"heat_sensitivity": 10})
    await store.update(u2, {"heat_sensitivity": 1})

    await store.reset()

    # After reset, reading users should return fresh default copies
    p1 = await store.get(u1)
    p2 = await store.get(u2)
    assert p1["heat_sensitivity"] == DEFAULT_PREFERENCES["heat_sensitivity"]
    assert p2["heat_sensitivity"] == DEFAULT_PREFERENCES["heat_sensitivity"]
