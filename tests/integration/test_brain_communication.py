"""Integration tests for Main Brain ↔ Sub Brain communication."""

import asyncio
import json

import httpx
import pytest

MAIN_BRAIN_URL = "http://localhost:18790"
SUB_BRAIN_URL = "http://localhost:9797"


class TestBrainCommunication:
    @pytest.mark.asyncio
    async def test_health_check(self):
        async with httpx.AsyncClient() as client:
            # Main brain health
            r1 = await client.get(f"{MAIN_BRAIN_URL}/health")
            assert r1.status_code == 200
            assert r1.json()["status"] == "ok"

            # Sub brain health
            r2 = await client.get(f"{SUB_BRAIN_URL}/health")
            assert r2.status_code == 200
            assert r2.json()["status"] == "ok"

    @pytest.mark.asyncio
    async def test_memory_flow(self):
        async with httpx.AsyncClient() as client:
            # Store memory via main brain
            store = await client.post(
                f"{MAIN_BRAIN_URL}/memory/store",
                json={"level": "L1", "content": "Integration test", "session_id": "test-session"},
            )
            assert store.status_code == 200

            # Query memory
            query = await client.post(
                f"{MAIN_BRAIN_URL}/memory/query",
                json={"query": "Integration", "levels": ["L1"]},
            )
            assert query.status_code == 200
            assert len(query.json()["results"]) > 0

    @pytest.mark.asyncio
    async def test_tool_execution(self):
        async with httpx.AsyncClient() as client:
            # Execute tool via sub brain
            r = await client.post(
                f"{SUB_BRAIN_URL}/tools/execute",
                json={"tool": "shell", "params": {"command": "echo hello"}},
            )
            assert r.status_code == 200
            assert r.json()["ok"] is True

    @pytest.mark.asyncio
    async def test_end_to_end(self):
        async with httpx.AsyncClient() as client:
            # 1. Main brain analyzes a problem
            analysis = await client.post(
                f"{MAIN_BRAIN_URL}/reasoning/analyze",
                json={"problem": "Write a hello world program", "context": {}},
            )
            assert analysis.status_code == 200

            # 2. Main brain creates a plan
            plan = await client.post(
                f"{MAIN_BRAIN_URL}/decision/plan",
                json={"task": "Write a hello world program", "constraints": {}},
            )
            assert plan.status_code == 200

            # 3. Sub brain executes the first step
            steps = plan.json()["steps"]
            if steps:
                exec_result = await client.post(
                    f"{SUB_BRAIN_URL}/tools/execute",
                    json={"tool": "file_write", "params": {"path": "/tmp/hello.py", "content": "print('hello world')"}},
                )
                assert exec_result.status_code == 200
