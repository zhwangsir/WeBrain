"""Tests for CronEngine."""

import asyncio

import pytest

from cron.cron_engine import CronEngine, CronJob


class TestCronEngine:
    """Unit tests for CronEngine."""

    @pytest.fixture
    def cron(self, temp_dir):
        db_path = temp_dir / "test_cron.db"
        return CronEngine(db_path=str(db_path))

    def test_create_job(self, cron):
        job = cron.create_job("test", "0 0 * * *", "http_request", {"url": "http://test.com"})
        assert isinstance(job, CronJob)
        assert job.name == "test"
        assert job.cron_expr == "0 0 * * *"
        assert job.task_type == "http_request"
        assert job.enabled is True

    def test_list_jobs(self, cron):
        cron.create_job("j1", "0 0 * * *", "noop", {})
        cron.create_job("j2", "0 1 * * *", "noop", {})
        jobs = cron.list_jobs()
        assert len(jobs) == 2

    def test_get_job(self, cron):
        job = cron.create_job("test", "0 0 * * *", "noop", {})
        found = cron.get_job(job.job_id)
        assert found is not None
        assert found.name == "test"
        assert cron.get_job("nonexistent") is None

    def test_enable_disable(self, cron):
        job = cron.create_job("test", "0 0 * * *", "noop", {})
        assert job.enabled is True

        assert cron.disable_job(job.job_id)
        assert cron.get_job(job.job_id).enabled is False

        assert cron.enable_job(job.job_id)
        assert cron.get_job(job.job_id).enabled is True

    def test_delete_job(self, cron):
        job = cron.create_job("test", "0 0 * * *", "noop", {})
        assert cron.delete_job(job.job_id)
        assert cron.get_job(job.job_id) is None
        assert not cron.delete_job("nonexistent")

    def test_persistence(self, temp_dir):
        """Jobs survive engine restart."""
        db = temp_dir / "persist_cron.db"
        cron1 = CronEngine(db_path=str(db))
        job = cron1.create_job("persist", "0 0 * * *", "noop", {})

        cron2 = CronEngine(db_path=str(db))
        found = cron2.get_job(job.job_id)
        assert found is not None
        assert found.name == "persist"

    def test_stats(self, cron):
        cron.create_job("j1", "0 0 * * *", "noop", {}, enabled=True)
        cron.create_job("j2", "0 1 * * *", "noop", {}, enabled=False)
        stats = cron.get_stats()
        assert stats["total_jobs"] == 2
        assert stats["enabled_jobs"] == 1
        assert stats["disabled_jobs"] == 1

    @pytest.mark.asyncio
    async def test_scheduler_execution(self, cron, temp_dir):
        """Test that a job with a past cron expression gets executed."""
        executed = []

        async def handler(params):
            executed.append(params)
            return "ok"

        CronEngine.register_handler("test_exec", handler)

        # Every minute — will trigger on next check
        job = cron.create_job("exec_test", "* * * * *", "test_exec", {"key": "val"})
        # Force next_run to be in the past
        job.next_run = "2020-01-01T00:00:00+00:00"

        await cron.start()
        await asyncio.sleep(2)  # Wait for scheduler loop
        await cron.stop()

        assert len(executed) >= 1
        assert executed[0]["key"] == "val"

    @pytest.mark.asyncio
    async def test_job_retry(self, cron, temp_dir):
        """Failed job should retry."""
        attempts = []

        async def failing_handler(params):
            attempts.append(1)
            raise RuntimeError("fail")

        CronEngine.register_handler("test_fail", failing_handler)

        job = cron.create_job("retry_test", "* * * * *", "test_fail", {}, max_retries=2)
        job.next_run = "2020-01-01T00:00:00+00:00"

        await cron.start()
        await asyncio.sleep(8)  # Wait for retries (1 + 2 + 4 seconds)
        await cron.stop()

        # 1 initial + 2 retries = 3 attempts
        assert len(attempts) == 3
