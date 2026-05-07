import pytest
import time
from cache.cache_manager import LRUCache, WeBrainCache


class TestLRUCache:
    def test_basic_get_set(self):
        c = LRUCache[str](max_size=3)
        c.set("a", "apple")
        assert c.get("a") == "apple"
        assert c.get("b") is None

    def test_lru_eviction(self):
        c = LRUCache[int](max_size=3)
        c.set("a", 1)
        c.set("b", 2)
        c.set("c", 3)
        c.set("d", 4)  # Should evict 'a'
        assert c.get("a") is None
        assert c.get("b") == 2
        assert c.get("c") == 3
        assert c.get("d") == 4

    def test_ttl_expiration(self):
        c = LRUCache[str](max_size=10, default_ttl_sec=1)
        c.set("x", "value")
        assert c.get("x") == "value"
        time.sleep(1.1)
        assert c.get("x") is None

    def test_delete(self):
        c = LRUCache[str](max_size=10)
        c.set("k", "v")
        assert c.delete("k") is True
        assert c.get("k") is None
        assert c.delete("k") is False

    def test_clear(self):
        c = LRUCache[int](max_size=10)
        c.set("a", 1)
        c.set("b", 2)
        c.clear()
        assert c.get("a") is None
        assert c.get("b") is None

    def test_stats(self):
        c = LRUCache[int](max_size=5, default_ttl_sec=10)
        c.set("a", 1)
        c.set("b", 2)
        stats = c.get_stats()
        assert stats["total_entries"] == 2
        assert stats["max_size"] == 5

    def test_cached_decorator(self):
        c = LRUCache[int](max_size=10)
        call_count = 0

        @c.cached(ttl_sec=60)
        def compute(x):
            nonlocal call_count
            call_count += 1
            return x * 2

        assert compute(5) == 10
        assert compute(5) == 10
        assert call_count == 1  # Second call cached
        assert compute(6) == 12
        assert call_count == 2


class TestWeBrainCache:
    def test_multiple_caches(self):
        wb = WeBrainCache()
        wb.embedding.set("text1", [0.1, 0.2])
        wb.llm_response.set("prompt1", "response1")
        wb.memory_query.set("query1", ["result"])

        assert wb.embedding.get("text1") == [0.1, 0.2]
        assert wb.llm_response.get("prompt1") == "response1"
        assert wb.memory_query.get("query1") == ["result"]

    def test_stats(self):
        wb = WeBrainCache()
        wb.embedding.set("k", "v")
        stats = wb.get_stats()
        assert "embedding" in stats
        assert stats["embedding"]["total_entries"] >= 1
