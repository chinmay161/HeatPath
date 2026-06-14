import sqlite3
import os
import logging
from datetime import datetime, timezone, timedelta
import asyncio
from typing import Dict, List, Tuple

logger = logging.getLogger(__name__)

# Determine paths
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DB_DIR = os.path.join(BASE_DIR, "data")
DB_PATH = os.path.join(DB_DIR, "shade_tiles.db")

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

def init_db() -> None:
    """Initialize the SQLite DB, create table and index, and run TTL eviction."""
    os.makedirs(DB_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    try:
        with conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS shade_tiles (
                    tile_key    TEXT PRIMARY KEY,
                    shade_pct   REAL NOT NULL,
                    source      TEXT NOT NULL,
                    computed_at TEXT NOT NULL,
                    radius_m    INTEGER NOT NULL
                );
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_tile_key ON shade_tiles(tile_key);")
            
            # TTL Eviction (evict tiles computed > 6 hours ago)
            cutoff = (datetime.now(timezone.utc) - timedelta(hours=6)).isoformat()
            cursor = conn.cursor()
            cursor.execute("DELETE FROM shade_tiles WHERE computed_at < ?", (cutoff,))
            n = cursor.rowcount
            if n > 0:
                logger.info(f"[tile_cache] evicted {n} stale tiles (>6h)")

            # Create cache_meta table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS cache_meta (
                    key TEXT PRIMARY KEY,
                    value TEXT
                );
            """)
    except Exception as e:
        logger.error(f"[tile_cache] DB initialization failed: {e}")
    finally:
        conn.close()

    # Version Migration Guard
    conn = sqlite3.connect(DB_PATH)
    try:
        with conn:
            cursor = conn.cursor()
            cursor.execute("SELECT value FROM cache_meta WHERE key = 'shade_version'")
            row = cursor.fetchone()
            has_v3 = row and row[0] == "v3"
        if not has_v3:
            invalidate_v2_tiles()
            with conn:
                conn.execute("INSERT OR REPLACE INTO cache_meta (key, value) VALUES (?, ?)", ("shade_version", "v3"))
    except Exception as e:
        logger.error(f"[tile_cache] Migration check failed: {e}")
    finally:
        conn.close()


def invalidate_v2_tiles() -> int:
    """Wipes all non-night tiles (v2 multiplier was applied to these)."""
    conn = sqlite3.connect(DB_PATH)
    try:
        with conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM shade_tiles WHERE source != 'night'")
            n = cursor.rowcount
            logger.info(f"[tile_cache] invalidated {n} v2 tiles for shade v3 migration")
            return n
    except Exception as e:
        logger.error(f"[tile_cache] Failed to invalidate v2 tiles: {e}")
        return 0
    finally:
        conn.close()


# Run DB initialization and TTL eviction on import
init_db()

def _sync_get_tiles(keys: List[str]) -> Dict[str, dict]:
    """Synchronous lookup for tiles in SQLite."""
    if not keys:
        return {}
    conn = sqlite3.connect(DB_PATH)
    try:
        placeholders = ",".join("?" for _ in keys)
        query = f"SELECT tile_key, shade_pct, source FROM shade_tiles WHERE tile_key IN ({placeholders})"
        cursor = conn.cursor()
        cursor.execute(query, keys)
        rows = cursor.fetchall()
        return {row[0]: {"shade_pct": row[1], "source": row[2]} for row in rows}
    except Exception as e:
        logger.error(f"[tile_cache] get_tiles query failed: {e}")
        return {}
    finally:
        conn.close()

async def get_tiles(keys: List[str]) -> Dict[str, dict]:
    """Asynchronous bulk lookup using executor to prevent event loop blocking."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _sync_get_tiles, keys)

def _sync_store_tiles(tiles: Dict[str, dict]) -> None:
    """Synchronous store for tiles in SQLite using a single transaction."""
    if not tiles:
        return
    conn = sqlite3.connect(DB_PATH)
    try:
        with conn:
            cursor = conn.cursor()
            now_str = datetime.now(timezone.utc).isoformat()
            data = [
                (key, val["shade_pct"], val["source"], now_str, 60)
                for key, val in tiles.items()
            ]
            cursor.executemany("""
                INSERT OR REPLACE INTO shade_tiles (tile_key, shade_pct, source, computed_at, radius_m)
                VALUES (?, ?, ?, ?, ?)
            """, data)
    except Exception as e:
        logger.error(f"[tile_cache] store_tiles execution failed: {e}")
    finally:
        conn.close()

async def store_tiles(tiles: Dict[str, dict]) -> None:
    """Asynchronous bulk store using executor to prevent event loop blocking."""
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _sync_store_tiles, tiles)

def cache_stats() -> dict:
    """Retrieve database stats synchronously for health checking."""
    conn = sqlite3.connect(DB_PATH)
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*), MIN(computed_at) FROM shade_tiles")
        row = cursor.fetchone()
        total_tiles = row[0] if row else 0
        oldest_tile = row[1] if row and row[1] else "None"
        return {
            "total_tiles": total_tiles,
            "oldest_tile": oldest_tile,
            "db_path": DB_PATH
        }
    except Exception as e:
        logger.warning(f"[tile_cache] Failed to fetch cache stats: {e}")
        return {
            "total_tiles": 0,
            "oldest_tile": "None",
            "db_path": DB_PATH
        }
    finally:
        conn.close()
