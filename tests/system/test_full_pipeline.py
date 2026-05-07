"""System tests for the complete WeBrain pipeline."""

import asyncio
import subprocess
import time

import httpx
import pytest


class TestFullPipeline:
    def test_services_start(self):
        """Verify both services can start and respond to health checks."""
        # This would be run after docker-compose up
        pass

    @pytest.mark.asyncio
    async def test_conversation_pipeline(self):
        """Test a full conversation: receive → think → act → respond."""
        async with httpx.AsyncClient() as client:
            # Simulate: User sends a message
            user_message = "What's the weather like?"

            # 1. Store in memory (L1)
            await client.post(
                "http://localhost:18790/memory/store",
                json={"level": "L1", "content": user_message, "source": "user"},
            )

            # 2. Main brain reasons about it
            reasoning = await client.post(
                "http://localhost:18790/reasoning/analyze",
                json={"problem": user_message, "context": {}},
            )
            assert reasoning.status_code == 200

            # 3. Main brain decides to use a tool
            plan = await client.post(
                "http://localhost:18790/decision/plan",
                json={"task": "Get weather information", "constraints": {}},
            )
            assert plan.status_code == 200

            # 4. Sub brain executes the tool
            tool_result = await client.post(
                "http://localhost:9797/tools/execute",
                json={"tool": "http_request", "params": {"url": "https://wttr.in/?format=3", "method": "GET"}},
            )
            assert tool_result.status_code == 200

            # 5. Store result in memory (L2)
            await client.post(
                "http://localhost:18790/memory/store",
                json={"level": "L2", "content": f"User asked about weather. Result: {tool_result.json()}", "source": "assistant"},
            )

            # 6. Evolution runs
            evolution = await client.post(
                "http://localhost:18790/evolution/run",
                json={"agent_id": "default", "focus_area": "weather_queries"},
            )
            assert evolution.status_code == 200

    @pytest.mark.asyncio
    async def test_dokobot_integration(self):
        """Test Dokobot browser automation."""
        async with httpx.AsyncClient() as client:
            result = await client.post(
                "http://localhost:9797/dokobot/browse",
                json={"url": "https://example.com", "action": "read"},
            )
            assert result.status_code == 200
