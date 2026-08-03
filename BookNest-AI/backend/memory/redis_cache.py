"""Optional Redis session/cache layer (falls back to in-memory)."""

from typing import Any, Optional

from backend.config import get_settings
from backend.utils.logging import logger

_memory_fallback: dict[str, Any] = {}


class RedisCache:
    def __init__(self) -> None:
        self.settings = get_settings()
        self._client = None
        if self.settings.redis_enabled:
            try:
                import redis.asyncio as redis

                self._client = redis.from_url(self.settings.redis_url, decode_responses=True)
            except Exception as exc:
                logger.warning("Redis unavailable, using memory: %s", exc)

    async def get(self, key: str) -> Optional[str]:
        if self._client:
            try:
                return await self._client.get(key)
            except Exception:
                pass
        return _memory_fallback.get(key)

    async def set(self, key: str, value: str, ttl: int = 3600) -> None:
        if self._client:
            try:
                await self._client.set(key, value, ex=ttl)
                return
            except Exception:
                pass
        _memory_fallback[key] = value

    async def delete(self, key: str) -> None:
        if self._client:
            try:
                await self._client.delete(key)
            except Exception:
                pass
        _memory_fallback.pop(key, None)


_cache: Optional[RedisCache] = None


def get_redis_cache() -> RedisCache:
    global _cache
    if _cache is None:
        _cache = RedisCache()
    return _cache
