"""
Caching and rate-limit protection for weather provider (Open-Meteo) calls.

Render's free tier shares outbound IPs, so Open-Meteo's per-IP limits can be used
up by other tenants. To keep calls down and survive 429s:
- Responses are cached per ~0.01° grid cell (about 1 km), in Redis when REDIS_URL
  is set and reachable, otherwise in a bounded in-process TTL cache.
- Entries are kept past their fresh TTL so a stale value (marked with its age) can
  be served when the provider fails.
- A 429 opens a circuit breaker: no Open-Meteo calls at all for retry_after seconds.
"""
import logging
import math
import time
from collections import OrderedDict
from typing import Any, Dict, List, Optional, Tuple

from app.config import config
from app.services.cache import CacheBackend, get_cache

logger = logging.getLogger(__name__)

# Wall clock in seconds; tests replace it
clock = time.time


class TTLMemoryCache(CacheBackend):
    """In-process cache with per-key expiry and LRU eviction beyond max_entries."""

    def __init__(self, max_entries: int = 2000, now=None):
        self.max_entries = max_entries
        self._now = now or (lambda: clock())
        self._store: "OrderedDict[str, Tuple[float, Any]]" = OrderedDict()

    @property
    def name(self) -> str:
        return "memory-ttl"

    def _expired(self, expires_at: float) -> bool:
        return expires_at <= self._now()

    async def get(self, key: str) -> Optional[Any]:
        item = self._store.get(key)
        if item is None:
            return None
        expires_at, value = item
        if self._expired(expires_at):
            del self._store[key]
            return None
        self._store.move_to_end(key)
        return value

    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        expires_at = self._now() + (ttl if ttl is not None else config.CACHE_TTL_SECONDS)
        self._store[key] = (expires_at, value)
        self._store.move_to_end(key)
        while len(self._store) > self.max_entries:
            self._store.popitem(last=False)
        return True

    async def delete(self, key: str) -> bool:
        self._store.pop(key, None)
        return True

    async def exists(self, key: str) -> bool:
        return await self.get(key) is not None

    async def clear(self) -> bool:
        self._store.clear()
        return True

    async def get_many(self, keys: List[str]) -> Dict[str, Any]:
        results = {}
        for key in keys:
            value = await self.get(key)
            if value is not None:
                results[key] = value
        return results

    async def health_check(self) -> bool:
        return True

    async def close(self) -> None:
        self._store.clear()

    def __len__(self) -> int:
        return len(self._store)


_memory_cache = TTLMemoryCache(max_entries=config.PROVIDER_CACHE_MAX_ENTRIES)


async def get_provider_cache() -> CacheBackend:
    """Redis when REDIS_URL is set and reachable; otherwise the bounded in-process cache."""
    if config.REDIS_URL:
        try:
            cache = await get_cache()
            if cache.name == "redis":
                return cache
        except Exception as e:
            logger.warning("[provider_cache] Redis unavailable (%s); using in-process cache", e)
    return _memory_cache


def grid_cell(lat: float, lon: float) -> Tuple[float, float]:
    """Snap a coordinate to its ~0.01° grid cell (about 1.1 km of latitude)."""
    return round(lat, 2), round(lon, 2)


def cache_key(service: str, lat: float, lon: float) -> str:
    cell_lat, cell_lon = grid_cell(lat, lon)
    return f"provider:open-meteo:{service}:{cell_lat:.2f}:{cell_lon:.2f}"


async def read_entry(key: str) -> Optional[dict]:
    """Cached entry {"fetched_at": epoch seconds, "data": ...}, or None."""
    try:
        cache = await get_provider_cache()
        entry = await cache.get(key)
    except Exception as e:
        logger.warning("[provider_cache] read failed for %s: %s", key, e)
        return None
    if isinstance(entry, dict) and "fetched_at" in entry and "data" in entry:
        return entry
    return None


async def write_entry(key: str, data: Any, keep_seconds: int) -> None:
    """Store data stamped with the fetch time; kept for keep_seconds so it can be served stale."""
    try:
        cache = await get_provider_cache()
        await cache.set(key, {"fetched_at": clock(), "data": data}, ttl=keep_seconds)
    except Exception as e:
        logger.warning("[provider_cache] write failed for %s: %s", key, e)


def age_seconds(entry: dict) -> int:
    return max(0, int(clock() - float(entry["fetched_at"])))


def is_fresh(entry: dict, ttl_seconds: int) -> bool:
    return clock() - float(entry["fetched_at"]) < ttl_seconds


class CircuitBreaker:
    """After a 429, block all calls to the provider until its retry_after has passed."""

    def __init__(self, name: str):
        self.name = name
        self._open_until = 0.0

    def remaining(self) -> int:
        """Whole seconds until calls are allowed again (0 when closed)."""
        return max(0, math.ceil(self._open_until - clock()))

    @property
    def is_open(self) -> bool:
        return self._open_until > clock()

    def trip(self, retry_after: int) -> None:
        seconds = max(1, min(int(retry_after), config.OPEN_METEO_RATE_LIMIT_MAX_SECONDS))
        until = clock() + seconds
        if until > self._open_until:
            self._open_until = until
            logger.warning("[provider_rate_limited] %s circuit open for %ds", self.name, seconds)

    def reset(self) -> None:
        self._open_until = 0.0


def parse_retry_after(value: Optional[str]) -> int:
    """Retry-After in seconds; falls back to the configured default when absent or not numeric."""
    try:
        seconds = int(float(value)) if value is not None else None
    except (TypeError, ValueError):
        seconds = None
    if seconds is None or seconds <= 0:
        return config.OPEN_METEO_RATE_LIMIT_DEFAULT_SECONDS
    return seconds


# One breaker for all Open-Meteo APIs: the rate limit is per client IP
open_meteo_breaker = CircuitBreaker("open-meteo")
