"""
PostgreSQL persistence service for user profile and preferences.
All user data is persisted in PostgreSQL/PostGIS as the single source of truth.
"""
import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
import asyncpg

from app.config import config
from app.services.cache import get_cache

logger = logging.getLogger(__name__)

DEFAULT_PROFILE = {
    "name": "Alex River",
    "email": "alex.river@example.com",
    "bio": "Urban walker seeking shady streets and cool breezes.",
    "avatar_id": "tree",
}

DEFAULT_PREFERENCES = {
    "heat_sensitivity": 5,
    "aqi_sensitivity": 5,
    "avoid_crowds": False,
    "walking_speed": "normal",
    "accessibility": "none",
    "units": "celsius",
    "theme": "system",
    "favorite_routes": [],
}

USER_CACHE_TTL = 300  # 300 seconds TTL for Redis cache


async def _cache_get(key: str) -> Optional[Any]:
    """Retrieve item from Redis cache; falls back safely to None on failure."""
    try:
        cache = await get_cache()
        return await cache.get(key)
    except Exception as e:
        logger.warning(f"[user_store] Cache get failed for '{key}': {e}")
        return None


async def _cache_set(key: str, value: Any, ttl: int = USER_CACHE_TTL) -> bool:
    """Store item in Redis cache; fails silently if Redis is unreachable."""
    try:
        cache = await get_cache()
        return await cache.set(key, value, ttl=ttl)
    except Exception as e:
        logger.warning(f"[user_store] Cache set failed for '{key}': {e}")
        return False


async def _cache_delete(key: str) -> bool:
    """Evict item from Redis cache; fails silently if Redis is unreachable."""
    try:
        cache = await get_cache()
        return await cache.delete(key)
    except Exception as e:
        logger.warning(f"[user_store] Cache delete failed for '{key}': {e}")
        return False


_db_pool: Optional[asyncpg.Pool] = None
_db_initialized: bool = False

# Synchronous fallback memory cache for non-async startup contexts
_cached_preferences: Dict[str, Any] = DEFAULT_PREFERENCES.copy()


def get_preferences_cached() -> Dict[str, Any]:
    """Return in-memory cached preferences for immediate synchronous access."""
    return _cached_preferences.copy()


async def get_db_pool() -> asyncpg.Pool:
    """Acquire or initialize the PostgreSQL connection pool for the current event loop."""
    global _db_pool
    current_loop = asyncio.get_running_loop()
    if _db_pool is None or getattr(_db_pool, "_loop", None) is not current_loop or _db_pool._loop.is_closed():
        if _db_pool is not None and getattr(_db_pool, "_loop", None) is not None and not _db_pool._loop.is_closed():
            try:
                await _db_pool.close()
            except Exception:
                pass
        dsn = config.POSTGIS_DSN
        logger.info(f"Initializing user_store PostgreSQL pool with DSN: {dsn}")
        _db_pool = await asyncpg.create_pool(
            dsn=dsn,
            min_size=2,
            max_size=10,
            ssl="disable",
        )
    return _db_pool


async def close_db_pool() -> None:
    """Close the active connection pool if open."""
    global _db_pool
    if _db_pool is not None:
        try:
            if getattr(_db_pool, "_loop", None) is not None and not _db_pool._loop.is_closed():
                await _db_pool.close()
        except Exception:
            pass
        _db_pool = None


