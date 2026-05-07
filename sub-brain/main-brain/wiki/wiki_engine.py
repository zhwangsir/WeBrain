"""
Memory Wiki Engine — Structured Knowledge Base with Obsidian Integration

Features:
- Markdown note CRUD
- Bidirectional links [[note_name]]
- Tag system #tag
- Obsidian vault import/export
- Full-text search
- Graph view data (nodes + edges)
"""

import re
import json
import logging
import sqlite3
from pathlib import Path
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger("webrain.wiki")


class WikiEngine:
    """Memory Wiki — structured knowledge base engine."""

    def __init__(self, wiki_dir: Optional[str] = None, db_path: Optional[str] = None):
        self.wiki_dir = Path(wiki_dir or Path.home() / ".webrain" / "wiki")
        self.wiki_dir.mkdir(parents=True, exist_ok=True)

        self._db_path = db_path or str(Path.home() / ".webrain" / "wiki.db")
        self._init_db()

    def _init_db(self) -> None:
        conn = sqlite3.connect(self._db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        try:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS wiki_notes (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    content TEXT NOT NULL,
                    tags TEXT DEFAULT '[]',
                    links TEXT DEFAULT '[]',
                    backlinks TEXT DEFAULT '[]',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    word_count INTEGER DEFAULT 0
                )
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_wiki_title ON wiki_notes(title)")
            conn.execute("CREATE VIRTUAL TABLE IF NOT EXISTS wiki_fts USING fts5(title, content, content='wiki_notes', content_rowid='rowid')")
            conn.execute("""
                CREATE TRIGGER IF NOT EXISTS wiki_fts_insert AFTER INSERT ON wiki_notes BEGIN
                    INSERT INTO wiki_fts(rowid, title, content) VALUES (new.rowid, new.title, new.content);
                END
            """)
            conn.execute("""
                CREATE TRIGGER IF NOT EXISTS wiki_fts_update AFTER UPDATE ON wiki_notes BEGIN
                    INSERT INTO wiki_fts(wiki_fts, rowid, title, content) VALUES ('delete', old.rowid, old.title, old.content);
                    INSERT INTO wiki_fts(rowid, title, content) VALUES (new.rowid, new.title, new.content);
                END
            """)
            conn.execute("""
                CREATE TRIGGER IF NOT EXISTS wiki_fts_delete AFTER DELETE ON wiki_notes BEGIN
                    INSERT INTO wiki_fts(wiki_fts, rowid, title, content) VALUES ('delete', old.rowid, old.title, old.content);
                END
            """)
            conn.commit()
        finally:
            conn.close()

    def _connect(self):
        conn = sqlite3.connect(self._db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    # ========== Note CRUD ==========
    def create_note(self, title: str, content: str, note_id: Optional[str] = None) -> Dict[str, Any]:
        note_id = note_id or self._slugify(title)
        now = datetime.now(timezone.utc).isoformat()
        tags = self._extract_tags(content)
        links = self._extract_links(content)
        word_count = len(content.split())

        conn = self._connect()
        try:
            conn.execute(
                "INSERT OR REPLACE INTO wiki_notes (id, title, content, tags, links, created_at, updated_at, word_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (note_id, title, content, json.dumps(tags), json.dumps(links), now, now, word_count),
            )
            conn.commit()
        finally:
            conn.close()

        # Write to filesystem
        self._write_file(note_id, content)

        # Update backlinks
        self._update_backlinks(note_id, links)

        return {"id": note_id, "title": title, "tags": tags, "links": links, "word_count": word_count}

    def get_note(self, note_id: str) -> Optional[Dict[str, Any]]:
        conn = self._connect()
        try:
            row = conn.execute("SELECT * FROM wiki_notes WHERE id = ?", (note_id,)).fetchone()
            if not row:
                return None
            return self._row_to_dict(row)
        finally:
            conn.close()

    def update_note(self, note_id: str, title: Optional[str] = None, content: Optional[str] = None) -> Dict[str, Any]:
        note = self.get_note(note_id)
        if not note:
            raise ValueError(f"Note not found: {note_id}")

        new_title = title if title is not None else note["title"]
        new_content = content if content is not None else note["content"]
        tags = self._extract_tags(new_content)
        links = self._extract_links(new_content)
        word_count = len(new_content.split())
        now = datetime.now(timezone.utc).isoformat()

        conn = self._connect()
        try:
            conn.execute(
                "UPDATE wiki_notes SET title = ?, content = ?, tags = ?, links = ?, updated_at = ?, word_count = ? WHERE id = ?",
                (new_title, new_content, json.dumps(tags), json.dumps(links), now, word_count, note_id),
            )
            conn.commit()
        finally:
            conn.close()

        self._write_file(note_id, new_content)
        self._update_backlinks(note_id, links)

        return {"id": note_id, "title": new_title, "tags": tags, "links": links, "word_count": word_count}

    def delete_note(self, note_id: str) -> bool:
        conn = self._connect()
        try:
            conn.execute("DELETE FROM wiki_notes WHERE id = ?", (note_id,))
            conn.commit()
        finally:
            conn.close()

        file_path = self.wiki_dir / f"{note_id}.md"
        if file_path.exists():
            file_path.unlink()

        # Remove backlinks
        self._update_backlinks(note_id, [])

        return True

    def list_notes(self, tag: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
        conn = self._connect()
        try:
            if tag:
                rows = conn.execute(
                    "SELECT * FROM wiki_notes WHERE tags LIKE ? ORDER BY updated_at DESC LIMIT ?",
                    (f'%"{tag}"%', limit),
                ).fetchall()
            else:
                rows = conn.execute("SELECT * FROM wiki_notes ORDER BY updated_at DESC LIMIT ?", (limit,)).fetchall()
            return [self._row_to_dict(r) for r in rows]
        finally:
            conn.close()

    def search_notes(self, query: str, limit: int = 20) -> List[Dict[str, Any]]:
        conn = self._connect()
        try:
            rows = conn.execute(
                """SELECT w.* FROM wiki_notes w
                   JOIN wiki_fts fts ON w.rowid = fts.rowid
                   WHERE wiki_fts MATCH ?
                   ORDER BY rank LIMIT ?""",
                (query, limit),
            ).fetchall()
            return [self._row_to_dict(r) for r in rows]
        except Exception as e:
            logger.warning(f"Wiki search failed: {e}")
            return []
        finally:
            conn.close()

    # ========== Graph View ==========
    def get_graph(self) -> Dict[str, Any]:
        """Return nodes and edges for graph visualization."""
        conn = self._connect()
        try:
            rows = conn.execute("SELECT id, title, links, backlinks FROM wiki_notes").fetchall()
        finally:
            conn.close()

        nodes = []
        edges = []
        node_ids = set()

        for row in rows:
            note_id = row["id"]
            title = row["title"]
            links = json.loads(row["links"] or "[]")
            backlinks = json.loads(row["backlinks"] or "[]")

            nodes.append({
                "id": note_id,
                "label": title,
                "link_count": len(links),
                "backlink_count": len(backlinks),
            })
            node_ids.add(note_id)

            for target in links:
                target_id = self._slugify(target)
                if target_id not in node_ids:
                    nodes.append({"id": target_id, "label": target, "link_count": 0, "backlink_count": 0})
                    node_ids.add(target_id)
                edges.append({"source": note_id, "target": target_id})

        return {"nodes": nodes, "edges": edges}

    # ========== Obsidian Import/Export ==========
    def import_obsidian(self, vault_path: str) -> Dict[str, Any]:
        """Import all .md files from an Obsidian vault."""
        vault = Path(vault_path)
        if not vault.exists():
            return {"ok": False, "error": "Vault path does not exist"}

        imported = 0
        skipped = 0

        for md_file in vault.rglob("*.md"):
            # Skip Obsidian system files
            if ".obsidian" in str(md_file):
                continue

            try:
                content = md_file.read_text(encoding="utf-8")
                title = md_file.stem
                note_id = self._slugify(title)
                self.create_note(title, content, note_id)
                imported += 1
            except Exception as e:
                logger.warning(f"Failed to import {md_file}: {e}")
                skipped += 1

        return {"ok": True, "imported": imported, "skipped": skipped}

    def export_obsidian(self, export_path: Optional[str] = None) -> Dict[str, Any]:
        """Export all notes to a directory structure compatible with Obsidian."""
        export_dir = Path(export_path or self.wiki_dir / "export")
        export_dir.mkdir(parents=True, exist_ok=True)

        notes = self.list_notes(limit=10000)
        exported = 0

        for note in notes:
            file_path = export_dir / f"{note['id']}.md"
            try:
                file_path.write_text(note["content"], encoding="utf-8")
                exported += 1
            except Exception as e:
                logger.warning(f"Failed to export {note['id']}: {e}")

        return {"ok": True, "export_dir": str(export_dir), "exported": exported}

    # ========== Stats ==========
    def get_stats(self) -> Dict[str, Any]:
        conn = self._connect()
        try:
            total = conn.execute("SELECT COUNT(*) as c FROM wiki_notes").fetchone()["c"]
            total_words = conn.execute("SELECT COALESCE(SUM(word_count), 0) as c FROM wiki_notes").fetchone()["c"]

            # All tags
            rows = conn.execute("SELECT tags FROM wiki_notes").fetchall()
            all_tags = set()
            for row in rows:
                tags = json.loads(row["tags"] or "[]")
                all_tags.update(tags)

            # All links
            link_rows = conn.execute("SELECT links FROM wiki_notes").fetchall()
            all_links = set()
            for row in link_rows:
                links = json.loads(row["links"] or "[]")
                all_links.update(links)

            return {
                "total_notes": total,
                "total_words": total_words,
                "total_tags": len(all_tags),
                "total_links": len(all_links),
                "tags": sorted(all_tags),
            }
        finally:
            conn.close()

    # ========== Helpers ==========
    def _slugify(self, title: str) -> str:
        """Convert title to URL-safe slug."""
        slug = re.sub(r'[^\w\s-]', '', title.lower())
        slug = re.sub(r'[-\s]+', '-', slug)
        return slug.strip('-')

    def _extract_tags(self, content: str) -> List[str]:
        """Extract #tags from markdown content."""
        tags = re.findall(r'#(\w+)', content)
        return list(set(tags))

    def _extract_links(self, content: str) -> List[str]:
        """Extract [[wiki_links]] from markdown content."""
        links = re.findall(r'\[\[([^\]]+)\]\]', content)
        return list(set(links))

    def _write_file(self, note_id: str, content: str) -> None:
        file_path = self.wiki_dir / f"{note_id}.md"
        file_path.write_text(content, encoding="utf-8")

    def _update_backlinks(self, note_id: str, links: List[str]) -> None:
        """Update backlinks for all linked notes."""
        conn = self._connect()
        try:
            # Clear old backlinks pointing to this note
            rows = conn.execute("SELECT id, backlinks FROM wiki_notes").fetchall()
            for row in rows:
                backlinks = json.loads(row["backlinks"] or "[]")
                if note_id in backlinks:
                    backlinks.remove(note_id)
                    conn.execute(
                        "UPDATE wiki_notes SET backlinks = ? WHERE id = ?",
                        (json.dumps(backlinks), row["id"]),
                    )

            # Set new backlinks
            for link in links:
                target_id = self._slugify(link)
                row = conn.execute("SELECT backlinks FROM wiki_notes WHERE id = ?", (target_id,)).fetchone()
                if row:
                    backlinks = json.loads(row["backlinks"] or "[]")
                    if note_id not in backlinks:
                        backlinks.append(note_id)
                        conn.execute(
                            "UPDATE wiki_notes SET backlinks = ? WHERE id = ?",
                            (json.dumps(backlinks), target_id),
                        )

            conn.commit()
        finally:
            conn.close()

    def _row_to_dict(self, row: sqlite3.Row) -> Dict[str, Any]:
        return {
            "id": row["id"],
            "title": row["title"],
            "content": row["content"],
            "tags": json.loads(row["tags"] or "[]"),
            "links": json.loads(row["links"] or "[]"),
            "backlinks": json.loads(row["backlinks"] or "[]"),
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
            "word_count": row["word_count"],
        }
