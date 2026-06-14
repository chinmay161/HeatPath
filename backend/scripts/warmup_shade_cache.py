import sys
import os
import argparse
import asyncio
import logging
import sqlite3

# Ensure backend directory is in sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Configure logging to stdout
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("warmup_shade_cache")

from app.services.shade_tile_cache import tile_key, TILE_SIZE, DB_PATH, store_tiles
from app.services.osm_shade import fetch_shade_for_tile

async def main():
    parser = argparse.ArgumentParser(description="Warm up HeatPath shade tile cache for Mumbai.")
    parser.add_argument("--dry-run", action="store_true", help="Print tile counts without fetching.")
    args = parser.parse_args()

    # Generate all tile keys in the Mumbai bounding box
    all_keys = []
    lat = 18.870
    while lat <= 19.270 + 1e-9:
        lon = 72.770
        while lon <= 73.050 + 1e-9:
            all_keys.append(tile_key(lat, lon))
            lon += TILE_SIZE
        lat += TILE_SIZE

    # Retain unique keys while preserving order
    unique_all_keys = list(dict.fromkeys(all_keys))
    total_count = len(unique_all_keys)

    # Read currently stored keys
    existing_db_keys = set()
    if os.path.exists(DB_PATH):
        try:
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute("SELECT tile_key FROM shade_tiles")
            existing_db_keys = {row[0] for row in cursor.fetchall()}
            conn.close()
        except Exception as e:
            logger.warning(f"Could not read existing tiles from database: {e}")

    missing_keys = [k for k in unique_all_keys if k not in existing_db_keys]

    if args.dry_run:
        print(f"Total tiles: {total_count}")
        print(f"Missing tiles: {len(missing_keys)}")
        return

    logger.info(f"Starting cache warmup. Total grid tiles: {total_count}, already cached: {len(existing_db_keys)}, missing to fetch: {len(missing_keys)}")

    done = 0
    total_to_fetch = len(missing_keys)

    if total_to_fetch == 0:
        logger.info("All tiles are already warmed up!")
        return

    for key in missing_keys:
        try:
            # fetch_shade_for_tile returns {"shade_pct": float, "source": str}
            result = await fetch_shade_for_tile(key)
            await store_tiles({key: result})
            await asyncio.sleep(0.5)  # Overpass fair-use delay
        except Exception as e:
            logger.error(f"Failed to fetch tile {key}: {e}")

        done += 1
        if done % 50 == 0 or done == total_to_fetch:
            pct = (done / total_to_fetch) * 100
            logger.info(f"[warmup] {done}/{total_to_fetch} tiles complete ({pct:.0f}%)")

    logger.info("Warmup complete!")

if __name__ == "__main__":
    asyncio.run(main())
