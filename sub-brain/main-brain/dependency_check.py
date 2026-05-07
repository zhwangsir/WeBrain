"""
WeBrain Dependency Check — Startup health check for external dependencies.
Run on startup to verify all required binaries and Python packages.
"""

import importlib
import shutil
import subprocess
from dataclasses import dataclass
from typing import Dict, List


@dataclass
class DepStatus:
    name: str
    required: bool
    installed: bool
    version: str = ""
    install_hint: str = ""
    degraded_feature: str = ""


class DependencyChecker:
    """Check all external dependencies on startup."""

    CHECKS: List[Dict] = [
        {
            "name": "Python sqlite3",
            "check": lambda: __import__("sqlite3"),
            "required": True,
            "install_hint": "Python built-in, should always be available",
        },
        {
            "name": "httpx",
            "check": lambda: importlib.import_module("httpx"),
            "required": True,
            "install_hint": "pip install httpx",
        },
        {
            "name": "fastapi",
            "check": lambda: importlib.import_module("fastapi"),
            "required": True,
            "install_hint": "pip install fastapi uvicorn",
        },
        {
            "name": "psutil",
            "check": lambda: importlib.import_module("psutil"),
            "required": False,
            "install_hint": "pip install psutil",
            "degraded_feature": "System metrics (CPU/memory/disk) will not be available",
        },
        {
            "name": "croniter",
            "check": lambda: importlib.import_module("croniter"),
            "required": False,
            "install_hint": "pip install croniter",
            "degraded_feature": "Cron job scheduling will not be available",
        },
        {
            "name": "sentence-transformers",
            "check": lambda: importlib.import_module("sentence_transformers"),
            "required": False,
            "install_hint": "pip install sentence-transformers",
            "degraded_feature": "Cross-encoder re-ranking will use fallback; embeddings quality reduced",
        },
        {
            "name": "edge-tts",
            "check": lambda: shutil.which("edge-tts"),
            "required": False,
            "install_hint": "pip install edge-tts",
            "degraded_feature": "Text-to-speech will not be available",
        },
        {
            "name": "playwright",
            "check": lambda: importlib.import_module("playwright"),
            "required": False,
            "install_hint": "pip install playwright && playwright install chromium",
            "degraded_feature": "Browser automation tools will not be available",
        },
        {
            "name": "whisper",
            "check": lambda: shutil.which("whisper"),
            "required": False,
            "install_hint": "pip install openai-whisper",
            "degraded_feature": "Speech-to-text will not be available",
        },
    ]

    def run(self) -> List[DepStatus]:
        results = []
        for check in self.CHECKS:
            try:
                result = check["check"]()
                installed = result is not None
                version = ""
                if hasattr(result, "__version__"):
                    version = result.__version__
            except Exception:
                installed = False
                version = ""

            results.append(DepStatus(
                name=check["name"],
                required=check["required"],
                installed=installed,
                version=version,
                install_hint=check.get("install_hint", ""),
                degraded_feature=check.get("degraded_feature", ""),
            ))
        return results

    def report(self) -> Dict[str, any]:
        results = self.run()
        missing_required = [r for r in results if r.required and not r.installed]
        missing_optional = [r for r in results if not r.required and not r.installed]

        report_lines = ["=" * 50, "WeBrain Dependency Check", "=" * 50]
        all_ok = True

        for r in results:
            status = "✅" if r.installed else "❌"
            req = "(required)" if r.required else "(optional)"
            report_lines.append(f"{status} {r.name} {req}")
            if not r.installed:
                all_ok = False
                report_lines.append(f"   Install: {r.install_hint}")
                if r.degraded_feature:
                    report_lines.append(f"   Impact: {r.degraded_feature}")

        if missing_required:
            report_lines.append("\n⚠️  CRITICAL: Missing required dependencies!")
        elif missing_optional:
            report_lines.append("\nℹ️  Some optional features are unavailable.")
        else:
            report_lines.append("\n✅ All dependencies satisfied.")

        return {
            "ok": len(missing_required) == 0,
            "all_ok": all_ok,
            "missing_required": [{"name": r.name, "hint": r.install_hint} for r in missing_required],
            "missing_optional": [{"name": r.name, "feature": r.degraded_feature, "hint": r.install_hint} for r in missing_optional],
            "report": "\n".join(report_lines),
        }


def check_on_startup() -> bool:
    """Run dependency check and print report. Returns True if all required deps are available."""
    checker = DependencyChecker()
    result = checker.report()
    print(result["report"])
    return result["ok"]


if __name__ == "__main__":
    ok = check_on_startup()
    import sys
    sys.exit(0 if ok else 1)
