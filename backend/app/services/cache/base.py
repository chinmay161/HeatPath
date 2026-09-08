"""
Cache backend base abstraction.
"""
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional


class CacheBackend(ABC):
    """
    Abstract interface for cache implementations.
    Application code interacts strictly with this interface.
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """Name of the cache backend implementation (e.g. 'redis', 'noop')."""
        pass

    @abstractmethod
    async def get(self, key: str) -> Optional[Any]:
        """Retrieve a value by key. Returns None on cache miss or failure."""
        pass

    @abstractmethod
    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """Store a value with an optional TTL in seconds."""
        pass

    @abstractmethod
    async def delete(self, key: str) -> bool:
        """Delete a key from the cache. Returns True if deleted or not found."""
        pass

    @abstractmethod
    async def exists(self, key: str) -> bool:
        """Check if a key exists in the cache."""
        pass

    @abstractmethod
    async def clear(self) -> bool:
        """Clear all keys in the current cache namespace."""
        pass

    async def get_many(self, keys: List[str]) -> Dict[str, Any]:
        """
        Retrieve multiple keys.
        Default implementation queries keys individually; subclasses should override
        with pipeline/mget batching where supported.
        """
        results = {}
        for key in keys:
            val = await self.get(key)
            if val is not None:
                results[key] = val
        return results

    async def set_many(self, mapping: Dict[str, Any], ttl: Optional[int] = None) -> bool:
        """
        Store multiple key-value pairs.
        Default implementation stores keys individually; subclasses should override
        with pipeline batching where supported.
        """
        for key, val in mapping.items():
            await self.set(key, val, ttl=ttl)
        return True

    @abstractmethod
    async def health_check(self) -> bool:
        """Check if the cache backend is reachable and operating normally."""
        pass

    @abstractmethod
    async def close(self) -> None:
        """Release any underlying client connections or connection pools."""
        pass
