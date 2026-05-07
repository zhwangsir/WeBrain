"""
Test LLM-driven decision center.
"""
import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock
import json

from main_brain.decision.decision_center import DecisionCenter


@pytest.fixture
def dc():
    memory = MagicMock()
    memory.query = AsyncMock(return_value=[])
    reasoning = MagicMock()
    reasoning.decompose = AsyncMock(return_value=["step A", "step B"])
    return DecisionCenter(memory, reasoning, llm_config={
        "base_url": "http://test/v1",
        "model_id": "test-model",
        "api_key": "sk-test",
    })


class TestDecisionCenter:
    @pytest.mark.asyncio
    async def test_rule_based_plan_fallback(self, dc):
        """When LLM fails, fall back to rule-based plan."""
        plan = await dc._rule_based_plan("deploy app", {"budget": 100})
        assert plan["task"] == "deploy app"
        assert len(plan["steps"]) == 2
        assert plan["steps"][0]["id"] == "step-1"

    def test_weighted_prioritize(self, dc):
        """Weighted scoring works."""
        tasks = [
            {"title": "A", "urgency": 10, "importance": 10, "effort": 1},
            {"title": "B", "urgency": 1, "importance": 1, "effort": 10},
        ]
        ranked = dc._weighted_prioritize(tasks)
        assert ranked[0]["title"] == "A"
        assert ranked[0]["priority_rank"] == 1

    @pytest.mark.asyncio
    async def test_llm_plan_parsing(self, dc):
        """Parse JSON plan from LLM response."""
        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            "choices": [{"message": {"content": """```json
{"goal": "test", "steps": [{"id": "s1", "description": "do it", "priority": 9, "dependencies": [], "estimated_minutes": 5, "risk_level": "low", "risk_reason": "", "required_resources": []}], "overall_risk": "low", "suggested_approach": "just do it"}
```"""}}]
        }
        with pytest.mock.patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(return_value=mock_resp)
            plan = await dc.create_plan("test task", {})
            assert plan["goal"] == "test"
            assert len(plan["steps"]) == 1
            assert plan["steps"][0]["priority"] == 9

    @pytest.mark.asyncio
    async def test_risk_assessment_fallback(self, dc):
        """Risk assessment fallback when LLM fails."""
        result = await dc.assess_risk({"steps": []})
        assert "overall_risk_score" in result
        assert result["go_no_go"] == "caution"
