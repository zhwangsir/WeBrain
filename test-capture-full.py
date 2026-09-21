"""Capture Hermes full api_kwargs and test directly with OpenAI SDK."""
import os, sys, faulthandler, json, time, threading
os.environ["HERMES_HOME"] = "/Users/dgmt-openclaw01/webrain-hermes/.hermes-home"
os.environ["NO_PROXY"] = "localhost,127.0.0.1,::1,240e:b8f:1d22:e700:1c16:bd7:f132:7599,[240e:b8f:1d22:e700:1c16:bd7:f132:7599]"
os.environ["no_proxy"] = os.environ["NO_PROXY"]

faulthandler.dump_traceback_later(120, repeat=True)

sys.path.insert(0, "/Users/dgmt-openclaw01/webrain-hermes")

import run_agent

# Capture api_kwargs from _build_api_kwargs and save to file
captured_kwargs = None
orig_build = run_agent.AIAgent._build_api_kwargs
def patched_build(self, *args, **kwargs):
    global captured_kwargs
    result = orig_build(self, *args, **kwargs)
    captured_kwargs = result
    # Save to file for later analysis
    try:
        rcopy = dict(result)
        # Measure sizes
        msgs = rcopy.get("messages", [])
        tools = rcopy.get("tools", [])
        total_chars = sum(len(json.dumps(m, default=str)) for m in msgs) if msgs else 0
        tools_chars = sum(len(json.dumps(t, default=str)) for t in tools) if tools else 0
        print("CAPTURED: msgs=" + str(len(msgs)) + " (" + str(total_chars) + " chars), tools=" + str(len(tools)) + " (" + str(tools_chars) + " chars)", flush=True)
        print("CAPTURED: extra_body=" + repr(rcopy.get("extra_body")), flush=True)
        print("CAPTURED: model=" + repr(rcopy.get("model")), flush=True)
        # Save full kwargs to file
        with open("/tmp/hermes_api_kwargs.json", "w") as f:
            json.dump(rcopy, f, default=str)
        print("CAPTURED: saved to /tmp/hermes_api_kwargs.json", flush=True)
    except Exception as e:
        print("CAPTURED: save failed: " + str(e), flush=True)
    return result
run_agent.AIAgent._build_api_kwargs = patched_build

# Run oneshot in a thread (it will likely hang)
from hermes_cli.oneshot import _run_agent

def run_oneshot():
    try:
        result = _run_agent("say hi")
        print("RESULT: " + (result[:200] if result else "(empty)"), flush=True)
    except Exception as e:
        print("ERROR: " + str(e), flush=True)

t = threading.Thread(target=run_oneshot, daemon=True)
t.start()
# Wait up to 60s for _build_api_kwargs to be called
for i in range(120):
    t.join(timeout=0.5)
    if captured_kwargs is not None:
        break
    if i % 20 == 0:
        print("waiting for api_kwargs... (" + str(i * 0.5) + "s)", flush=True)

if captured_kwargs is None:
    print("FAILED to capture api_kwargs", flush=True)
    sys.exit(1)

print("\n=== Now testing captured kwargs directly with OpenAI SDK ===", flush=True)

# Now test the captured kwargs directly
from openai import OpenAI
import httpx, socket as _socket

BASE = "http://[240e:b8f:1d22:e700:1c16:bd7:f132:7599]:52416/v1"
_sock_opts = [(_socket.SOL_SOCKET, _socket.SO_KEEPALIVE, 1)]
if hasattr(_socket, "TCP_KEEPIDLE"):
    _sock_opts.append((_socket.IPPROTO_TCP, _socket.TCP_KEEPIDLE, 30))
    _sock_opts.append((_socket.IPPROTO_TCP, _socket.TCP_KEEPINTVL, 10))
    _sock_opts.append((_socket.IPPROTO_TCP, _socket.TCP_KEEPCNT, 3))
elif hasattr(_socket, "TCP_KEEPALIVE"):
    _sock_opts.append((_socket.IPPROTO_TCP, _socket.TCP_KEEPALIVE, 30))
transport = httpx.HTTPTransport(socket_options=_sock_opts)
http_client = httpx.Client(transport=transport, trust_env=False)
client = OpenAI(api_key="local", base_url=BASE, http_client=http_client, max_retries=0)

# Build stream_kwargs like Hermes does
stream_kwargs = {
    **captured_kwargs,
    "stream": True,
    "stream_options": {"include_usage": True},
    "timeout": httpx.Timeout(connect=30.0, read=1800.0, write=1800.0, pool=30.0),
}

print("stream_kwargs keys: " + str(list(stream_kwargs.keys())), flush=True)
print("extra_body in stream_kwargs: " + repr(stream_kwargs.get("extra_body")), flush=True)

# Remove timeout (OpenAI SDK wants its own timeout type)
# Actually OpenAI SDK accepts httpx.Timeout

t0 = time.time()
chunk_count = 0
try:
    stream = client.chat.completions.create(**stream_kwargs)
    print("stream created, iterating...", flush=True)
    for chunk in stream:
        chunk_count += 1
        if chunk_count <= 5 or chunk_count % 50 == 0:
            print("  chunk " + str(chunk_count) + " at " + str(round(time.time() - t0, 2)) + "s: " + str(chunk)[:200], flush=True)
        if chunk_count > 500:
            break
    print("DONE: " + str(round(time.time() - t0, 2)) + "s, " + str(chunk_count) + " chunks", flush=True)
except Exception as e:
    print("ERROR after " + str(round(time.time() - t0, 2)) + "s: " + str(e), flush=True)
    import traceback
    traceback.print_exc()

http_client.close()
