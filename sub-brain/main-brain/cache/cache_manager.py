"""
Cache Manager — LRU 缓存层
Embedding 结果缓存、LLM 响应缓存、记忆查询缓存
"""

import hashlib
import json
import time
from collections import OrderedDict
from typing import Any, Dict, Generic, Optional, TypeVar

T = TypeVar("T")


class LRUCache(Generic[T]):
    """线程安全的 LRU 缓存（基于 OrderedDict）"""

    def __init__(self, max_size: int = 1000, default_ttl_sec: Optional[int] = None):
        self.max_size = max_size
        self.default_ttl = default_ttl_sec
        self._cache: OrderedDict[str, Dict[str, Any]] = OrderedDict()

    def _make_key(self, *args: Any, **kwargs: Any) -> str:
        """生成缓存 key"""
        data = json.dumps({"args": args, "kwargs": kwargs}, sort_keys=True, default=str)
        return hashlib.sha256(data.encode()).hexdigest()

    def get(self, key: str) -> Optional[T]:
        if key not in self._cache:
            return None
        entry = self._cache[key]
        if entry.get("expires_at") and time.time() > entry["expires_at"]:
            del self._cache[key]
            return None
        self._cache.move_to_end(key)
        return entry["value"]

    def set(self, key: str, value: T, ttl_sec: Optional[int] = None) -> None:
        ttl = ttl_sec or self.default_ttl
        expires_at = time.time() + ttl if ttl else None
        if key in self._cache:
            self._cache.move_to_end(key)
        self._cache[key] = {"value": value, "expires_at": expires_at}
        while len(self._cache) > self.max_size:
            self._cache.popitem(last=False)

    def delete(self, key: str) -> bool:
        if key in self._cache:
            del self._cache[key]
            return True
        return False

    def clear(self) -> None:
        self._cache.clear()

    def get_stats(self) -> Dict[str, Any]:
        total = len(self._cache)
        expired = sum(1 for e in self._cache.values() if e.get("expires_at") and time.time() > e["expires_at"])
        return {
            "total_entries": total,
            "expired_entries": expired,
            "max_size": self.max_size,
            "default_ttl": self.default_ttl,
        }

    def cached(self, ttl_sec: Optional[int] = None):
        """装饰器：自动缓存函数结果"""
        def decorator(func):
            def wrapper(*args, **kwargs):
                key = self._make_key(func.__name__, *args, **kwargs)
                cached = self.get(key)
                if cached is not None:
                    return cached
                result = func(*args, **kwargs)
                self.set(key, result, ttl_sec)
                return result
            return wrapper
        return decorator


class WeBrainCache:
    """WeBrain 统一缓存入口"""

    def __init__(self):
        self.embedding = LRUCache[Any](max_size=2000, default_ttl_sec=3600)
        self.llm_response = LRUCache[Any](max_size=500, default_ttl_sec=300)
        self.memory_query = LRUCache[Any](max_size=1000, default_ttl_sec=60)
        self.web_fetch = LRUCache[Any](max_size=500, default_ttl_sec=1800)

    def get_stats(self) -> Dict[str, Any]:
        return {
            "embedding": self.embedding.get_stats(),
            "llm_response": self.llm_response.get_stats(),
            "memory_query": self.memory_query.get_stats(),
            "web_fetch": self.web_fetch.get_stats(),
        }


cache = WeBrainCache()
