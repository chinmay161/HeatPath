"""
Cache factory module.
Manages cache backend instantiation, availability detection, and NoOp fallback.
"""
import asyncio
import logging
from typing import Optional

from app.config import config
from .base import CacheBackend
from .noop import NoOpCache
from .redis_cache import RedisCache

logger = logging.getLogger(__name__)

_instance: Optional[CacheBackend] = None
_lock: Optional[asyncio.Lock] = None


def _get_lock() -> asyncio.Lock:
    global _lock
    if _lock is None:
        _lock = asyncio.Lock()
    return _lock


class CacheFactory:
    """
    Factory creating and managing cache singleton instances.
    """

    @classmethod
    async def create_cache(cls) -> CacheBackend:
        """
        Attempt to initialize a RedisCache instance.
        If Redis is unavailable or unconfigured, falls back to NoOpCache.
        """
        redis_target = config.REDIS_URL or f"{config.REDIS_HOST}:{config.REDIS_PORT}"
        try:
            redis_cache = RedisCache(
                redis_url=config.REDIS_URL or None,
                host=config.REDIS_HOST,
                port=config.REDIS_PORT,
                password=config.REDIS_PASSWORD or None,
                db=config.REDIS_DB,
                default_ttl=config.CACHE_TTL_SECONDS,
                namespace=config.CACHE_NAMESPACE,
            )
            is_healthy = await redis_cache.health_check()
            if is_healthy:
                logger.info("[cache] Successfully connected to Redis cache at %s", redis_target)
                return redis_cache
            else:
                logger.warning(
                    "[cache] Redis cache is unreachable at %s. Falling back to NoOpCache.",
                    redis_target,
                )
                await redis_cache.close()
                return NoOpCache()
        except Exception as e:
            logger.warning(
                "[cache] Failed to initialize Redis at %s (%s). Falling back to NoOpCache.",
                redis_target,
                e,
            )
            return NoOpCache()


async def get_cache(force_refresh: bool = False) -> CacheBackend:
    """
    Retrieve the cache singleton instance.
    Initializes RedisCache if reachable, or NoOpCache if unavailable.
    """
    global _instance
    if _instance is not None and not force_refresh:
        return _instance

    lock = _get_lock()
    async with lock:
        if _instance is not None and not force_refresh:
            return _instance
        _instance = await CacheFactory.create_cache()
        return _instance


def get_cache_sync() -> CacheBackend:
    """
    Synchronous accessor for the cache singleton.
    Returns the initialized instance or an in-memory NoOpCache if not yet initialized.
    """
    global _instance
    if _instance is not None:
        return _instance
    return NoOpCache()


async def reset_cache(new_instance: Optional[CacheBackend] = None) -> None:
    """
    Reset or override the singleton instance (useful for testing).
    """
    global _instance
    if _instance is not None:
        try:
            await _instance.close()
        except Exception:
            pass
    _instance = new_instance
