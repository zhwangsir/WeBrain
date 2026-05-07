"""
Dreaming Engine — Memory Consolidation (L1→L2→L3→L4)

Simulates sleep phases to consolidate memories:
- Light Sleep: L1 → L2 (session summaries)
- REM Sleep: L2 → L3 (entity/fact extraction)
- Deep Sleep: L3 → L4 (skill pattern extraction)
"""

import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger("webrain.dreaming")


class DreamingEngine:
    """Consolidates memories across L1-L4 hierarchies using LLM."""

    def __init__(self, memory_manager: Any, llm_config: Optional[Dict] = None):
        self.memory = memory_manager
        self.llm_config = llm_config or {
            "base_url": "http://192.168.71.100:1234/v1",
            "model_id": "minimax/minimax-m2.7",
        }

    async def _llm_call(self, messages: List[Dict], max_tokens: int = 1024) -> str:
        """Call LLM with multi-endpoint fallback."""
        endpoints = self.llm_config.get("endpoints", [{
            "base_url": self.llm_config.get("base_url", "http://192.168.71.100:1234/v1"),
            "model_id": self.llm_config.get("model_id", "minimax/minimax-m2.7"),
            "api_key": self.llm_config.get("api_key"),
        }])

        last_error = None
        for ep in endpoints:
            base_url = ep.get("base_url", ep.get("baseUrl", "")).rstrip("/")
            model_id = ep.get("model_id", ep.get("modelId", "default"))
            api_key = ep.get("api_key", ep.get("apiKey"))

            try:
                async with httpx.AsyncClient(timeout=120.0) as client:
                    resp = await client.post(
                        f"{base_url}/chat/completions",
                        json={
                            "model": model_id,
                            "messages": messages,
                            "temperature": 0.3,
                            "max_tokens": max_tokens,
                        },
                        headers={"Content-Type": "application/json", **({"Authorization": f"Bearer {api_key}"} if api_key else {})},
                    )
                    resp.raise_for_status()
                    return resp.json()["choices"][0]["message"]["content"]
            except Exception as e:
                last_error = e
                logger.warning(f"Dreaming LLM call failed for {base_url}: {e}")
                continue

        logger.error(f"All LLM endpoints failed for dreaming: {last_error}")
        return ""

    # ========== Phase 1: Light Sleep (L1 → L2) ==========
    async def consolidate_l1_to_l2(self, hours: int = 24) -> Dict[str, Any]:
        """Summarize recent L1 session memories into L2."""
        since = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()

        # Get recent L1 memories
        conn = self.memory._connect()
        try:
            rows = conn.execute(
                "SELECT * FROM memories WHERE level = 'L1' AND created_at > ? ORDER BY created_at",
                (since,),
            ).fetchall()
        finally:
            conn.close()

        if not rows:
            return {"consolidated": 0, "message": "No L1 memories to consolidate"}

        # Group by session
        sessions: Dict[str, List[str]] = {}
        for row in rows:
            sid = row["session_id"] or "default"
            if sid not in sessions:
                sessions[sid] = []
            sessions[sid].append(row["content"])

        consolidated = 0
        for session_id, messages in sessions.items():
            if len(messages) < 3:
                continue

            text = "\n".join(messages[-20:])  # Last 20 messages
            prompt = f"""Summarize the following conversation into key points and insights.
Keep important facts, decisions, and action items.

Conversation:
{text}

Summary:"""

            summary = await self._llm_call([
                {"role": "system", "content": "You are a memory consolidation expert. Create concise, factual summaries."},
                {"role": "user", "content": prompt},
            ], max_tokens=512)

            if summary:
                await self.memory.store({
                    "level": "L2",
                    "content": f"[Session {session_id[:8]}] {summary}",
                    "source": "dreaming_l1_to_l2",
                    "session_id": session_id,
                })
                consolidated += 1

        logger.info(f"[Dreaming] L1→L2: {consolidated} sessions consolidated")
        return {"consolidated": consolidated, "sessions": len(sessions)}

    # ========== Phase 2: REM Sleep (L2 → L3) ==========
    async def consolidate_l2_to_l3(self, limit: int = 50) -> Dict[str, Any]:
        """Extract entities and facts from L2 memories into L3."""
        # Get unprocessed L2 memories
        conn = self.memory._connect()
        try:
            rows = conn.execute(
                "SELECT * FROM memories WHERE level = 'L2' ORDER BY created_at DESC LIMIT ?",
                (limit,),
            ).fetchall()
        finally:
            conn.close()

        if not rows:
            return {"extracted": 0, "message": "No L2 memories to process"}

        total_extracted = 0
        for row in rows:
            result = await self.memory.extract_semantic(row["content"])
            total_extracted += result.get("extracted", 0)

        logger.info(f"[Dreaming] L2→L3: {total_extracted} entities/facts extracted")
        return {"extracted": total_extracted}

    # ========== Phase 3: Deep Sleep (L3 → L4) ==========
    async def consolidate_l3_to_l4(self, min_mentions: int = 3) -> Dict[str, Any]:
        """Generate skill patterns from frequently mentioned entities/facts."""
        conn = self.memory._connect()
        try:
            # Find frequently mentioned entities
            rows = conn.execute(
                "SELECT name, type, description, mention_count FROM entities WHERE mention_count >= ?",
                (min_mentions,),
            ).fetchall()

            # Get recent facts
            fact_rows = conn.execute(
                "SELECT predicate, object_value, COUNT(*) as cnt FROM facts GROUP BY predicate, object_value HAVING cnt >= ?",
                (min_mentions,),
            ).fetchall()
        finally:
            conn.close()

        if not rows and not fact_rows:
            return {"skills_created": 0, "message": "No patterns found for skill extraction"}

        # Build context for skill generation
        entity_text = "\n".join([f"- {r['name']} ({r['type']}): {r['description'] or 'N/A'} [mentions: {r['mention_count']}]" for r in rows[:20]])
        fact_text = "\n".join([f"- {r['predicate']} → {r['object_value']} [occurrences: {r['cnt']}]" for r in fact_rows[:20]])

        prompt = f"""Based on the following frequently occurring patterns, suggest reusable skills or procedures.
A skill is a reusable pattern that can be applied to similar situations.

Frequent Entities:
{entity_text}

Frequent Patterns:
{fact_text}

Generate skills in JSON format:
{{"skills": [{{"name": "Skill Name", "description": "What it does", "trigger_pattern": "regex or keyword", "template": "step by step procedure"}}]}}"""

        response = await self._llm_call([
            {"role": "system", "content": "You are a pattern recognition expert. Identify reusable skills from frequent patterns."},
            {"role": "user", "content": prompt},
        ], max_tokens=1024)

        skills_created = 0
        if response:
            try:
                # Extract JSON
                json_str = response
                if "```json" in response:
                    json_str = response.split("```json")[1].split("```")[0].strip()
                elif "```" in response:
                    json_str = response.split("```")[1].split("```")[0].strip()

                parsed = json.loads(json_str)
                skills = parsed.get("skills", [])

                for skill in skills:
                    conn = self.memory._connect()
                    try:
                        conn.execute(
                            "INSERT OR IGNORE INTO skills (id, name, description, trigger_pattern, template, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                            (
                                f"skill-{datetime.now(timezone.utc).timestamp()}-{skills_created}",
                                skill.get("name", "Unnamed"),
                                skill.get("description", ""),
                                skill.get("trigger_pattern", ""),
                                skill.get("template", ""),
                                datetime.now(timezone.utc).isoformat(),
                            ),
                        )
                        conn.commit()
                        skills_created += 1
                    finally:
                        conn.close()
            except Exception as e:
                logger.warning(f"Failed to parse skills from LLM: {e}")

        logger.info(f"[Dreaming] L3→L4: {skills_created} skills created")
        return {"skills_created": skills_created}

    # ========== Full Cycle ==========
    async def run_cycle(self) -> Dict[str, Any]:
        """Run full dreaming consolidation cycle."""
        logger.info("[Dreaming] Starting consolidation cycle...")

        phase1 = await self.consolidate_l1_to_l2()
        phase2 = await self.consolidate_l2_to_l3()
        phase3 = await self.consolidate_l3_to_l4()

        result = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "phases": {
                "light_sleep": phase1,
                "rem_sleep": phase2,
                "deep_sleep": phase3,
            },
        }

        logger.info(f"[Dreaming] Cycle complete: L1→L2={phase1.get('consolidated', 0)}, L2→L3={phase2.get('extracted', 0)}, L3→L4={phase3.get('skills_created', 0)}")
        return result
