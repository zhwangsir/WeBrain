#!/usr/bin/env python3
"""Diagnostic test: run Hermes agent with full logging visible.

Bypasses oneshot.py's logging.disable(CRITICAL) and stdout/stderr redirect.
"""
import os
import sys
import time
import logging

os.environ.setdefault("HERMES_HOME", "/Users/dgmt-openclaw01/webrain-hermes/.hermes-home")

# Enable INFO+ logging to stderr (DEBUG is too verbose)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    stream=sys.stderr,
)
# Bump HTTP-related loggers to DEBUG for streaming diagnostics
for _name in ("agent.auxiliary_client", "root", "run_agent"):
    logging.getLogger(_name).setLevel(logging.DEBUG)


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
    print(f"reasoning_config = {reasoning_config}", file=sys.stderr)

    model_cfg = cfg.get("model") or {}
    if isinstance(model_cfg, str):
        cfg_model = model_cfg
    else:
        cfg_model = model_cfg.get("default") or model_cfg.get("model") or ""
    effective_model = (model_cfg.get("default") or "").strip() or cfg_model
    effective_provider = (model_cfg.get("provider") or "").strip() or None
    base_url = model_cfg.get("base_url") or ""
    print(f"effective_model = {effective_model}", file=sys.stderr)
    print(f"effective_provider = {effective_provider}", file=sys.stderr)
    print(f"base_url = {base_url}", file=sys.stderr)

    from agent.model_metadata import is_local_endpoint
    _local = is_local_endpoint(base_url)
    print(f"is_local_endpoint = {_local}", file=sys.stderr)

    runtime = resolve_runtime_provider(
        requested=effective_provider,
        target_model=effective_model or None,
    )
    print(f"runtime provider = {runtime.get('provider')}", file=sys.stderr)
    print(f"runtime base_url = {runtime.get('base_url')}", file=sys.stderr)
    print(f"runtime api_mode = {runtime.get('api_mode')}", file=sys.stderr)

    toolsets_list = sorted(_get_platform_tools(cfg, "cli"))
    print(f"toolsets = {toolsets_list}", file=sys.stderr)

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

    print(f"Agent created. Starting chat...", file=sys.stderr)
    _start = time.time()

    try:
        response = agent.chat("say hi in one word")
        _elapsed = time.time() - _start
        print(f"\n--- RESPONSE ({_elapsed:.1f}s) ---", file=sys.stderr)
        if response:
            print(response)
        else:
            print("(empty response)", file=sys.stderr)
            # Dump last few messages for diagnosis
            if hasattr(agent, 'messages') and agent.messages:
                for msg in reversed(agent.messages[-5:]):
                    role = msg.get("role", "?")
                    content = str(msg.get("content", ""))[:300]
                    print(f"  [{role}] {content}", file=sys.stderr)
    except Exception as e:
        _elapsed = time.time() - _start
        print(f"\n--- ERROR ({_elapsed:.1f}s) ---", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