async def init_db() -> None:
    """Initialize database tables and indexes in PostgreSQL if they do not exist."""
    global _db_initialized
    if _db_initialized:
        return

    pool = await get_db_pool()
    async with pool.acquire() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL DEFAULT 'Alex River',
                email VARCHAR(255) DEFAULT 'alex.river@example.com',
                bio TEXT DEFAULT 'Urban walker seeking shady streets and cool breezes.',
                avatar_id VARCHAR(50) NOT NULL DEFAULT 'tree',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS user_preferences (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
                heat_sensitivity INTEGER NOT NULL DEFAULT 5 CHECK (heat_sensitivity BETWEEN 1 AND 10),
                aqi_sensitivity INTEGER NOT NULL DEFAULT 5 CHECK (aqi_sensitivity BETWEEN 1 AND 10),
                avoid_crowds BOOLEAN NOT NULL DEFAULT FALSE,
                walking_speed VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (walking_speed IN ('slow', 'normal', 'brisk')),
                accessibility VARCHAR(50) NOT NULL DEFAULT 'none' CHECK (accessibility IN ('none', 'wheelchair', 'flat_ground')),
                units VARCHAR(20) NOT NULL DEFAULT 'celsius' CHECK (units IN ('celsius', 'fahrenheit')),
                theme VARCHAR(20) NOT NULL DEFAULT 'system' CHECK (theme IN ('system', 'light', 'dark')),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS favorite_routes (
                id VARCHAR(64) PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                start_lat DOUBLE PRECISION NOT NULL,
                start_lon DOUBLE PRECISION NOT NULL,
                end_lat DOUBLE PRECISION NOT NULL,
                end_lon DOUBLE PRECISION NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

            CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);
            CREATE INDEX IF NOT EXISTS idx_favorite_routes_user_id ON favorite_routes(user_id);
            CREATE INDEX IF NOT EXISTS idx_favorite_routes_created ON favorite_routes(created_at DESC);
        """)

        # Ensure default user (id=1) exists
        user_row = await conn.fetchrow("SELECT id FROM users WHERE id = 1")
        if not user_row:
            await conn.execute("""
                INSERT INTO users (id, name, email, bio, avatar_id)
                VALUES (1, $1, $2, $3, $4)
                ON CONFLICT (id) DO NOTHING;
            """, DEFAULT_PROFILE["name"], DEFAULT_PROFILE["email"], DEFAULT_PROFILE["bio"], DEFAULT_PROFILE["avatar_id"])

        # Ensure default user_preferences (user_id=1) exists
        pref_row = await conn.fetchrow("SELECT id FROM user_preferences WHERE user_id = 1")
        if not pref_row:
            await conn.execute("""
                INSERT INTO user_preferences (
                    user_id, heat_sensitivity, aqi_sensitivity, avoid_crowds,
                    walking_speed, accessibility, units, theme
                ) VALUES (1, $1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (user_id) DO NOTHING;
            """, DEFAULT_PREFERENCES["heat_sensitivity"], DEFAULT_PREFERENCES["aqi_sensitivity"],
                 DEFAULT_PREFERENCES["avoid_crowds"], DEFAULT_PREFERENCES["walking_speed"],
                 DEFAULT_PREFERENCES["accessibility"], DEFAULT_PREFERENCES["units"],
                 DEFAULT_PREFERENCES["theme"])

    _db_initialized = True


async def reset_db() -> None:
    """Reset database tables to default state for test isolation and purge user cache."""
    await init_db()
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute("TRUNCATE users, user_preferences, favorite_routes CASCADE;")
            await conn.execute("""
                INSERT INTO users (id, name, email, bio, avatar_id)
                VALUES (1, $1, $2, $3, $4);
            """, DEFAULT_PROFILE["name"], DEFAULT_PROFILE["email"], DEFAULT_PROFILE["bio"], DEFAULT_PROFILE["avatar_id"])
            await conn.execute("""
                INSERT INTO user_preferences (
                    user_id, heat_sensitivity, aqi_sensitivity, avoid_crowds,
                    walking_speed, accessibility, units, theme
                ) VALUES (1, $1, $2, $3, $4, $5, $6, $7);
            """, DEFAULT_PREFERENCES["heat_sensitivity"], DEFAULT_PREFERENCES["aqi_sensitivity"],
                 DEFAULT_PREFERENCES["avoid_crowds"], DEFAULT_PREFERENCES["walking_speed"],
                 DEFAULT_PREFERENCES["accessibility"], DEFAULT_PREFERENCES["units"],
                 DEFAULT_PREFERENCES["theme"])

    global _cached_preferences
    _cached_preferences = DEFAULT_PREFERENCES.copy()

    # Invalidate Redis cache
    await _cache_delete("user:1:profile")
    await _cache_delete("user:1:preferences")


def reset_db_sync() -> None:
    """Synchronous wrapper around reset_db for sync test fixtures."""
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    if loop.is_running():
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(lambda: asyncio.run(reset_db()))
            future.result()
    else:
        loop.run_until_complete(reset_db())


def _format_timestamp(dt: Any) -> Optional[str]:
    if dt is None:
        return None
    if hasattr(dt, "isoformat"):
        return dt.isoformat()
    return str(dt)


async def get_profile(user_id: int = 1) -> Dict[str, Any]:
    """Retrieve user profile from PostgreSQL, with Redis cache read-through."""
    cache_key = f"user:{user_id}:profile"
    cached = await _cache_get(cache_key)
    if isinstance(cached, dict) and "name" in cached:
        return cached

    await init_db()
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id, name, email, bio, avatar_id, created_at, updated_at FROM users WHERE id = $1",
            user_id,
        )
        if not row:
            # User row missing, insert default
            await conn.execute("""
                INSERT INTO users (id, name, email, bio, avatar_id)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (id) DO NOTHING;
            """, user_id, DEFAULT_PROFILE["name"], DEFAULT_PROFILE["email"], DEFAULT_PROFILE["bio"], DEFAULT_PROFILE["avatar_id"])

            row = await conn.fetchrow(
                "SELECT id, name, email, bio, avatar_id, created_at, updated_at FROM users WHERE id = $1",
                user_id,
            )

    result = {
        "name": row["name"],
        "email": row["email"],
        "bio": row["bio"],
        "avatar_id": row["avatar_id"],
        "created_at": _format_timestamp(row["created_at"]),
        "updated_at": _format_timestamp(row["updated_at"]),
    }
    await _cache_set(cache_key, result)
    return result


async def update_profile(data: Dict[str, Any], user_id: int = 1) -> Dict[str, Any]:
    """Update user profile in PostgreSQL within an atomic transaction, invalidating Redis cache."""
    await init_db()
    current = await get_profile(user_id)
    name = data.get("name", current["name"]).strip()
    email = data.get("email", current.get("email"))
    bio = data.get("bio", current.get("bio"))
    avatar_id = data.get("avatar_id", current["avatar_id"])

    pool = await get_db_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            row = await conn.fetchrow("""
                UPDATE users
                SET name = $1,
                    email = $2,
                    bio = $3,
                    avatar_id = $4,
                    updated_at = NOW()
                WHERE id = $5
                RETURNING id, name, email, bio, avatar_id, created_at, updated_at;
            """, name, email, bio, avatar_id, user_id)

    result = {
        "name": row["name"],
        "email": row["email"],
        "bio": row["bio"],
        "avatar_id": row["avatar_id"],
        "created_at": _format_timestamp(row["created_at"]),
        "updated_at": _format_timestamp(row["updated_at"]),
    }
    await _cache_delete(f"user:{user_id}:profile")
    return result


async def get_preferences(user_id: int = 1) -> Dict[str, Any]:
    """Retrieve user preferences and normalized favorite routes from PostgreSQL, with Redis cache read-through."""
    cache_key = f"user:{user_id}:preferences"
    cached = await _cache_get(cache_key)
    if isinstance(cached, dict) and "heat_sensitivity" in cached:
        global _cached_preferences
        _cached_preferences = cached.copy()
        return cached

    await init_db()
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM user_preferences WHERE user_id = $1",
            user_id,
        )
        if not row:
            # Seed defaults
            await conn.execute("""
                INSERT INTO user_preferences (
                    user_id, heat_sensitivity, aqi_sensitivity, avoid_crowds,
                    walking_speed, accessibility, units, theme
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (user_id) DO NOTHING;
            """, user_id, DEFAULT_PREFERENCES["heat_sensitivity"], DEFAULT_PREFERENCES["aqi_sensitivity"],
                 DEFAULT_PREFERENCES["avoid_crowds"], DEFAULT_PREFERENCES["walking_speed"],
                 DEFAULT_PREFERENCES["accessibility"], DEFAULT_PREFERENCES["units"],
                 DEFAULT_PREFERENCES["theme"])
            row = await conn.fetchrow(
                "SELECT * FROM user_preferences WHERE user_id = $1",
                user_id,
            )

        fav_rows = await conn.fetch(
            "SELECT id, name, start_lat, start_lon, end_lat, end_lon, created_at FROM favorite_routes WHERE user_id = $1 ORDER BY created_at DESC",
            user_id,
        )

    fav_routes = [
        {
            "id": r["id"],
            "name": r["name"],
            "start_lat": float(r["start_lat"]),
            "start_lon": float(r["start_lon"]),
            "end_lat": float(r["end_lat"]),
            "end_lon": float(r["end_lon"]),
            "created_at": _format_timestamp(r["created_at"]),
        }
        for r in fav_rows
    ]

    result = {
        "heat_sensitivity": row["heat_sensitivity"],
        "aqi_sensitivity": row["aqi_sensitivity"],
        "avoid_crowds": bool(row["avoid_crowds"]),
        "walking_speed": row["walking_speed"],
        "accessibility": row["accessibility"],
        "units": row["units"],
        "theme": row["theme"],
        "favorite_routes": fav_routes,
        "updated_at": _format_timestamp(row["updated_at"]),
    }

    _cached_preferences = result.copy()
    await _cache_set(cache_key, result)

    return result


async def update_preferences(data: Dict[str, Any], user_id: int = 1) -> Dict[str, Any]:
    """Update user preferences and normalized favorite routes in PostgreSQL within an atomic transaction, invalidating Redis cache."""
    await init_db()
    current = await get_preferences(user_id)

    heat_sensitivity = int(data.get("heat_sensitivity", current["heat_sensitivity"]))
    aqi_sensitivity = int(data.get("aqi_sensitivity", current["aqi_sensitivity"]))
    avoid_crowds = bool(data.get("avoid_crowds", current["avoid_crowds"]))
    walking_speed = str(data.get("walking_speed", current["walking_speed"]))
    accessibility = str(data.get("accessibility", current["accessibility"]))
    units = str(data.get("units", current["units"]))
    theme = str(data.get("theme", current["theme"]))

    fav_routes: List[Dict[str, Any]] = data.get("favorite_routes", current["favorite_routes"])
    if not isinstance(fav_routes, list):
        fav_routes = []

    pool = await get_db_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            # Update user_preferences row
            await conn.execute("""
                UPDATE user_preferences
                SET heat_sensitivity = $1,
                    aqi_sensitivity = $2,
                    avoid_crowds = $3,
                    walking_speed = $4,
                    accessibility = $5,
                    units = $6,
                    theme = $7,
                    updated_at = NOW()
                WHERE user_id = $8;
            """, heat_sensitivity, aqi_sensitivity, avoid_crowds,
                 walking_speed, accessibility, units, theme, user_id)

            # Sync favorite routes: delete old and re-insert updated list
            await conn.execute("DELETE FROM favorite_routes WHERE user_id = $1;", user_id)
            for fav in fav_routes:
                route_id = str(fav.get("id") or f"fav_{int(datetime.now(timezone.utc).timestamp()*1000)}")
                name = str(fav.get("name", "Saved Route"))
                start_lat = float(fav.get("start_lat", 0.0))
                start_lon = float(fav.get("start_lon", 0.0))
                end_lat = float(fav.get("end_lat", 0.0))
                end_lon = float(fav.get("end_lon", 0.0))

                await conn.execute("""
                    INSERT INTO favorite_routes (id, user_id, name, start_lat, start_lon, end_lat, end_lon, created_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
                    ON CONFLICT (id) DO UPDATE
                    SET name = EXCLUDED.name,
                        start_lat = EXCLUDED.start_lat,
                        start_lon = EXCLUDED.start_lon,
                        end_lat = EXCLUDED.end_lat,
                        end_lon = EXCLUDED.end_lon;
                """, route_id, user_id, name, start_lat, start_lon, end_lat, end_lon)

    # Invalidate Redis cache immediately
    await _cache_delete(f"user:{user_id}:preferences")

    return await get_preferences(user_id)
