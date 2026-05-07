"""
WeBrain Metrics Collector — 可观测性指标收集器
支持: 请求数/延迟/错误率/内存/CPU/模型健康/渠道状态
"""

import asyncio
import json
import logging
import os
import sqlite3
import time
from collections import deque
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Deque, Dict, List, Optional

logger = logging.getLogger("webrain.metrics")


class MetricPoint:
    """Single metric data point."""

    def __init__(self, name: str, value: float, labels: Optional[Dict[str, str]] = None):
        self.name = name
        self.value = value
        self.labels = labels or {}
        self.timestamp = datetime.now(timezone.utc).isoformat()


class MetricsCollector:
    """Central metrics collector with in-memory ring buffers + SQLite persistence."""

    def __init__(self, db_path: Optional[str] = None, retention_hours: int = 24):
        self.db_path = db_path or str(Path.home() / ".webrain" / "metrics.db")
        self.retention_hours = retention_hours
        self._counters: Dict[str, int] = {}
        self._gauges: Dict[str, float] = {}
        self._histograms: Dict[str, Deque[float]] = {}
        self._hist_max_len = 10000
        self._lock = asyncio.Lock()
        self._init_db()

    def _init_db(self) -> None:
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(self.db_path)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS metrics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                value REAL NOT NULL,
                labels TEXT,
                timestamp TEXT NOT NULL
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_metrics_name ON metrics(name)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_metrics_time ON metrics(timestamp)")
        conn.commit()
        conn.close()

    # ─── Counter ─────────────────────────────────────────────────────

    def inc(self, name: str, value: int = 1, labels: Optional[Dict[str, str]] = None) -> None:
        key = self._key(name, labels)
        self._counters[key] = self._counters.get(key, 0) + value

    def get_counter(self, name: str, labels: Optional[Dict[str, str]] = None) -> int:
        return self._counters.get(self._key(name, labels), 0)

    # ─── Gauge ───────────────────────────────────────────────────────

    def gauge(self, name: str, value: float, labels: Optional[Dict[str, str]] = None) -> None:
        key = self._key(name, labels)
        self._gauges[key] = value

    def get_gauge(self, name: str, labels: Optional[Dict[str, str]] = None) -> float:
        return self._gauges.get(self._key(name, labels), 0.0)

    # ─── Histogram ───────────────────────────────────────────────────

    def observe(self, name: str, value: float, labels: Optional[Dict[str, str]] = None) -> None:
        key = self._key(name, labels)
        if key not in self._histograms:
            self._histograms[key] = deque(maxlen=self._hist_max_len)
        self._histograms[key].append(value)

    def get_histogram_stats(self, name: str, labels: Optional[Dict[str, str]] = None) -> Dict[str, float]:
        values = list(self._histograms.get(self._key(name, labels), []))
        if not values:
            return {"count": 0, "sum": 0, "avg": 0, "min": 0, "max": 0, "p50": 0, "p95": 0, "p99": 0}
        values_sorted = sorted(values)
        n = len(values_sorted)
        return {
            "count": n,
            "sum": sum(values_sorted),
            "avg": sum(values_sorted) / n,
            "min": values_sorted[0],
            "max": values_sorted[-1],
            "p50": values_sorted[int(n * 0.5)],
            "p95": values_sorted[int(n * 0.95)] if n > 20 else values_sorted[-1],
            "p99": values_sorted[int(n * 0.99)] if n > 100 else values_sorted[-1],
        }

    # ─── System Metrics ──────────────────────────────────────────────

    def collect_system(self) -> Dict[str, Any]:
        """Collect OS-level metrics."""
        import psutil
        mem = psutil.virtual_memory()
        disk = psutil.disk_usage("/")
        cpu_percent = psutil.cpu_percent(interval=0.1)
        load = os.getloadavg() if hasattr(os, "getloadavg") else [0, 0, 0]

        return {
            "cpu_percent": cpu_percent,
            "cpu_load_1m": load[0],
            "memory_used_mb": mem.used // (1024 * 1024),
            "memory_total_mb": mem.total // (1024 * 1024),
            "memory_percent": mem.percent,
            "disk_used_gb": disk.used // (1024 ** 3),
            "disk_total_gb": disk.total // (1024 ** 3),
            "disk_percent": disk.percent,
        }

    # ─── Persistence ─────────────────────────────────────────────────

    async def persist(self) -> None:
        """Persist current metrics to SQLite (called periodically)."""
        async with self._lock:
            conn = sqlite3.connect(self.db_path)
            now = datetime.now(timezone.utc).isoformat()

            # Persist counters
            for key, value in self._counters.items():
                name, labels = self._parse_key(key)
                conn.execute(
                    "INSERT INTO metrics (name, value, labels, timestamp) VALUES (?, ?, ?, ?)",
                    (name, float(value), json.dumps(labels), now),
                )

            # Persist gauges
            for key, value in self._gauges.items():
                name, labels = self._parse_key(key)
                conn.execute(
                    "INSERT INTO metrics (name, value, labels, timestamp) VALUES (?, ?, ?, ?)",
                    (name, value, json.dumps(labels), now),
                )

            conn.commit()

            # Cleanup old data
            from datetime import timedelta
            cutoff_dt = datetime.now(timezone.utc) - timedelta(hours=self.retention_hours)
            conn.execute("DELETE FROM metrics WHERE timestamp < ?", (cutoff_dt.isoformat(),))
            conn.commit()
            conn.close()

    async def query_range(
        self, name: str, start: Optional[str] = None, end: Optional[str] = None, labels: Optional[Dict[str, str]] = None
    ) -> List[Dict[str, Any]]:
        """Query metric history."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        sql = "SELECT * FROM metrics WHERE name = ?"
        params: List[Any] = [name]
        if start:
            sql += " AND timestamp >= ?"
            params.append(start)
        if end:
            sql += " AND timestamp <= ?"
            params.append(end)
        sql += " ORDER BY timestamp DESC LIMIT 1000"

        rows = conn.execute(sql, params).fetchall()
        conn.close()

        results = []
        for row in rows:
            row_labels = json.loads(row["labels"] or "{}")
            if labels and not all(row_labels.get(k) == v for k, v in labels.items()):
                continue
            results.append({
                "name": row["name"],
                "value": row["value"],
                "labels": row_labels,
                "timestamp": row["timestamp"],
            })
        return results

    # ─── Snapshot ────────────────────────────────────────────────────

    def snapshot(self) -> Dict[str, Any]:
        """Get a full snapshot of all current metrics."""
        return {
            "counters": {self._parse_key(k)[0]: v for k, v in self._counters.items()},
            "gauges": {self._parse_key(k)[0]: v for k, v in self._gauges.items()},
            "histograms": {
                self._parse_key(k)[0]: self.get_histogram_stats(self._parse_key(k)[0], self._parse_key(k)[1])
                for k in self._histograms.keys()
            },
            "system": self.collect_system(),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    # ─── Helpers ─────────────────────────────────────────────────────

    @staticmethod
    def _key(name: str, labels: Optional[Dict[str, str]]) -> str:
        if not labels:
            return name
        label_str = ",".join(f"{k}={v}" for k, v in sorted(labels.items()))
        return f"{name}{{{label_str}}}"

    @staticmethod
    def _parse_key(key: str) -> tuple:
        if "{" not in key:
            return key, {}
        name, labels_str = key.split("{", 1)
        labels_str = labels_str.rstrip("}")
        labels = {}
        for pair in labels_str.split(","):
            if "=" in pair:
                k, v = pair.split("=", 1)
                labels[k] = v
        return name, labels


# ─── Decorator for automatic latency tracking ───────────────────────

def timed(metric_name: str, labels: Optional[Dict[str, str]] = None):
    """Decorator to automatically track function execution time."""
    def decorator(func: Callable):
        async def async_wrapper(*args, **kwargs):
            collector: Optional[MetricsCollector] = None
            for arg in args:
                if isinstance(arg, MetricsCollector):
                    collector = arg
                    break
            start = time.perf_counter()
            try:
                result = await func(*args, **kwargs)
                if collector:
                    collector.inc(f"{metric_name}_total", labels=labels)
                return result
            except Exception:
                if collector:
                    collector.inc(f"{metric_name}_errors", labels=labels)
                raise
            finally:
                if collector:
                    elapsed = time.perf_counter() - start
                    collector.observe(f"{metric_name}_latency_ms", elapsed * 1000, labels=labels)
        return async_wrapper
    return decorator
