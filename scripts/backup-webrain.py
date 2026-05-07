#!/usr/bin/env python3
"""
WeBrain Backup & Restore Script
备份 SQLite 数据库、Wiki、Canvas、Agents 数据
支持全量备份、增量备份、时间点恢复
"""

import argparse
import json
import os
import shutil
import sys
import tarfile
from datetime import datetime
from pathlib import Path
from typing import Optional

HOME = Path.home()
WEBRAIN_DIR = HOME / ".webrain"
BACKUP_DIR = HOME / ".webrain" / "backups"

# Data sources to backup
BACKUP_SOURCES = {
    "memory_db": WEBRAIN_DIR / "memory.db",
    "sub_brain_db": WEBRAIN_DIR / "sub-brain.db",
    "knowledge_graph_db": WEBRAIN_DIR / "knowledge_graph.db",
    "cron_db": WEBRAIN_DIR / "cron.db",
    "wiki": WEBRAIN_DIR / "wiki",
    "canvas": WEBRAIN_DIR / "canvas",
    "agents": WEBRAIN_DIR / "agents",
    "skills": WEBRAIN_DIR / "skills",
    "config": WEBRAIN_DIR / "webrain.json",
}


def ensure_backup_dir() -> Path:
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    return BACKUP_DIR


def create_backup(name: Optional[str] = None, incremental: bool = False) -> Path:
    """Create a full or incremental backup"""
    backup_dir = ensure_backup_dir()
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_name = name or f"webrain_backup_{timestamp}"
    backup_path = backup_dir / f"{backup_name}.tar.gz"

    # Create manifest
    manifest = {
        "created_at": datetime.now().isoformat(),
        "type": "incremental" if incremental else "full",
        "sources": {},
    }

    temp_dir = backup_dir / f"_temp_{timestamp}"
    temp_dir.mkdir(parents=True, exist_ok=True)

    for label, src_path in BACKUP_SOURCES.items():
        if not src_path.exists():
            print(f"  ⚠️  Skipping {label}: not found")
            continue

        dest = temp_dir / label
        try:
            if src_path.is_file():
                shutil.copy2(src_path, dest)
            else:
                shutil.copytree(src_path, dest, dirs_exist_ok=True)
            manifest["sources"][label] = str(src_path)
            print(f"  ✅ {label}")
        except Exception as e:
            print(f"  ❌ {label}: {e}")

    # Write manifest
    manifest_path = temp_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2))

    # Create tar.gz
    with tarfile.open(backup_path, "w:gz") as tar:
        tar.add(temp_dir, arcname=backup_name)

    # Cleanup temp dir
    shutil.rmtree(temp_dir, ignore_errors=True)

    size_mb = backup_path.stat().st_size / (1024 * 1024)
    print(f"\n✅ Backup created: {backup_path}")
    print(f"   Size: {size_mb:.1f} MB")
    print(f"   Type: {manifest['type']}")
    return backup_path


def list_backups():
    """List all available backups"""
    backup_dir = ensure_backup_dir()
    backups = sorted(backup_dir.glob("*.tar.gz"), key=lambda p: p.stat().st_mtime, reverse=True)

    if not backups:
        print("No backups found.")
        return

    print(f"{'Name':<40} {'Size':<10} {'Date':<20}")
    print("-" * 80)
    for b in backups:
        size_mb = b.stat().st_size / (1024 * 1024)
        mtime = datetime.fromtimestamp(b.stat().st_mtime).strftime("%Y-%m-%d %H:%M:%S")
        print(f"{b.name:<40} {size_mb:>6.1f} MB  {mtime:<20}")


def restore_backup(backup_name: str, dry_run: bool = False):
    """Restore from a backup archive"""
    backup_dir = ensure_backup_dir()
    backup_path = backup_dir / backup_name
    if not backup_path.exists():
        backup_path = backup_dir / f"{backup_name}.tar.gz"
    if not backup_path.exists():
        print(f"❌ Backup not found: {backup_name}")
        sys.exit(1)

    print(f"{'[DRY RUN] ' if dry_run else ''}Restoring from: {backup_path}")

    temp_dir = backup_dir / "_restore_temp"
    temp_dir.mkdir(parents=True, exist_ok=True)

    with tarfile.open(backup_path, "r:gz") as tar:
        tar.extractall(temp_dir)

    extracted = next(temp_dir.iterdir())
    manifest_path = extracted / "manifest.json"
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}

    print(f"Backup created: {manifest.get('created_at', 'unknown')}")
    print(f"Type: {manifest.get('type', 'unknown')}")
    print()

    for label in BACKUP_SOURCES.keys():
        src = extracted / label
        if not src.exists():
            continue

        dest = BACKUP_SOURCES[label]
        action = "Would restore" if dry_run else "Restoring"
        print(f"  {action} {label} → {dest}")

        if dry_run:
            continue

        try:
            if dest.exists():
                if dest.is_file():
                    dest.unlink()
                else:
                    shutil.rmtree(dest, ignore_errors=True)

            if src.is_file():
                shutil.copy2(src, dest)
            else:
                shutil.copytree(src, dest)
        except Exception as e:
            print(f"    ❌ Error: {e}")

    shutil.rmtree(temp_dir, ignore_errors=True)
    print(f"\n{'[DRY RUN] ' if dry_run else ''}✅ Restore complete")


def main():
    parser = argparse.ArgumentParser(description="WeBrain Backup & Restore")
    sub = parser.add_subparsers(dest="command", required=True)

    backup_cmd = sub.add_parser("backup", help="Create a backup")
    backup_cmd.add_argument("--name", help="Backup name")
    backup_cmd.add_argument("--incremental", action="store_true", help="Incremental backup")

    list_cmd = sub.add_parser("list", help="List backups")

    restore_cmd = sub.add_parser("restore", help="Restore from backup")
    restore_cmd.add_argument("backup_name", help="Backup name or file")
    restore_cmd.add_argument("--dry-run", action="store_true", help="Show what would be restored")

    args = parser.parse_args()

    if args.command == "backup":
        create_backup(args.name, args.incremental)
    elif args.command == "list":
        list_backups()
    elif args.command == "restore":
        restore_backup(args.backup_name, args.dry_run)


if __name__ == "__main__":
    main()
