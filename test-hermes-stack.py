#!/usr/bin/env python3
"""Diagnostic test with faulthandler: dump all thread stacks on timeout.

This helps identify exactly where Hermes is blocked during the API call.
"""
import os
import sys
import time
import signal
import logging
import faulthandler

os.environ.setdefault("HERMES_HOME", "/Users/dgmt-openclaw01/webrain-hermes/.hermes-home")

# Enable faulthandler: dump all thread stacks to stderr on SIGUSR1
faulthandler.enable()
faulthandler.register(signal.SIGUSR1, all_threads=True)

# Dump all thread stacks after 30s via a timer thread (Python 3.11 compatible)
import threading
def _dump_after(secs):
    time.sleep(secs)
    print(f"\n=== STACK DUMP @ {secs}s ===", file=sys.stderr)
    faulthandler.dump_traceback(file=sys.stderr, all_threads=True)
    print("=== END STACK DUMP ===\n", file=sys.stderr)

for _delay in (30, 60, 90):
    threading.Thread(target=_dump_after, args=(_delay,), daemon=True).start()

# Set up logging: root at WARNING to reduce noise, but key modules at DEBUG
# with their own handler so DEBUG messages actually reach stderr.
_stderr_handler = logging.StreamHandler(sys.stderr)
_stderr_handler.setLevel(logging.DEBUG)
_stderr_handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s"))
for _name in ("run_agent", "agent.auxiliary_client", "root"):
    _l = logging.getLogger(_name)
    _l.setLevel(logging.DEBUG)
    _l.addHandler(_stderr_handler)
    _l.propagate = False  # Don't double-print via root
# Other modules at WARNING
logging.getLogger().setLevel(logging.WARNING)


def main():
    from hermes_cli.config import load_config
    from hermes_cli.runtime_provider import resolve_runtime_provider
    from hermes_cli.tools_config import _get_platform_tools
    from hermes_constants import parse_reasoning_effort
    from run_agent import AIAgent

    cfg = load_config()

    _agent_cfg = cfg.get("agent") or {}
    _reasoning_effort = ""
    if isinstance(_agent_cfg, dict):
        _reasoning_effort = str(_agent_cfg.get("reasoning_effort") or "").strip()
    reasoning_config = parse_reasoning_effort(_reasoning_effort)

    model_cfg = cfg.get("model") or {}
    effective_model = model_cfg.get("default") or ""
    effective_provider = (model_cfg.get("provider") or "").strip() or None
    base_url = model_cfg.get("base_url") or ""

    runtime = resolve_runtime_provider(
        requested=effective_provider,
        target_model=effective_model or None,
    )
    toolsets_list = sorted(_get_platform_tools(cfg, "cli"))

    print(f"[setup] model={effective_model} provider={runtime.get('provider')} local={base_url[:40]}...", file=sys.stderr)
    print(f"[setup] toolsets={len(toolsets_list)} reasoning={reasoning_config}", file=sys.stderr)

    agent = AIAgent(
        api_key=runtime.get("api_key"),
        base_url=runtime.get("base_url"),
        provider=runtime.get("provider"),
        api_mode=runtime.get("api_mode"),
        model=effective_model,
        enabled_toolsets=toolsets_list,
        quiet_mode=True,
        platform="cli",
        credential_pool=runtime.get("credential_pool"),
        reasoning_config=reasoning_config,
    )
    agent.suppress_status_output = True
    agent.stream_delta_callback = None
    agent.tool_gen_callback = None

    print(f"[chat] calling agent.chat() at {time.strftime('%H:%M:%S')}...", file=sys.stderr)
    _start = time.time()

    try:
        response = agent.chat("say hi in one word")
        _elapsed = time.time() - _start
        print(f"\n[done] {_elapsed:.1f}s response={repr(response[:200])}", file=sys.stderr)
        if response:
            print(response)
    except Exception as e:
        _elapsed = time.time() - _start
        print(f"\n[error] {_elapsed:.1f}s {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
