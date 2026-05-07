"""Tests for ChatEngine."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from chat.chat_engine import ChatEngine


class TestChatEngine:
    """Unit tests for ChatEngine."""

    @pytest.fixture
    def mock_memory(self):
        mm = MagicMock()
        mm.query = AsyncMock(return_value=[])
        mm.store = AsyncMock(return_value={"id": "m1"})
        return mm

    @pytest.fixture
    def mock_subbrain(self):
        sb = MagicMock()
        sb.execute_tool = AsyncMock(return_value="tool result")
        return sb

    @pytest.fixture
    def chat(self, mock_memory, mock_subbrain, mock_llm_config):
        return ChatEngine(
            memory_manager=mock_memory,
            sub_brain_client=mock_subbrain,
            llm_config=mock_llm_config,
        )

    @pytest.mark.asyncio
    async def test_chat_no_tools(self, chat, mock_llm_response):
        """Simple chat without tool calls."""
        resp = {
            "choices": [{
                "message": {"role": "assistant", "content": "Hello!"},
                "finish_reason": "stop",
            }]
        }

        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
            mock_post.return_value.raise_for_status = MagicMock()
            mock_post.return_value.json = MagicMock(return_value=resp)
            result = await chat.chat("Hi", "sess-1")

        assert result["reply"] == "Hello!"
        assert result["iterations"] == 1

    @pytest.mark.asyncio
    async def test_chat_with_tool_call(self, chat):
        """Chat with a single tool call."""
        tool_resp = {
            "choices": [{
                "message": {
                    "role": "assistant",
                    "content": None,
                    "tool_calls": [{
                        "id": "call-1",
                        "type": "function",
                        "function": {"name": "test_tool", "arguments": "{}"},
                    }],
                },
                "finish_reason": "tool_calls",
            }]
        }
        final_resp = {
            "choices": [{
                "message": {"role": "assistant", "content": "Done!"},
                "finish_reason": "stop",
            }]
        }

        call_count = [0]
        async def mock_post(*args, **kwargs):
            call_count[0] += 1
            class MockResp:
                def raise_for_status(self): pass
                def json(self):
                    return tool_resp if call_count[0] == 1 else final_resp
            return MockResp()

        with patch("httpx.AsyncClient.post", mock_post):
            result = await chat.chat("Do something", "sess-1")

        assert result["reply"] == "Done!"
        assert result["iterations"] == 2
        assert len(result["tool_calls"]) == 1

    @pytest.mark.asyncio
    async def test_chat_max_iterations(self, chat):
        """Should stop after MAX_TOOL_ITERATIONS."""
        # Always return tool_calls
        tool_resp = {
            "choices": [{
                "message": {
                    "role": "assistant",
                    "content": None,
                    "tool_calls": [{
                        "id": "call-1",
                        "type": "function",
                        "function": {"name": "test_tool", "arguments": "{}"},
                    }],
                },
                "finish_reason": "tool_calls",
            }]
        }

        async def mock_post(*args, **kwargs):
            class MockResp:
                def raise_for_status(self): pass
                def json(self): return tool_resp
            return MockResp()

        with patch("httpx.AsyncClient.post", mock_post):
            result = await chat.chat("Infinite loop test", "sess-1")

        assert result["iterations"] == 10  # MAX_TOOL_ITERATIONS
        assert "过多" in result["reply"] or "simplify" in result["reply"].lower()

    @pytest.mark.asyncio
    async def test_chat_stream(self, chat):
        """Streaming should yield content chunks."""
        chunks = []
        # Mock stream response
        async def mock_stream(*args, **kwargs):
            yield {"type": "content", "data": "Hello"}
            yield {"type": "content", "data": " world"}
            yield {"type": "done"}

        with patch.object(chat, "_chat_completion_stream", mock_stream):
            async for chunk in chat.chat_stream("Hi", "sess-1"):
                chunks.append(chunk)

        assert len(chunks) == 3
        assert chunks[0]["data"] == "Hello"
        assert chunks[1]["data"] == " world"
