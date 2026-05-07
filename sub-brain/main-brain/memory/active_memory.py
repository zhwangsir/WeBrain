"""
WeBrain Active Memory — 主动记忆系统
LLM 在对话中主动识别重要信息并写入记忆，而非被动等待用户存储
"""

import json
import logging
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger("webrain.active_memory")


class ActiveMemory:
    """
    Active Memory monitors conversations and automatically extracts
    important facts, preferences, and context to store in memory.
    """

    def __init__(self, memory_manager: Any, llm_config: Optional[Dict[str, Any]] = None):
        self.memory = memory_manager
        self.llm_config = llm_config or {}
        self.db_path = str(Path.home() / ".webrain" / "active_memory.db")
        self._init_db()

    def _init_db(self) -> None:
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(self.db_path)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS extraction_rules (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                pattern TEXT,
                prompt_template TEXT,
                target_level TEXT DEFAULT 'L2',
                priority INTEGER DEFAULT 5,
                enabled INTEGER DEFAULT 1,
                created_at TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS extraction_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                rule_id TEXT,
                source_text TEXT,
                extracted_content TEXT,
                target_level TEXT,
                stored INTEGER DEFAULT 0,
                created_at TEXT NOT NULL
            )
        """)
        conn.commit()
        conn.close()
        self._seed_default_rules()

    def _seed_default_rules(self) -> None:
        """Seed default extraction rules."""
        defaults = [
            {
                "id": "rule-preference",
                "name": "用户偏好",
                "pattern": "喜欢|偏好|习惯|总是|从不|讨厌|最爱",
                "prompt_template": "从以下对话中提取用户的偏好、习惯或喜好。只返回关键信息。",
                "target_level": "L3",
                "priority": 8,
            },
            {
                "id": "rule-fact",
                "name": "重要事实",
                "pattern": "是|住在|工作于|毕业于|生日|年龄|电话|邮箱",
                "prompt_template": "从以下对话中提取关于用户的重要事实（个人信息、工作、教育等）。",
                "target_level": "L3",
                "priority": 9,
            },
            {
                "id": "rule-task",
                "name": "待办任务",
                "pattern": "需要|应该|记得|别忘了|待办|任务|截止|期限",
                "prompt_template": "从以下对话中提取用户提到的待办事项、任务或截止日期。",
                "target_level": "L2",
                "priority": 7,
            },
            {
                "id": "rule-goal",
                "name": "目标计划",
                "pattern": "目标|计划|想要|打算|希望|梦想",
                "prompt_template": "从以下对话中提取用户的目标、计划或愿望。",
                "target_level": "L3",
                "priority": 6,
            },
        ]

        conn = sqlite3.connect(self.db_path)
        for rule in defaults:
            conn.execute(
                "INSERT OR IGNORE INTO extraction_rules (id, name, pattern, prompt_template, target_level, priority, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (rule["id"], rule["name"], rule["pattern"], rule["prompt_template"], rule["target_level"], rule["priority"], datetime.now(timezone.utc).isoformat()),
            )
        conn.commit()
        conn.close()

    # ─── Active Extraction ───────────────────────────────────────────

    async def process_conversation(self, session_id: str, messages: List[Dict[str, str]]) -> Dict[str, Any]:
        """
        Process a conversation and extract important information.
        Returns what was extracted and stored.
        """
        # Build conversation text
        conversation_text = "\n".join([
            f"{'用户' if m.get('role') == 'user' else '助手'}: {m.get('content', '')}"
            for m in messages[-10:]  # Last 10 messages
        ])

        # Get enabled rules
        rules = self._get_rules()
        extracted = []

        for rule in rules:
            # Quick pattern match filter
            if rule.get("pattern") and not self._pattern_match(conversation_text, rule["pattern"]):
                continue

            # LLM extraction
            result = await self._extract_with_llm(conversation_text, rule)
            if result:
                extracted.append({"rule": rule, "content": result})

                # Store in memory
                await self._store_extraction(session_id, rule, result, conversation_text)

        return {
            "session_id": session_id,
            "extracted_count": len(extracted),
            "extractions": [
                {
                    "rule_name": e["rule"]["name"],
                    "target_level": e["rule"]["target_level"],
                    "content": e["content"],
                }
                for e in extracted
            ],
        }

    async def _extract_with_llm(self, text: str, rule: Dict[str, Any]) -> Optional[str]:
        """Use LLM to extract information based on a rule."""
        if not self.llm_config:
            return None

        import httpx

        prompt = f"""{rule.get('prompt_template', '提取关键信息')}

