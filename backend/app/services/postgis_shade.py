import os
import logging
import asyncpg

logger = logging.getLogger(__name__)

_pool: asyncpg.Pool = None

async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        dsn = os.environ.get(
            "POSTGIS_DSN", 
            "postgresql://heatpath_app:heatpath_secure_pass_2026@localhost:5432/heatpath_osm"
        )
        logger.info(f"Initializing PostGIS connection pool with DSN: {dsn}")
        _pool = await asyncpg.create_pool(
            dsn=dsn,
            min_size=2,
            max_size=10
        )
    return _pool
