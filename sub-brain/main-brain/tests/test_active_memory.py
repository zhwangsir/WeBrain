"""Tests for ActiveMemory engine."""

from unittest.mock import AsyncMock, MagicMock

import pytest

from memory.active_memory import ActiveMemory


class TestActiveMemory:
    """Unit tests for ActiveMemory."""

    @pytest.fixture
    def mock_memory(self):
        """Mock memory manager."""
        mm = MagicMock()
        mm.store = AsyncMock(return_value={"id": "mem-123"})
        mm.get_skills = AsyncMock(return_value=[])
        mm.get_recent = AsyncMock(return_value=[])
        return mm

    @pytest.fixture
    def am(self, temp_dir, mock_memory, mock_llm_config):
        db_path = temp_dir / "test_am.db"
        return ActiveMemory(memory_manager=mock_memory, llm_config=mock_llm_config)

    def test_init_creates_default_rules(self, am):
        rules = am.list_rules()
        rule_names = [r["name"] for r in rules]
        assert "用户偏好" in rule_names
        assert "重要事实" in rule_names
        assert "待办任务" in rule_names
        assert "目标计划" in rule_names

    def test_add_rule(self, am):
        rid = am.add_rule("test_rule", "test|pattern", "Extract test info", "L3", 8)
        assert rid.startswith("rule-")
        rules = am.list_rules()
        assert any(r["id"] == rid for r in rules)

    def test_delete_rule(self, am):
        rid = am.add_rule("to_delete", "x", "y")
        assert am.delete_rule(rid)
        assert not am.delete_rule("nonexistent")

    def test_pattern_match(self, am):
        assert am._pattern_match("我喜欢看电影", "喜欢|偏好|习惯") is True
        assert am._pattern_match("今天天气很好", "喜欢|偏好|习惯") is False

    @pytest.mark.asyncio
    async def test_process_conversation_no_llm(self, am):
        """Without LLM config, should still process but not extract."""
        am_no_llm = ActiveMemory(memory_manager=am.memory, llm_config=None)
        result = await am_no_llm.process_conversation("sess-1", [
            {"role": "user", "content": "我喜欢看电影"},
        ])
        assert result["session_id"] == "sess-1"
        assert result["extracted_count"] == 0

    @pytest.mark.asyncio
    async def test_process_conversation_with_mock_llm(self, am, monkeypatch):
        """With mocked LLM, should extract and store."""
        mock_result = {
            "choices": [{"message": {"content": "提取到：用户喜欢看电影"}}]
        }

        async def mock_post(*args, **kwargs):
            class MockResp:
                def raise_for_status(self): pass
                def json(self): return mock_result
            return MockResp()

        import httpx
        monkeypatch.setattr(httpx.AsyncClient, "post", mock_post)

        result = await am.process_conversation("sess-1", [
            {"role": "user", "content": "我喜欢看电影"},
        ])
        assert result["session_id"] == "sess-1"
        # The LLM mock returns content, so extraction should succeed
        assert "extractions" in result

    def test_get_history(self, am):
        history = am.get_history(limit=10)
        assert isinstance(history, list)
