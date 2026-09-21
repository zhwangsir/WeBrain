"""Deep instrumentation of _call_chat_completions to find exact hang point."""
import os, sys, faulthandler, json, time, threading
os.environ["HERMES_HOME"] = "/Users/dgmt-openclaw01/webrain-hermes/.hermes-home"
os.environ["NO_PROXY"] = "localhost,127.0.0.1,::1,240e:b8f:1d22:e700:1c16:bd7:f132:7599,[240e:b8f:1d22:e700:1c16:bd7:f132:7599]"
os.environ["no_proxy"] = os.environ["NO_PROXY"]

faulthandler.dump_traceback_later(60, repeat=True)

sys.path.insert(0, "/Users/dgmt-openclaw01/webrain-hermes")

import run_agent

# Patch _interruptible_streaming_api_call to instrument the inner _call_chat_completions
orig_interruptible = run_agent.AIAgent._interruptible_streaming_api_call
def patched_interruptible(self, api_kwargs, *, on_first_delta=None):
    print("INTERRUPTIBLE: called with api_kwargs keys=" + str(list(api_kwargs.keys())), flush=True)
    print("INTERRUPTIBLE: extra_body=" + repr(api_kwargs.get("extra_body")), flush=True)
    print("INTERRUPTIBLE: base_url=" + repr(getattr(self, "base_url", "??")), flush=True)
    print("INTERRUPTIBLE: provider=" + repr(getattr(self, "provider", "??")), flush=True)

    # Check is_local_endpoint
    try:
        from agent.model_metadata import is_local_endpoint
        base_url = getattr(self, "base_url", "") or ""
        is_local = is_local_endpoint(base_url)
        print("INTERRUPTIBLE: is_local_endpoint=" + str(is_local) + " for " + base_url, flush=True)
    except Exception as e:
        print("INTERRUPTIBLE: is_local_endpoint check failed: " + str(e), flush=True)

    # Check proxy
    try:
        from run_agent import _get_proxy_for_base_url
        proxy = _get_proxy_for_base_url(getattr(self, "base_url", "") or "")
        print("INTERRUPTIBLE: proxy=" + repr(proxy), flush=True)
    except Exception as e:
        print("INTERRUPTIBLE: proxy check failed: " + str(e), flush=True)

    # Check stream stale timeout
    stale_base = float(os.getenv("HERMES_STREAM_STALE_TIMEOUT", 180.0))
    print("INTERRUPTIBLE: HERMES_STREAM_STALE_TIMEOUT base=" + str(stale_base), flush=True)

    # Check stream read timeout
    read_timeout = float(os.getenv("HERMES_STREAM_READ_TIMEOUT", 120.0))
    print("INTERRUPTIBLE: HERMES_STREAM_READ_TIMEOUT=" + str(read_timeout), flush=True)

    # Now call the original
    return orig_interruptible(self, api_kwargs, on_first_delta=on_first_delta)

run_agent.AIAgent._interruptible_streaming_api_call = patched_interruptible

# Also patch _build_api_kwargs to log
orig_build = run_agent.AIAgent._build_api_kwargs
def patched_build(self, *args, **kwargs):
    result = orig_build(self, *args, **kwargs)
    eb = result.get("extra_body") if isinstance(result, dict) else None
    print("BUILD_API_KWARGS: extra_body=" + repr(eb), flush=True)
    print("BUILD_API_KWARGS: result keys=" + str(list(result.keys()) if isinstance(result, dict) else "N/A"), flush=True)
    return result
run_agent.AIAgent._build_api_kwargs = patched_build

from hermes_cli.oneshot import _run_agent
try:
    result = _run_agent("hi")
    print("RESULT: " + (result[:200] if result else "(empty)"), flush=True)
except Exception as e:
    import traceback
    traceback.print_exc()
    print("ERROR: " + str(e), flush=True)
