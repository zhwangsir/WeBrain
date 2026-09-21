"""Test using OpenAI SDK exactly like Hermes does, with extra_body."""
import os, sys, time, faulthandler
os.environ["HERMES_HOME"] = "/Users/dgmt-openclaw01/webrain-hermes/.hermes-home"
os.environ["NO_PROXY"] = "localhost,127.0.0.1,::1,240e:b8f:1d22:e700:1c16:bd7:f132:7599,[240e:b8f:1d22:e700:1c16:bd7:f132:7599]"
os.environ["no_proxy"] = os.environ["NO_PROXY"]

faulthandler.dump_traceback_later(60, repeat=True)

from openai import OpenAI
import httpx, socket as _socket

BASE = "http://[240e:b8f:1d22:e700:1c16:bd7:f132:7599]:52416/v1"
MODEL = "mlx-community/GLM-5.2-fp8"

# Build keepalive client like Hermes (_build_keepalive_http_client)
_sock_opts = [(_socket.SOL_SOCKET, _socket.SO_KEEPALIVE, 1)]
if hasattr(_socket, "TCP_KEEPIDLE"):
    _sock_opts.append((_socket.IPPROTO_TCP, _socket.TCP_KEEPIDLE, 30))
    _sock_opts.append((_socket.IPPROTO_TCP, _socket.TCP_KEEPINTVL, 10))
    _sock_opts.append((_socket.IPPROTO_TCP, _socket.TCP_KEEPCNT, 3))
elif hasattr(_socket, "TCP_KEEPALIVE"):
    _sock_opts.append((_socket.IPPROTO_TCP, _socket.TCP_KEEPALIVE, 30))
transport = httpx.HTTPTransport(socket_options=_sock_opts)
http_client = httpx.Client(transport=transport, trust_env=False)
client = OpenAI(
    api_key="local",
    base_url=BASE,
    http_client=http_client,
    max_retries=0,
)

# Test 1: simple, no tools, with extra_body
print("=== Test 1: simple + extra_body ===")
t0 = time.time()
try:
    resp = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": "say hi"}],
        stream=True,
        max_tokens=50,
        extra_body={"enable_thinking": False, "think": False},
    )
    chunk_count = 0
    for chunk in resp:
        chunk_count += 1
        if chunk_count <= 3:
            print("  chunk " + str(chunk_count) + ": " + str(chunk)[:150])
    print("  total: " + str(round(time.time() - t0, 2)) + "s, " + str(chunk_count) + " chunks")
except Exception as e:
    print("  ERROR: " + str(e))

# Test 2: with 22 tools + large system prompt + extra_body
print("\n=== Test 2: 22 tools + 15KB sys + extra_body + stream_options ===")
large_sys = "You are a helpful assistant. " * 500
tools = [
    {"type": "function", "function": {"name": "tool_" + str(i), "description": "Test tool " + str(i), "parameters": {"type": "object", "properties": {"arg": {"type": "string"}}}}}
    for i in range(22)
]
t0 = time.time()
try:
    resp = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "system", "content": large_sys}, {"role": "user", "content": "say hi"}],
        stream=True,
        max_tokens=50,
        tools=tools,
        extra_body={"enable_thinking": False, "think": False},
        stream_options={"include_usage": True},
    )
    chunk_count = 0
    for chunk in resp:
        chunk_count += 1
        if chunk_count <= 3 or chunk_count % 20 == 0:
            print("  chunk " + str(chunk_count) + ": " + str(chunk)[:150])
        if chunk_count > 200:
            break
    print("  total: " + str(round(time.time() - t0, 2)) + "s, " + str(chunk_count) + " chunks")
except Exception as e:
    print("  ERROR: " + str(e))

http_client.close()
