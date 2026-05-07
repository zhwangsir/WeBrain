"""Tests for MetricsCollector."""

import pytest

from observability.metrics import MetricsCollector


class TestMetricsCollector:
    """Unit tests for MetricsCollector."""

    @pytest.fixture
    def mc(self, temp_dir):
        db_path = temp_dir / "test_metrics.db"
        return MetricsCollector(db_path=str(db_path), retention_hours=1)

    def test_counter(self, mc):
        mc.inc("requests", value=1)
        mc.inc("requests", value=2)
        assert mc.get_counter("requests") == 3

    def test_counter_with_labels(self, mc):
        mc.inc("requests", value=1, labels={"method": "GET"})
        mc.inc("requests", value=1, labels={"method": "POST"})
        mc.inc("requests", value=1, labels={"method": "GET"})
        assert mc.get_counter("requests", {"method": "GET"}) == 2
        assert mc.get_counter("requests", {"method": "POST"}) == 1

    def test_gauge(self, mc):
        mc.gauge("memory_mb", 1024.5)
        assert mc.get_gauge("memory_mb") == 1024.5

    def test_histogram(self, mc):
        mc.observe("latency_ms", 10)
        mc.observe("latency_ms", 20)
        mc.observe("latency_ms", 30)
        stats = mc.get_histogram_stats("latency_ms")
        assert stats["count"] == 3
        assert stats["avg"] == 20
        assert stats["min"] == 10
        assert stats["max"] == 30

    def test_histogram_empty(self, mc):
        stats = mc.get_histogram_stats("nonexistent")
        assert stats["count"] == 0

    def test_system_metrics(self, mc):
        sys_metrics = mc.collect_system()
        assert "cpu_percent" in sys_metrics
        assert "memory_used_mb" in sys_metrics
        assert "memory_total_mb" in sys_metrics
        assert "disk_used_gb" in sys_metrics

    @pytest.mark.asyncio
    async def test_persist(self, mc):
        mc.inc("test_counter")
        mc.gauge("test_gauge", 42)
        await mc.persist()

        data = await mc.query_range("test_counter")
        assert len(data) >= 1
        assert data[0]["name"] == "test_counter"

    def test_snapshot(self, mc):
        mc.inc("c1")
        mc.gauge("g1", 100)
        mc.observe("h1", 50)
        snap = mc.snapshot()
        assert "counters" in snap
        assert "gauges" in snap
        assert "histograms" in snap
        assert "system" in snap
        assert "timestamp" in snap
