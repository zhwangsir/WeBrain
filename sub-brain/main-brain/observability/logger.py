"""
WeBrain Structured Logger — JSON 结构化日志
统一格式: {"timestamp", "level", "component", "message", "context", "trace_id"}
"""

import json
import logging
import sys
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional


class StructuredLogFormatter(logging.Formatter):
    """Format log records as JSON."""

    def format(self, record: logging.LogRecord) -> str:
        log_data: Dict[str, Any] = {
            "timestamp": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname,
            "component": record.name,
            "message": record.getMessage(),
            "source": {"file": record.pathname, "line": record.lineno, "func": record.funcName},
        }

        # Add extra fields if present
        if hasattr(record, "trace_id"):
            log_data["trace_id"] = record.trace_id
        if hasattr(record, "context"):
            log_data["context"] = record.context
        if hasattr(record, "duration_ms"):
            log_data["duration_ms"] = record.duration_ms
        if hasattr(record, "status"):
            log_data["status"] = record.status

        # Include exception info
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_data, ensure_ascii=False, default=str)


def setup_structured_logging(level: int = logging.INFO, component: Optional[str] = None) -> logging.Logger:
    """Setup structured JSON logging for a component."""
    logger = logging.getLogger(component or "webrain")
    logger.setLevel(level)

    # Clear existing handlers to avoid duplicates
    logger.handlers = []

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(StructuredLogFormatter())
    logger.addHandler(handler)

    return logger


class LogContext:
    """Context manager for adding trace_id and context to all logs in a block."""

    _current_trace: Optional[str] = None

    def __init__(self, trace_id: Optional[str] = None, **context: Any):
        self.trace_id = trace_id or str(uuid.uuid4())[:8]
        self.context = context
        self._adapter: Optional[logging.LoggerAdapter] = None

    def __enter__(self):
        LogContext._current_trace = self.trace_id
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        LogContext._current_trace = None
        return False

    @classmethod
    def get_trace_id(cls) -> Optional[str]:
        return cls._current_trace


def get_logger(name: str) -> logging.Logger:
    """Get a logger with structured formatting."""
    return logging.getLogger(name)


def log_request(
    logger: logging.Logger,
    method: str,
    path: str,
    status: int,
    duration_ms: float,
    trace_id: Optional[str] = None,
    extra: Optional[Dict[str, Any]] = None,
) -> None:
    """Log an HTTP request in structured format."""
    extra_dict: Dict[str, Any] = {
        "trace_id": trace_id or LogContext.get_trace_id() or "",
        "duration_ms": round(duration_ms, 2),
        "status": status,
        "context": {"method": method, "path": path, **(extra or {})},
    }
    logger.info(
        f"{method} {path} {status} {duration_ms:.1f}ms",
        extra=extra_dict,
    )


def log_tool_call(
    logger: logging.Logger,
    tool_name: str,
    success: bool,
    duration_ms: float,
    trace_id: Optional[str] = None,
    error: Optional[str] = None,
) -> None:
    """Log a tool execution."""
    extra_dict: Dict[str, Any] = {
        "trace_id": trace_id or LogContext.get_trace_id() or "",
        "duration_ms": round(duration_ms, 2),
        "status": "success" if success else "error",
        "context": {"tool": tool_name},
    }
    if error:
        extra_dict["context"]["error"] = error

    msg = f"tool_call {tool_name} {'success' if success else 'failed'} in {duration_ms:.1f}ms"
    if success:
        logger.info(msg, extra=extra_dict)
    else:
        logger.warning(msg, extra=extra_dict)
