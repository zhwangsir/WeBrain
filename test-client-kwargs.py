"""Print self._client_kwargs to understand OpenAI client config."""
import os, sys, faulthandler, json, time, threading
os.environ["HERMES_HOME"] = "/Users/dgmt-openclaw01/webrain-hermes/.hermes-home"
os.environ["NO_PROXY"] = "localhost,127.0.0.1,::1,240e:b8f:1d22:e700:1c16:bd7:f132:7599,[240e:b8f:1d22:e700:1c16:bd7:f132:7599]"
os.environ["no_proxy"] = os.environ["NO_PROXY"]

faulthandler.dump_traceback_later(30, repeat=True)

sys.path.insert(0, "/Users/dgmt-openclaw01/webrain-hermes")

import run_agent

# Patch _create_request_openai_client to print client_kwargs
orig_create_req = run_agent.AIAgent._create_request_openai_client
def patched_create_req(self, *, reason, api_kwargs=None):
    print("CREATE_REQ: reason=" + reason, flush=True)
    print("CREATE_REQ: self._client_kwargs keys=" + str(list(self._client_kwargs.keys())), flush=True)
    for k, v in self._client_kwargs.items():
        vstr = repr(v)
        if len(vstr) > 200:
            vstr = vstr[:200] + "..."
        print("CREATE_REQ:   " + k + " = " + vstr, flush=True)
    # Check httpx client timeout
    try:
        http_client = self._client_kwargs.get("http_client")
        if http_client is None:
            print("CREATE_REQ: no http_client in _client_kwargs", flush=True)
        else:
            print("CREATE_REQ: http_client type=" + str(type(http_client).__name__), flush=True)
            print("CREATE_REQ: http_client timeout=" + repr(getattr(http_client, "timeout", "??")), flush=True)
    except Exception as e:
        print("CREATE_REQ: http_client check failed: " + str(e), flush=True)
    return orig_create_req(self, reason=reason, api_kwargs=api_kwargs)
run_agent.AIAgent._create_request_openai_client = patched_create_req

# Patch _create_openai_client to check the final client
orig_create_openai = run_agent.AIAgent._create_openai_client
def patched_create_openai(self, client_kwargs, *, reason, shared):
    print("CREATE_OPENAI: client_kwargs keys=" + str(list(client_kwargs.keys())), flush=True)
    print("CREATE_OPENAI: timeout in kwargs=" + repr(client_kwargs.get("timeout", "NOT SET")), flush=True)
    # Check http_client timeout before creating
    http_client = client_kwargs.get("http_client")
    if http_client:
        print("CREATE_OPENAI: http_client timeout=" + repr(getattr(http_client, "timeout", "??")), flush=True)
    result = orig_create_openai(self, client_kwargs, reason=reason, shared=shared)
    # Check result's timeout
    try:
        result_timeout = getattr(result, "timeout", "??")
        print("CREATE_OPENAI: result timeout=" + repr(result_timeout), flush=True)
        # Check underlying httpx client
        result_http = getattr(result, "_client", None)
        if result_http:
            print("CREATE_OPENAI: result._client timeout=" + repr(getattr(result_http, "timeout", "??")), flush=True)
    except Exception as e:
        print("CREATE_OPENAI: result check failed: " + str(e), flush=True)
    return result
run_agent.AIAgent._create_openai_client = patched_create_openai

from hermes_cli.oneshot import _run_agent
try:
    result = _run_agent("hi")
    print("RESULT: " + (result[:200] if result else "(empty)"), flush=True)
except Exception as e:
    print("ERROR: " + str(e), flush=True)
