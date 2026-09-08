"""
In-memory cache backend implementation.
Used for isolated unit testing and local development without an external Redis server.
"""
from typing import Any, Dict, List, Optional
from .base import CacheBackend


class InMemoryCache(CacheBackend):
    """
    In-memory cache implementing CacheBackend.
    Allows testing cache hits, misses, and batching in memory.
    """

    def __init__(self):
        self._store: Dict[str, Any] = {}

    @property
    def name(self) -> str:
        return "memory"

    async def get(self, key: str) -> Optional[Any]:
        return self._store.get(key)

    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        self._store[key] = value
        return True

    async def delete(self, key: str) -> bool:
        self._store.pop(key, None)
        return True

    async def exists(self, key: str) -> bool:
        return key in self._store

    async def clear(self) -> bool:
        self._store.clear()
        return True

    async def get_many(self, keys: List[str]) -> Dict[str, Any]:
        return {k: self._store[k] for k in keys if k in self._store}

    async def set_many(self, mapping: Dict[str, Any], ttl: Optional[int] = None) -> bool:
        self._store.update(mapping)
        return True

    async def health_check(self) -> bool:
        return True

    async def close(self) -> None:
        self._store.clear()
