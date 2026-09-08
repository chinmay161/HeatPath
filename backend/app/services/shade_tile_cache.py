"""
Shade tile cache service.
Snaps coordinates to ~250m grid tiles and provides Redis/NoOp tile cache access.
"""
import logging
from typing import Dict, List, Tuple

from app.config import config
from app.services.cache import get_cache, get_cache_sync

logger = logging.getLogger(__name__)

# Tile snapping constant (≈ 250m at Mumbai's latitude 18.9°N)
TILE_SIZE = 0.00225


def snap_to_tile(lat: float, lon: float) -> Tuple[float, float]:
    """Snap lat/lon to nearest TILE_SIZE boundaries."""
    snapped_lat = round(round(lat / TILE_SIZE) * TILE_SIZE, 4)
    snapped_lon = round(round(lon / TILE_SIZE) * TILE_SIZE, 4)
    return (snapped_lat, snapped_lon)


def tile_key(lat: float, lon: float) -> str:
    """Format snapped lat/lon to string key representation."""
    t = snap_to_tile(lat, lon)
    return f"{t[0]:.4f}_{t[1]:.4f}"


async def get_tiles(keys: List[str]) -> Dict[str, dict]:
    """Asynchronous bulk lookup for tiles from the cache abstraction."""
    if not keys:
        return {}
    cache = await get_cache()
    cached = await cache.get_many(keys)
    return {
        k: v
        for k, v in cached.items()
        if isinstance(v, dict) and "shade_pct" in v
    }


async def store_tiles(tiles: Dict[str, dict]) -> None:
    """
    Asynchronous store for computed tiles.
    Never caches incomplete results — only caches successful computations.
    """
    if not tiles:
        return
    valid_tiles = {
        k: v
        for k, v in tiles.items()
        if isinstance(v, dict)
        and "shade_pct" in v
        and v.get("source") != "fallback"
        and v.get("source") != "failed"
    }
    if not valid_tiles:
        return

    cache = await get_cache()
    await cache.set_many(valid_tiles, ttl=config.CACHE_TTL_SECONDS)


def clear_cache() -> None:
    """Clear cached tiles synchronously."""
    cache = get_cache_sync()
    if hasattr(cache, "_store"):
        cache._store.clear()


async def clear_cache_async() -> None:
    """Clear cached tiles asynchronously."""
    cache = await get_cache()
    await cache.clear()


async def cache_stats() -> dict:
    """Retrieve cache stats for health checking."""
    cache = await get_cache()
    healthy = await cache.health_check()
    return {
        "backend": cache.name,
        "status": "healthy" if healthy else "degraded",
    }
