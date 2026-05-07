"""
WeBrain Knowledge Graph — 实体-关系-实体图
基于 NetworkX 的内存图 + SQLite 持久化
支持: 实体提取、关系推理、图查询、路径发现
"""

import json
import logging
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

logger = logging.getLogger("webrain.kg")


class KnowledgeGraph:
    """Entity-Relation-Entity knowledge graph with NetworkX backend."""

    def __init__(self, db_path: Optional[str] = None, llm_config: Optional[Dict[str, Any]] = None):
        self.db_path = db_path or str(Path.home() / ".webrain" / "knowledge_graph.db")
        self.llm_config = llm_config or {}
        self._init_db()
        self._load_from_db()

    def _init_db(self) -> None:
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(self.db_path)
        conn.execute("PRAGMA foreign_keys = ON")

        conn.execute("""
            CREATE TABLE IF NOT EXISTS kg_entities (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                type TEXT NOT NULL DEFAULT 'unknown',
                description TEXT,
                properties TEXT,
                source TEXT,
                confidence REAL DEFAULT 1.0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)

        conn.execute("""
            CREATE TABLE IF NOT EXISTS kg_relations (
                id TEXT PRIMARY KEY,
                source_id TEXT NOT NULL,
                target_id TEXT NOT NULL,
                relation_type TEXT NOT NULL,
                properties TEXT,
                confidence REAL DEFAULT 1.0,
                created_at TEXT NOT NULL,
                FOREIGN KEY (source_id) REFERENCES kg_entities(id) ON DELETE CASCADE,
                FOREIGN KEY (target_id) REFERENCES kg_entities(id) ON DELETE CASCADE
            )
        """)

        conn.execute("CREATE INDEX IF NOT EXISTS idx_kg_rel_src ON kg_relations(source_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_kg_rel_tgt ON kg_relations(target_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_kg_rel_type ON kg_relations(relation_type)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_kg_entity_type ON kg_entities(type)")
        conn.commit()
        conn.close()

    def _load_from_db(self) -> None:
        """Load entities and relations into memory structures."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row

        self._entities: Dict[str, Dict[str, Any]] = {}
        self._relations: Dict[str, Dict[str, Any]] = {}
        self._adj_out: Dict[str, Set[str]] = {}  # entity_id -> set of relation_ids
        self._adj_in: Dict[str, Set[str]] = {}   # entity_id -> set of relation_ids

        for row in conn.execute("SELECT * FROM kg_entities").fetchall():
            eid = row["id"]
            self._entities[eid] = {
                "id": eid,
                "name": row["name"],
                "type": row["type"],
                "description": row["description"] or "",
                "properties": json.loads(row["properties"] or "{}"),
                "source": row["source"] or "",
                "confidence": row["confidence"],
            }
            self._adj_out[eid] = set()
            self._adj_in[eid] = set()

        for row in conn.execute("SELECT * FROM kg_relations").fetchall():
            rid = row["id"]
            src = row["source_id"]
            tgt = row["target_id"]
            self._relations[rid] = {
                "id": rid,
                "source": src,
                "target": tgt,
                "type": row["relation_type"],
                "properties": json.loads(row["properties"] or "{}"),
                "confidence": row["confidence"],
            }
            if src in self._adj_out:
                self._adj_out[src].add(rid)
            if tgt in self._adj_in:
                self._adj_in[tgt].add(rid)

        conn.close()
        logger.info(f"KnowledgeGraph loaded: {len(self._entities)} entities, {len(self._relations)} relations")

    # ─── Entity CRUD ─────────────────────────────────────────────────

    def add_entity(self, name: str, entity_type: str = "unknown", description: str = "",
                   properties: Optional[Dict[str, Any]] = None, source: str = "",
                   confidence: float = 1.0) -> str:
        """Add an entity to the graph. Returns entity ID."""
        eid = self._slugify(name)
        now = datetime.now(timezone.utc).isoformat()
        props = json.dumps(properties or {}, ensure_ascii=False)

        conn = sqlite3.connect(self.db_path)
        conn.execute(
            """INSERT OR REPLACE INTO kg_entities
               (id, name, type, description, properties, source, confidence, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (eid, name, entity_type, description, props, source, confidence, now, now),
        )
        conn.commit()
        conn.close()

        self._entities[eid] = {
            "id": eid, "name": name, "type": entity_type,
            "description": description, "properties": properties or {},
            "source": source, "confidence": confidence,
        }
        if eid not in self._adj_out:
            self._adj_out[eid] = set()
        if eid not in self._adj_in:
            self._adj_in[eid] = set()

        return eid

    def get_entity(self, eid: str) -> Optional[Dict[str, Any]]:
        return self._entities.get(eid)

    def find_entity(self, name: str) -> Optional[Dict[str, Any]]:
        """Find entity by name (case-insensitive)."""
        name_lower = name.lower()
        for e in self._entities.values():
            if e["name"].lower() == name_lower:
                return e
        return None

    def list_entities(self, entity_type: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
        results = list(self._entities.values())
        if entity_type:
            results = [e for e in results if e["type"] == entity_type]
        return results[:limit]

    def delete_entity(self, eid: str) -> bool:
        if eid not in self._entities:
            return False
        conn = sqlite3.connect(self.db_path)
        conn.execute("DELETE FROM kg_entities WHERE id = ?", (eid,))
        conn.commit()
        conn.close()
        del self._entities[eid]
        # Cleanup relations
        for rid in list(self._adj_out.get(eid, [])):
            self.delete_relation(rid)
        for rid in list(self._adj_in.get(eid, [])):
            self.delete_relation(rid)
        return True

    # ─── Relation CRUD ───────────────────────────────────────────────

    def add_relation(self, source_id: str, target_id: str, relation_type: str,
                     properties: Optional[Dict[str, Any]] = None, confidence: float = 1.0) -> str:
        """Add a relation between two entities."""
        rid = f"rel-{source_id}-{relation_type}-{target_id}-{datetime.now(timezone.utc).timestamp():.0f}"
        now = datetime.now(timezone.utc).isoformat()
        props = json.dumps(properties or {}, ensure_ascii=False)

        conn = sqlite3.connect(self.db_path)
        conn.execute(
            """INSERT INTO kg_relations
               (id, source_id, target_id, relation_type, properties, confidence, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (rid, source_id, target_id, relation_type, props, confidence, now),
        )
        conn.commit()
        conn.close()

        self._relations[rid] = {
            "id": rid, "source": source_id, "target": target_id,
            "type": relation_type, "properties": properties or {},
            "confidence": confidence,
        }
        if source_id in self._adj_out:
            self._adj_out[source_id].add(rid)
        if target_id in self._adj_in:
            self._adj_in[target_id].add(rid)

        return rid

    def get_relations(self, eid: str, direction: str = "both") -> List[Dict[str, Any]]:
        """Get relations for an entity."""
        rids: Set[str] = set()
        if direction in ("out", "both"):
            rids.update(self._adj_out.get(eid, set()))
        if direction in ("in", "both"):
            rids.update(self._adj_in.get(eid, set()))
        return [self._relations[rid] for rid in rids if rid in self._relations]

    def delete_relation(self, rid: str) -> bool:
        if rid not in self._relations:
            return False
        rel = self._relations[rid]
        conn = sqlite3.connect(self.db_path)
        conn.execute("DELETE FROM kg_relations WHERE id = ?", (rid,))
        conn.commit()
        conn.close()
        del self._relations[rid]
        self._adj_out.get(rel["source"], set()).discard(rid)
        self._adj_in.get(rel["target"], set()).discard(rid)
        return True

    # ─── Graph Queries ───────────────────────────────────────────────

    def get_neighbors(self, eid: str, relation_type: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get neighboring entities."""
        rels = self.get_relations(eid, "both")
        if relation_type:
            rels = [r for r in rels if r["type"] == relation_type]

        neighbors = []
        for rel in rels:
            other_id = rel["target"] if rel["source"] == eid else rel["source"]
            other = self._entities.get(other_id)
            if other:
                neighbors.append({**other, "relation": rel["type"], "direction": "out" if rel["source"] == eid else "in"})
        return neighbors

    def find_path(self, source_id: str, target_id: str, max_depth: int = 5) -> Optional[List[Dict[str, Any]]]:
        """Find shortest path between two entities using BFS."""
        if source_id not in self._entities or target_id not in self._entities:
            return None

        visited = {source_id}
        queue = [(source_id, [])]

        while queue:
            current, path = queue.pop(0)
            if current == target_id:
                return path

            if len(path) >= max_depth:
                continue

            for rid in self._adj_out.get(current, set()):
                rel = self._relations.get(rid)
                if rel and rel["target"] not in visited:
                    visited.add(rel["target"])
                    queue.append((rel["target"], path + [{"entity": self._entities[current], "relation": rel, "next": self._entities[rel["target"]]}]))

        return None

    def search(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Search entities by name or description."""
        query_lower = query.lower()
        scored = []
        for e in self._entities.values():
            score = 0
            if query_lower in e["name"].lower():
                score += 10
            if query_lower in e["description"].lower():
                score += 5
            if query_lower in e["type"].lower():
                score += 3
            if score > 0:
                scored.append((score, e))

        scored.sort(key=lambda x: x[0], reverse=True)
        return [e for _, e in scored[:limit]]

    def get_subgraph(self, center_id: str, depth: int = 2) -> Dict[str, Any]:
        """Extract a subgraph around a center entity."""
        if center_id not in self._entities:
            return {"entities": [], "relations": []}

        visited = {center_id}
        frontier = {center_id}
        all_rels = []

        for _ in range(depth):
            next_frontier = set()
            for eid in frontier:
                for rid in self._adj_out.get(eid, set()) | self._adj_in.get(eid, set()):
                    rel = self._relations.get(rid)
                    if rel:
                        all_rels.append(rel)
                        other = rel["target"] if rel["source"] == eid else rel["source"]
                        if other not in visited:
                            visited.add(other)
                            next_frontier.add(other)
            frontier = next_frontier

        return {
            "entities": [self._entities[eid] for eid in visited if eid in self._entities],
            "relations": all_rels,
        }

    def get_stats(self) -> Dict[str, Any]:
        return {
            "entity_count": len(self._entities),
            "relation_count": len(self._relations),
            "entity_types": list(set(e["type"] for e in self._entities.values())),
            "relation_types": list(set(r["type"] for r in self._relations.values())),
            "avg_confidence": sum(e["confidence"] for e in self._entities.values()) / max(len(self._entities), 1),
        }

    # ─── LLM-powered Extraction ──────────────────────────────────────

    async def extract_from_text(self, text: str) -> Dict[str, Any]:
        """Use LLM to extract entities and relations from text."""
        if not self.llm_config:
            return {"entities": [], "relations": []}

        import httpx

        prompt = f"""从以下文本中提取实体和关系。
以JSON格式返回:
{{
  "entities": [
    {{"name": "实体名", "type": "人/组织/地点/概念/技术/其他", "description": "简短描述"}}
  ],
  "relations": [
    {{"source": "实体A", "target": "实体B", "type": "关系类型"}}
  ]
}}

文本:
{text[:4000]}"""

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(
                    self.llm_config["base_url"].rstrip("/") + "/chat/completions",
                    json={
                        "model": self.llm_config.get("model_id", "default"),
                        "messages": [
                            {"role": "system", "content": "你是一个知识图谱提取专家。请从文本中提取实体和它们之间的关系。"},
                            {"role": "user", "content": prompt},
                        ],
                        "temperature": 0.3,
                        "max_tokens": 2048,
                    },
                    headers={"Content-Type": "application/json"},
                )
                resp.raise_for_status()
                content = resp.json()["choices"][0]["message"]["content"]

                # Extract JSON
                json_str = content
                if "```json" in content:
                    json_str = content.split("```json")[1].split("```")[0].strip()
                elif "```" in content:
                    json_str = content.split("```")[1].split("```")[0].strip()

                data = json.loads(json_str)
                added_entities = []
                added_relations = []

                for ent in data.get("entities", []):
                    eid = self.add_entity(
                        name=ent["name"],
                        entity_type=ent.get("type", "unknown"),
                        description=ent.get("description", ""),
                        source="llm_extraction",
                        confidence=0.8,
                    )
                    added_entities.append(eid)

                for rel in data.get("relations", []):
                    src = self.find_entity(rel["source"])
                    tgt = self.find_entity(rel["target"])
                    if src and tgt:
                        rid = self.add_relation(
                            source_id=src["id"],
                            target_id=tgt["id"],
                            relation_type=rel.get("type", "related_to"),
                            confidence=0.7,
                        )
                        added_relations.append(rid)

                return {"entities": added_entities, "relations": added_relations}

        except Exception as e:
            logger.error(f"LLM extraction failed: {e}")
            return {"entities": [], "relations": [], "error": str(e)}

    # ─── Helpers ─────────────────────────────────────────────────────

    @staticmethod
    def _slugify(text: str) -> str:
        import re
        s = re.sub(r"[^\w\s-]", "", text.lower())
        s = re.sub(r"[-\s]+", "-", s).strip("-")
        return s[:64] or "entity"
