"""
Canvas Engine — Agent-editable HTML/CSS/JS surface
Inspired by Claude Artifacts
"""

import json
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional


class CanvasEngine:
    """Manages agent-generated HTML/CSS/JS artifacts."""

    def __init__(self, canvas_dir: Optional[str] = None):
        self.canvas_dir = Path(canvas_dir or Path.home() / ".webrain" / "canvas")
        self.canvas_dir.mkdir(parents=True, exist_ok=True)

    def create(self, title: str, content: str, content_type: str = "html", metadata: Optional[Dict] = None) -> Dict[str, Any]:
        cid = str(uuid.uuid4())[:8]
        artifact = {
            "id": cid,
            "title": title,
            "content": content,
            "type": content_type,
            "metadata": metadata or {},
            "created_at": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
        }
        file_path = self.canvas_dir / f"{cid}.json"
        file_path.write_text(json.dumps(artifact, ensure_ascii=False), encoding="utf-8")
        return artifact

    def get(self, cid: str) -> Optional[Dict[str, Any]]:
        file_path = self.canvas_dir / f"{cid}.json"
        if not file_path.exists():
            return None
        return json.loads(file_path.read_text(encoding="utf-8"))

    def list(self, limit: int = 50) -> List[Dict[str, Any]]:
        artifacts = []
        for f in sorted(self.canvas_dir.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True)[:limit]:
            artifacts.append(json.loads(f.read_text(encoding="utf-8")))
        return artifacts

    def update(self, cid: str, content: str, title: Optional[str] = None) -> Dict[str, Any]:
        artifact = self.get(cid)
        if not artifact:
            raise ValueError(f"Canvas not found: {cid}")
        artifact["content"] = content
        if title:
            artifact["title"] = title
        artifact["updated_at"] = __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat()
        file_path = self.canvas_dir / f"{cid}.json"
        file_path.write_text(json.dumps(artifact, ensure_ascii=False), encoding="utf-8")
        return artifact

    def delete(self, cid: str) -> bool:
        file_path = self.canvas_dir / f"{cid}.json"
        if file_path.exists():
            file_path.unlink()
            return True
        return False
