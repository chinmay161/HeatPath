"""
Shade tile cache service.
Snaps coordinates to ~250m grid tiles and provides tile cache access.
"""
import logging
from typing import Dict, List, Tuple

logger = logging.getLogger(__name__)

# Tile snapping constant (≈ 250m at Mumbai's latitude 18.9°N)
TILE_SIZE = 0.00225

_cache: Dict[str, dict] = {}


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
    """Asynchronous lookup for tiles."""
    if not keys:
        return {}
    return {k: _cache[k] for k in keys if k in _cache}


async def store_tiles(tiles: Dict[str, dict]) -> None:
    """Asynchronous store for tiles."""
    if not tiles:
        return
    _cache.update(tiles)


def clear_cache() -> None:
    """Clear memory tile cache."""
    _cache.clear()


def cache_stats() -> dict:
    """Retrieve cache stats for health checking."""
    return {
        "total_tiles": len(_cache),
        "backend": "memory",
    }
