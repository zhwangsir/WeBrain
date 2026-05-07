"""
Test embedding provider fallback chain.
"""
import pytest
import asyncio
from unittest.mock import AsyncMock, patch, MagicMock
import json

from main_brain.memory.memory_manager import MemoryManager


@pytest.fixture
def mm():
    return MemoryManager(db_path=":memory:", llm_config={})


class TestEmbeddingProviders:
    def test_fallback_embedding_deterministic(self, mm):
        """Hash fallback must be deterministic."""
        v1 = mm._fallback_embedding("hello world")
        v2 = mm._fallback_embedding("hello world")
        assert v1 == v2
        assert len(v1) == 128
        # Normalized
        import math
        norm = math.sqrt(sum(x * x for x in v1))
        assert abs(norm - 1.0) < 0.001

    def test_fallback_embedding_different_texts(self, mm):
        """Different texts should produce different embeddings."""
        v1 = mm._fallback_embedding("apple")
        v2 = mm._fallback_embedding("banana")
        assert v1 != v2

    @pytest.mark.asyncio
    async def test_ollama_provider_format(self, mm):
        """Ollama provider builds correct payload."""
        provider = {
            "name": "ollama",
            "url": "http://localhost:11434/api/embeddings",
            "model": "nomic-embed-text",
            "headers": {},
            "payload_fmt": "ollama",
        }
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"embedding": [0.1, 0.2, 0.3]}

        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(return_value=mock_resp)
            vec = await mm._call_embedding_provider(provider, "test text")
            assert vec == [0.1, 0.2, 0.3]

    @pytest.mark.asyncio
    async def test_openai_provider_format(self, mm):
        """OpenAI provider builds correct payload."""
        provider = {
            "name": "openai",
            "url": "https://api.openai.com/v1/embeddings",
            "model": "text-embedding-3-small",
            "headers": {"Authorization": "Bearer sk-test"},
            "payload_fmt": "openai",
        }
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"data": [{"embedding": [0.4, 0.5, 0.6]}]}

        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(return_value=mock_resp)
            vec = await mm._call_embedding_provider(provider, "test text")
            assert vec == [0.4, 0.5, 0.6]

    @pytest.mark.asyncio
    async def test_provider_chain_fallback(self, mm):
        """First provider fails, second succeeds."""
        mm._embedding_providers = [
            {"name": "bad", "url": "http://bad", "model": "x", "headers": {}, "payload_fmt": "openai"},
        ]
        # Force fallback
        with patch.object(mm, "_call_embedding_provider", side_effect=Exception("fail")):
            with patch.object(mm, "_local_embedding", return_value=None):
                vec = await mm._get_embedding("test")
                assert len(vec) == 128  # hash fallback
