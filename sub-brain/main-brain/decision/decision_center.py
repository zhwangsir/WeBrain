"""
WeBrain Decision Center — LLM-driven task planning and prioritization.

Features:
- LLM-powered problem decomposition
- Dynamic risk assessment
- Resource allocation
- Dependency resolution
- Execution scheduling
"""

import json
import logging
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger("webrain.decision")


class DecisionCenter:
    """Central decision-making system powered by LLM."""

    def __init__(self, memory_manager: Any, reasoning_engine: Any, llm_config: Optional[Dict] = None):
        self.memory = memory_manager
        self.reasoning = reasoning_engine
        self.llm_config = llm_config or {}

    def _get_llm_endpoint(self) -> Dict[str, str]:
        """Resolve LLM endpoint from config."""
        endpoints = self.llm_config.get("endpoints", [])
        if endpoints:
            ep = endpoints[0]
            return {
                "url": ep.get("base_url", ep.get("baseUrl", "")).rstrip("/") + "/chat/completions",
                "model": ep.get("model_id", ep.get("modelId", "unknown")),
                "api_key": ep.get("api_key", ep.get("apiKey", "")),
            }
        return {
            "url": self.llm_config.get("base_url", "http://localhost:1234/v1").rstrip("/") + "/chat/completions",
            "model": self.llm_config.get("model_id", "default"),
            "api_key": self.llm_config.get("api_key", ""),
        }

    async def _llm_chat(self, system: str, user: str, temperature: float = 0.3) -> str:
        """Call LLM with system + user prompt."""
        ep = self._get_llm_endpoint()
        headers = {"Content-Type": "application/json"}
        if ep["api_key"]:
            headers["Authorization"] = f"Bearer {ep['api_key']}"

        payload = {
            "model": ep["model"],
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": temperature,
            "max_tokens": 2048,
        }

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(ep["url"], json=payload, headers=headers)
                resp.raise_for_status()
                data = resp.json()
                return data["choices"][0]["message"].get("content", "")
        except Exception as e:
            logger.warning(f"[decision] LLM call failed: {e}")
            return ""

    async def create_plan(self, task: str, constraints: Dict[str, Any]) -> Dict[str, Any]:
        """Create an execution plan for a task using LLM decomposition."""
        # Retrieve relevant context from memory
        try:
            relevant = await self.memory.query({"query": task, "levels": ["L2", "L3", "L4"], "limit": 5})
            context = "\n".join([f"- {m.get('content', '')}" for m in relevant]) or "无相关历史记忆"
        except Exception:
            context = "无相关历史记忆"

        system_prompt = """你是一个任务规划专家。请将用户的目标分解为可执行的步骤，并评估每个步骤的风险和依赖关系。

你必须以 JSON 格式输出，格式如下：
{
  "goal": "任务目标",
  "steps": [
    {
      "id": "step-1",
      "description": "步骤描述",
      "priority": 8,
      "dependencies": [],
      "estimated_minutes": 10,
      "risk_level": "low|medium|high",
      "risk_reason": "风险说明",
      "required_resources": ["资源1", "资源2"]
    }
  ],
  "overall_risk": "low|medium|high",
  "suggested_approach": "建议的执行策略"
}"""

        user_prompt = f"""目标: {task}
约束条件: {json.dumps(constraints, ensure_ascii=False)}
相关背景:
{context}

请分解为具体步骤并输出 JSON。"""

        raw = await self._llm_chat(system_prompt, user_prompt)
        if not raw:
            # Fallback to rule-based plan
            return await self._rule_based_plan(task, constraints)

        # Extract JSON from response
        try:
            # Try to find JSON block
            if "```json" in raw:
                raw = raw.split("```json")[1].split("```")[0].strip()
            elif "```" in raw:
                raw = raw.split("```")[1].split("```")[0].strip()
            plan = json.loads(raw)
            # Normalize
            plan["task"] = task
            plan["estimated_duration"] = sum(s.get("estimated_minutes", 5) for s in plan.get("steps", []))
            return plan
        except Exception as e:
            logger.warning(f"[decision] Failed to parse LLM plan: {e}")
            return await self._rule_based_plan(task, constraints)

    async def prioritize(self, tasks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Prioritize tasks using LLM + constraints analysis."""
        if not tasks:
            return []

        # Build task summary
        task_summary = "\n".join([
            f"任务 {i+1}: {t.get('title', t.get('task', '未命名'))}\n"
            f"  - 紧急度: {t.get('urgency', 5)}/10\n"
            f"  - 重要性: {t.get('importance', 5)}/10\n"
            f"  - 工作量: {t.get('effort', 5)}/10\n"
            f"  - 截止时间: {t.get('deadline', '无')}\n"
            f"  - 描述: {t.get('description', '')}"
            for i, t in enumerate(tasks)
        ])

        system_prompt = """你是一个任务优先级排序专家。请分析所有任务并给出优先级排序。

输出 JSON 格式：
{
  "prioritized": [
    {
      "task_index": 0,
      "priority_rank": 1,
      "priority_score": 8.5,
      "reasoning": "排序理由",
      "recommended_time": "建议执行时段"
    }
  ]
}"""

        raw = await self._llm_chat(system_prompt, f"请排序以下任务:\n{task_summary}")
        if raw:
            try:
                if "```json" in raw:
                    raw = raw.split("```json")[1].split("```")[0].strip()
                elif "```" in raw:
                    raw = raw.split("```")[1].split("```")[0].strip()
                result = json.loads(raw)
                ranked = []
                for item in result.get("prioritized", []):
                    idx = item.get("task_index", 0)
                    if 0 <= idx < len(tasks):
                        ranked.append({
                            **tasks[idx],
                            "priority_rank": item.get("priority_rank", 0),
                            "priority_score": item.get("priority_score", 0.0),
                            "reasoning": item.get("reasoning", ""),
                            "recommended_time": item.get("recommended_time", ""),
                        })
                if ranked:
                    return ranked
            except Exception as e:
                logger.warning(f"[decision] Failed to parse LLM priority: {e}")

        # Fallback to weighted scoring
        return self._weighted_prioritize(tasks)

    async def assess_risk(self, plan: Dict[str, Any]) -> Dict[str, Any]:
        """Assess execution risk of a plan using LLM."""
        system_prompt = """你是一个风险评估专家。请分析执行计划的风险并给出缓解建议。

输出 JSON：
{
  "overall_risk_score": 0.35,
  "risk_factors": [
    {"factor": "风险因素", "probability": "high|medium|low", "impact": "high|medium|low", "mitigation": "缓解措施"}
  ],
  "go_no_go": "go|no-go|caution",
  "recommendations": ["建议1", "建议2"]
}"""

        raw = await self._llm_chat(system_prompt, f"计划:\n{json.dumps(plan, ensure_ascii=False)}")
        if raw:
            try:
                if "```json" in raw:
                    raw = raw.split("```json")[1].split("```")[0].strip()
                elif "```" in raw:
                    raw = raw.split("```")[1].split("```")[0].strip()
                return json.loads(raw)
            except Exception as e:
                logger.warning(f"[decision] Failed to parse risk assessment: {e}")

        return {
            "overall_risk_score": 0.5,
            "risk_factors": [],
            "go_no_go": "caution",
            "recommendations": ["请人工审核计划"],
        }

    # -----------------------------------------------------------------------
    # Fallback methods (rule-based)
    # -----------------------------------------------------------------------

    async def _rule_based_plan(self, task: str, constraints: Dict[str, Any]) -> Dict[str, Any]:
        """Fallback: use reasoning engine decomposition."""
        sub_tasks = await self.reasoning.decompose(task)
        plan = {
            "task": task,
            "goal": task,
            "steps": [],
            "estimated_duration": 0,
            "overall_risk": "medium",
            "suggested_approach": "基于规则分解",
        }
        for i, sub in enumerate(sub_tasks):
            plan["steps"].append({
                "id": f"step-{i+1}",
                "description": sub,
                "priority": self._calculate_priority(sub, constraints),
                "dependencies": [f"step-{j+1}" for j in range(i)] if i > 0 else [],
                "estimated_minutes": 10,
                "risk_level": "medium",
                "risk_reason": "基于规则估计",
                "required_resources": [],
            })
        plan["estimated_duration"] = sum(s["estimated_minutes"] for s in plan["steps"])
        return plan

    def _weighted_prioritize(self, tasks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        scored = []
        for task in tasks:
            urgency = task.get("urgency", 5)
            importance = task.get("importance", 5)
            effort = task.get("effort", 5)
            score = urgency * 0.4 + importance * 0.4 - effort * 0.2
            if task.get("deadline"):
                score += 2
            scored.append({**task, "priority_score": score})
        scored.sort(key=lambda x: x["priority_score"], reverse=True)
        for i, task in enumerate(scored):
            task["priority_rank"] = i + 1
            task["reasoning"] = "基于加权评分规则"
        return scored

    def _calculate_priority(self, task_desc: str, constraints: Dict[str, Any]) -> int:
        base = 5
        lower = task_desc.lower()
        if any(w in lower for w in ["urgent", "critical", "立即", "紧急"]):
            base += 3
        if any(w in lower for w in ["error", "bug", "fix", "修复", "错误"]):
            base += 2
        if any(w in lower for w in ["review", "验证", "检查"]):
            base += 1
        return min(base, 10)
