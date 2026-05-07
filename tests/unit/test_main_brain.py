"""Unit tests for Main Brain (Hermes) core modules."""

import asyncio
import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../main-brain"))

from memory.memory_manager import MemoryManager
from reasoning.reasoning_engine import ReasoningEngine
from evolution.evolution_engine import EvolutionEngine
from decision.decision_center import DecisionCenter


class TestMemoryManager:
    def setup_method(self):
        self.db_path = tempfile.mktemp(suffix=".db")
        self.memory = MemoryManager(db_path=self.db_path)

    def teardown_method(self):
        if os.path.exists(self.db_path):
            os.remove(self.db_path)

    def test_store_and_query(self):
        async def run():
            result = await self.memory.store({"level": "L1", "content": "Test memory", "session_id": "s1"})
            assert result["stored"] is True

            results = await self.memory.query({"query": "Test", "levels": ["L1"]})
            assert len(results) > 0
        asyncio.run(run())

    def test_compression(self):
        async def run():
            messages = [{"role": "user", "content": f"Message {i}"} for i in range(20)]
            result = await self.memory.compress_context(messages, 10000)
            assert result["compression_ratio"] > 0
            assert len(result["messages"]) < len(messages)
        asyncio.run(run())


class TestReasoningEngine:
    def test_decompose(self):
        async def run():
            mem = MemoryManager(db_path=tempfile.mktemp(suffix=".db"))
            engine = ReasoningEngine(mem)
            tasks = await engine.decompose("Write a Python script to scrape data")
            assert len(tasks) >= 3
        asyncio.run(run())


class TestDecisionCenter:
    def test_prioritize(self):
        async def run():
            mem = MemoryManager(db_path=tempfile.mktemp(suffix=".db"))
            reasoning = ReasoningEngine(mem)
            decision = DecisionCenter(mem, reasoning)
            tasks = [
                {"urgency": 9, "importance": 8, "effort": 3},
                {"urgency": 3, "importance": 5, "effort": 2},
            ]
            result = await decision.prioritize(tasks)
            assert result[0]["priority_score"] > result[1]["priority_score"]
        asyncio.run(run())
