"""
User-Scoped Preferences Store

Defines an abstract persistence seam (PreferencesStore) and an in-memory
implementation (MemoryPreferencesStore) that keys user preferences strictly
by normalized user identity (`guest|...` or `auth0|...`).

Ensures complete isolation between user profiles and prevents global state leaks.
"""

from abc import ABC, abstractmethod
from copy import deepcopy
from typing import Dict, Any, Optional

DEFAULT_PREFERENCES: Dict[str, Any] = {
    "heat_sensitivity": 5,
    "aqi_sensitivity": 5,
    "avoid_crowds": False,
    "walking_speed": "normal",
    "accessibility": "none",
    "units": "celsius",
    "theme": "system",
    "favorite_routes": [],
}


class PreferencesStore(ABC):
    """Abstract interface defining the contract for user preferences storage."""

    @abstractmethod
    async def get(self, user_id: str) -> Dict[str, Any]:
        """Retrieve preferences for the specified user_id."""
        raise NotImplementedError

    @abstractmethod
    async def update(self, user_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        """Update and return preferences for the specified user_id."""
        raise NotImplementedError

    @abstractmethod
    async def reset(self) -> None:
        """Reset all stored user preferences (used for test isolation)."""
        raise NotImplementedError


class MemoryPreferencesStore(PreferencesStore):
    """
    In-memory thread-safe implementation of PreferencesStore.
    Keyed exclusively by normalized user_id strings.
    """

    def __init__(self):
        self._store: Dict[str, Dict[str, Any]] = {}

    async def get(self, user_id: str) -> Dict[str, Any]:
        if not user_id:
            raise ValueError("user_id cannot be empty")

        if user_id not in self._store:
            self._store[user_id] = deepcopy(DEFAULT_PREFERENCES)

        return deepcopy(self._store[user_id])

    async def update(self, user_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        if not user_id:
            raise ValueError("user_id cannot be empty")

        current = await self.get(user_id)

        # Merge allowed preference fields
        for key in (
            "heat_sensitivity",
            "aqi_sensitivity",
            "avoid_crowds",
            "walking_speed",
            "accessibility",
            "units",
            "theme",
            "favorite_routes",
        ):
            if key in updates:
                current[key] = deepcopy(updates[key])

        self._store[user_id] = current
        return deepcopy(self._store[user_id])

    async def reset(self) -> None:
        self._store.clear()


# Default singleton instance
_default_preferences_store = MemoryPreferencesStore()


def get_preferences_store() -> PreferencesStore:
    """FastAPI dependency / factory returning the active PreferencesStore instance."""
    return _default_preferences_store


def set_preferences_store(store: PreferencesStore) -> None:
    """Override the default store instance (e.g. for testing or switching to Postgres)."""
    global _default_preferences_store
    _default_preferences_store = store
