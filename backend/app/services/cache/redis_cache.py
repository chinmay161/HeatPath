"""
Redis cache backend implementation.
Provides async access with connection pooling, namespacing, and graceful error handling.
"""
import json
import logging
from typing import Any, Dict, List, Optional
import redis.asyncio as aioredis
from redis.exceptions import RedisError

from .base import CacheBackend

logger = logging.getLogger(__name__)


class RedisCache(CacheBackend):
    """
    Production-ready Redis cache implementation.
    Operates through connection pooling and handles connection failures gracefully.
    """

    def __init__(
        self,
        redis_url: Optional[str] = None,
        host: str = "localhost",
        port: int = 6379,
        password: Optional[str] = None,
        db: int = 0,
        default_ttl: int = 21600,
        namespace: str = "heatpath",
        client: Optional[aioredis.Redis] = None,
    ):
        self.default_ttl = default_ttl
        self.namespace = namespace

        if client is not None:
            self.client = client
        elif redis_url:
            self.client = aioredis.from_url(
                redis_url,
                max_connections=20,
                socket_timeout=2.0,
                socket_connect_timeout=2.0,
                decode_responses=True,
            )
        else:
            pool = aioredis.ConnectionPool(
                host=host,
                port=port,
                password=password,
                db=db,
                max_connections=20,
                socket_timeout=2.0,
                socket_connect_timeout=2.0,
                decode_responses=True,
            )
            self.client = aioredis.Redis(connection_pool=pool)

    @property
    def name(self) -> str:
        return "redis"

    def _namespaced_key(self, key: str) -> str:
        return f"{self.namespace}:{key}"

    async def get(self, key: str) -> Optional[Any]:
        namespaced = self._namespaced_key(key)
        try:
            raw = await self.client.get(namespaced)
            if raw is None:
                return None
            try:
                return json.loads(raw)
            except (ValueError, TypeError):
                return raw
        except RedisError as e:
            logger.warning("[cache] Redis get failed for key '%s': %s", key, e)
            return None

    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        namespaced = self._namespaced_key(key)
        effective_ttl = ttl if ttl is not None else self.default_ttl
        try:
            payload = json.dumps(value)
            await self.client.set(namespaced, payload, ex=effective_ttl)
            return True
        except RedisError as e:
            logger.warning("[cache] Redis set failed for key '%s': %s", key, e)
            return False

    async def delete(self, key: str) -> bool:
        namespaced = self._namespaced_key(key)
        try:
            await self.client.delete(namespaced)
            return True
        except RedisError as e:
            logger.warning("[cache] Redis delete failed for key '%s': %s", key, e)
            return False

    async def exists(self, key: str) -> bool:
        namespaced = self._namespaced_key(key)
        try:
            count = await self.client.exists(namespaced)
            return count > 0
        except RedisError as e:
            logger.warning("[cache] Redis exists check failed for key '%s': %s", key, e)
            return False

    async def clear(self) -> bool:
        pattern = f"{self.namespace}:*"
        try:
            cursor = 0
            keys_to_delete = []
            while True:
                cursor, keys = await self.client.scan(cursor=cursor, match=pattern, count=100)
                keys_to_delete.extend(keys)
                if cursor == 0:
                    break
            if keys_to_delete:
                await self.client.delete(*keys_to_delete)
            return True
        except RedisError as e:
            logger.warning("[cache] Redis clear failed: %s", e)
            return False

    async def get_many(self, keys: List[str]) -> Dict[str, Any]:
        if not keys:
            return {}
        namespaced_keys = [self._namespaced_key(k) for k in keys]
        try:
            values = await self.client.mget(namespaced_keys)
            results = {}
            for original_key, raw in zip(keys, values):
                if raw is not None:
                    try:
                        results[original_key] = json.loads(raw)
                    except (ValueError, TypeError):
                        results[original_key] = raw
            return results
        except RedisError as e:
            logger.warning("[cache] Redis get_many failed: %s", e)
            return {}

    async def set_many(self, mapping: Dict[str, Any], ttl: Optional[int] = None) -> bool:
        if not mapping:
            return True
        effective_ttl = ttl if ttl is not None else self.default_ttl
        try:
            async with self.client.pipeline(transaction=False) as pipe:
                for key, value in mapping.items():
                    namespaced = self._namespaced_key(key)
                    payload = json.dumps(value)
                    pipe.set(namespaced, payload, ex=effective_ttl)
                await pipe.execute()
            return True
        except RedisError as e:
            logger.warning("[cache] Redis set_many failed: %s", e)
            return False

    async def health_check(self) -> bool:
        try:
            res = await self.client.ping()
            return bool(res)
        except Exception as e:
            logger.debug("[cache] Redis health check failed: %s", e)
            return False

    async def close(self) -> None:
        try:
            await self.client.aclose()
        except Exception as e:
            logger.debug("[cache] Error closing Redis client: %s", e)