对话记录:
{text[:3000]}

请只返回提取到的信息，如果没有找到则返回空字符串。"""

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    self.llm_config["base_url"].rstrip("/") + "/chat/completions",
                    json={
                        "model": self.llm_config.get("model_id", "default"),
                        "messages": [
                            {"role": "system", "content": "你是一个信息提取助手。从对话中提取结构化信息。"},
                            {"role": "user", "content": prompt},
                        ],
                        "temperature": 0.2,
                        "max_tokens": 512,
                    },
                    headers={"Content-Type": "application/json"},
                )
                resp.raise_for_status()
                content = resp.json()["choices"][0]["message"]["content"].strip()
                return content if content and content != "无" and len(content) > 5 else None
        except Exception as e:
            logger.warning(f"Active memory LLM extraction failed: {e}")
            return None

    async def _store_extraction(self, session_id: str, rule: Dict[str, Any], content: str, source_text: str) -> None:
        """Store extracted information in memory manager."""
        # Record in extraction history
        conn = sqlite3.connect(self.db_path)
        conn.execute(
            "INSERT INTO extraction_history (session_id, rule_id, source_text, extracted_content, target_level, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (session_id, rule["id"], source_text[:500], content, rule["target_level"], datetime.now(timezone.utc).isoformat()),
        )
        conn.commit()
        conn.close()

        # Store in memory manager if available
        if self.memory:
            try:
                await self.memory.store({
                    "content": content,
                    "level": rule["target_level"],
                    "session_id": session_id,
                    "source": f"active_memory:{rule['name']}",
                    "tags": ["auto_extracted", rule["id"]],
                })
            except Exception as e:
                logger.warning(f"Failed to store active memory: {e}")

    # ─── Rule Management ─────────────────────────────────────────────

    def _get_rules(self) -> List[Dict[str, Any]]:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            "SELECT * FROM extraction_rules WHERE enabled = 1 ORDER BY priority DESC"
        ).fetchall()
        conn.close()
        return [dict(r) for r in rows]

    def add_rule(self, name: str, pattern: str, prompt_template: str, target_level: str = "L2", priority: int = 5) -> str:
        rule_id = f"rule-{datetime.now(timezone.utc).timestamp():.0f}"
        conn = sqlite3.connect(self.db_path)
        conn.execute(
            "INSERT INTO extraction_rules (id, name, pattern, prompt_template, target_level, priority, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (rule_id, name, pattern, prompt_template, target_level, priority, datetime.now(timezone.utc).isoformat()),
        )
        conn.commit()
        conn.close()
        return rule_id

    def list_rules(self) -> List[Dict[str, Any]]:
        return self._get_rules()

    def delete_rule(self, rule_id: str) -> bool:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.execute("DELETE FROM extraction_rules WHERE id = ?", (rule_id,))
        conn.commit()
        conn.close()
        return cursor.rowcount > 0

    # ─── History ─────────────────────────────────────────────────────

    def get_history(self, session_id: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        if session_id:
            rows = conn.execute(
                "SELECT * FROM extraction_history WHERE session_id = ? ORDER BY created_at DESC LIMIT ?",
                (session_id, limit),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM extraction_history ORDER BY created_at DESC LIMIT ?",
                (limit,),
            ).fetchall()
        conn.close()
        return [dict(r) for r in rows]

    # ─── Helpers ─────────────────────────────────────────────────────

    @staticmethod
    def _pattern_match(text: str, pattern: str) -> bool:
        """Check if any pattern keyword appears in text."""
        keywords = [k.strip() for k in pattern.split("|") if k.strip()]
        text_lower = text.lower()
        return any(kw.lower() in text_lower for kw in keywords)
