"""Tests for MemoryManager."""

from unittest.mock import AsyncMock, MagicMock

import pytest

from memory.memory_manager import MemoryManager


class TestMemoryManager:
    """Unit tests for MemoryManager."""

    @pytest.fixture
    def mm(self, temp_dir, mock_llm_config):
        db_path = temp_dir / "test_memory.db"
        return MemoryManager(db_path=str(db_path), llm_config=mock_llm_config)

    @pytest.mark.asyncio
    async def test_store_and_query(self, mm):
        result = await mm.store({
            "content": "Test memory content",
            "level": "L1",
            "session_id": "sess-1",
            "tags": ["test"],
        })
        assert "id" in result

        results = await mm.query({"query": "memory", "limit": 5})
        assert len(results) >= 1
        assert any("memory" in r["content"].lower() for r in results)

    @pytest.mark.asyncio
    async def test_store_auto_extracts_semantic(self, mm, monkeypatch):
        """Storing L1 should auto-extract entities."""
        mock_extract = AsyncMock(return_value={"entities": [{"name": "Alice", "type": "person"}], "facts": []})
        monkeypatch.setattr(mm, "extract_semantic", mock_extract)

        await mm.store({
            "content": "Alice went to the store",
            "level": "L2",
            "session_id": "sess-1",
        })
        mock_extract.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_stats(self, mm):
        stats = await mm.get_stats()
        assert "total" in stats
        assert "by_level" in stats

    @pytest.mark.asyncio
    async def test_get_session_memories(self, mm):
        await mm.store({"content": "A", "level": "L1", "session_id": "sess-abc"})
        await mm.store({"content": "B", "level": "L1", "session_id": "sess-abc"})
        await mm.store({"content": "C", "level": "L1", "session_id": "sess-other"})

        results = await mm.get_session_memories("sess-abc", limit=10)
        assert len(results) == 2
        contents = [r["content"] for r in results]
        assert "A" in contents
        assert "B" in contents

    @pytest.mark.asyncio
    async def test_get_recent(self, mm):
        await mm.store({"content": "Old", "level": "L1", "session_id": "s1"})
        await mm.store({"content": "New", "level": "L1", "session_id": "s2"})

        recent = await mm.get_recent(level="L1", limit=10)
        assert len(recent) >= 2
