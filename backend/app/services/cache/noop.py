"""
No-Op cache implementation.
Used when Redis is unavailable or disabled.
"""
from typing import Any, Dict, List, Optional
from .base import CacheBackend


class NoOpCache(CacheBackend):
    """
    Inert cache backend that always behaves as a cache miss.
    Guarantees the application never crashes when Redis is offline.
    """

    @property
    def name(self) -> str:
        return "noop"

    async def get(self, key: str) -> Optional[Any]:
        return None

    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        return True

    async def delete(self, key: str) -> bool:
        return True

    async def exists(self, key: str) -> bool:
        return False

    async def clear(self) -> bool:
        return True

    async def get_many(self, keys: List[str]) -> Dict[str, Any]:
        return {}

    async def set_many(self, mapping: Dict[str, Any], ttl: Optional[int] = None) -> bool:
        return True

    async def health_check(self) -> bool:
        return True

    async def close(self) -> None:
        pass
