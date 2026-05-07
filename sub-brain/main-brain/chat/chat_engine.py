"""
Chat Engine — Streaming + Multi-turn Tool Calling + Multi-model Endpoint Support
"""

import asyncio
import json
import logging
from typing import Any, AsyncGenerator, Dict, List, Optional

import httpx

logger = logging.getLogger("webrain.chat")

# ---------------------------------------------------------------------------
# LLM Endpoint Router — manages multiple backends with health-check & failover
# ---------------------------------------------------------------------------

class LLMEndpoint:
    """A single LLM backend endpoint."""
    def __init__(self, name: str, base_url: str, model_id: str, api_key: Optional[str] = None,
                 priority: int = 0, timeout: float = 120.0, provider: str = "openai"):
        self.name = name
        self.base_url = base_url.rstrip("/")
        self.model_id = model_id
        self.api_key = api_key
        self.priority = priority
        self.timeout = timeout
        self.provider = provider  # "openai" | "anthropic" | "google" | "deepseek"
        self.healthy = True
        self.last_error: Optional[str] = None
        self.latency_ms = 0.0

    async def health_check(self) -> bool:
        """Ping /models or /v1/models to verify availability."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                urls_to_try = [
                    f"{self.base_url}/models",
                    f"{self.base_url}/v1/models",
                ]
                for url in urls_to_try:
                    try:
                        resp = await client.get(url)
                        self.healthy = resp.status_code == 200
                        if self.healthy:
                            self.last_error = None
                            return True
                    except Exception:
                        continue
                self.healthy = False
                return False
        except Exception as e:
            self.healthy = False
            self.last_error = str(e)
            return False


class LLMRouter:
    """Routes LLM requests across multiple endpoints with failover."""

    def __init__(self):
        self.endpoints: List[LLMEndpoint] = []
        self._current_index = 0

    def add_endpoint(self, endpoint: LLMEndpoint) -> None:
        self.endpoints.append(endpoint)
        # Sort by priority (higher first)
        self.endpoints.sort(key=lambda e: -e.priority)

    def set_endpoints_from_config(self, config: Dict[str, Any]) -> None:
        """Parse config which may contain single endpoint or endpoints list."""
        self.endpoints = []

        # Multi-endpoint config
        endpoints_cfg = config.get("endpoints")
        if isinstance(endpoints_cfg, list):
            for i, ecfg in enumerate(endpoints_cfg):
                self.add_endpoint(LLMEndpoint(
                    name=ecfg.get("name", f"endpoint-{i}"),
                    base_url=ecfg.get("base_url", ecfg.get("baseUrl", "")),
                    model_id=ecfg.get("model_id", ecfg.get("modelId", "unknown")),
                    api_key=ecfg.get("api_key", ecfg.get("apiKey")),
                    priority=ecfg.get("priority", 0),
                    timeout=ecfg.get("timeout", 120.0),
                    provider=ecfg.get("provider", "openai"),
                ))
            return

        # Single endpoint fallback
        base_url = config.get("base_url", config.get("baseUrl", "http://192.168.71.100:1234/v1"))
        model_id = config.get("model_id", config.get("modelId", "minimax/minimax-m2.7"))
        api_key = config.get("api_key", config.get("apiKey"))
        self.add_endpoint(LLMEndpoint(
            name="primary",
            base_url=base_url,
            model_id=model_id,
            api_key=api_key,
            priority=10,
        ))

    def get_primary(self) -> Optional[LLMEndpoint]:
        """Return first healthy endpoint, or first endpoint if none healthy."""
        for ep in self.endpoints:
            if ep.healthy:
                return ep
        return self.endpoints[0] if self.endpoints else None

    def get_all(self) -> List[LLMEndpoint]:
        return self.endpoints

    async def health_check_all(self) -> Dict[str, Any]:
        results = {}
        for ep in self.endpoints:
            ok = await ep.health_check()
            results[ep.name] = {
                "healthy": ok,
                "base_url": ep.base_url,
                "model_id": ep.model_id,
                "last_error": ep.last_error,
            }
        return results


# ---------------------------------------------------------------------------
# Chat Engine
# ---------------------------------------------------------------------------

MAX_TOOL_ITERATIONS = 10


class ChatEngine:
    def __init__(self, memory_manager: Any, sub_brain_client: Any, llm_config: Optional[Dict[str, Any]] = None):
        self.memory = memory_manager
        self.sub_brain = sub_brain_client
        self.router = LLMRouter()
        self.llm_config = llm_config or {}
        self._update_router()
        self._http_client: Optional[httpx.AsyncClient] = None

    def _get_client(self) -> httpx.AsyncClient:
        if self._http_client is None or self._http_client.is_closed:
            self._http_client = httpx.AsyncClient(timeout=120.0)
        return self._http_client

    async def close(self) -> None:
        if self._http_client and not self._http_client.is_closed:
            await self._http_client.aclose()

    def _update_router(self) -> None:
        self.router.set_endpoints_from_config(self.llm_config)

    def update_config(self, llm_config: Dict[str, Any]) -> None:
        self.llm_config = llm_config
        self._update_router()

    @property
    def _default_tools(self) -> List[Dict]:
        return [
            {"type": "function", "function": {"name": "execute_shell", "description": "执行本地 shell 命令", "parameters": {"type": "object", "properties": {"command": {"type": "string"}}, "required": ["command"]}}},
            {"type": "function", "function": {"name": "read_file", "description": "读取文件", "parameters": {"type": "object", "properties": {"path": {"type": "string"}}, "required": ["path"]}}},
            {"type": "function", "function": {"name": "write_file", "description": "写入文件", "parameters": {"type": "object", "properties": {"path": {"type": "string"}, "content": {"type": "string"}}, "required": ["path", "content"]}}},
            {"type": "function", "function": {"name": "http_request", "description": "HTTP 请求", "parameters": {"type": "object", "properties": {"url": {"type": "string"}, "method": {"type": "string"}}, "required": ["url", "method"]}}},
            {"type": "function", "function": {"name": "browse_web", "description": "浏览网页", "parameters": {"type": "object", "properties": {"url": {"type": "string"}}, "required": ["url"]}}},
        ]

    def _build_system_prompt(self, memory_text: str) -> str:
        return f"""你是 Linda，DGMT（Digimental Global Network Solution Pte. Ltd.）的高级私人秘书。

公司背景：
- DGMT 成立于 2023 年，总部位于新加坡，业务覆盖印尼、菲律宾等 APEC 地区
- 主营：International & Regional Connection（IEPL/IPLC 国际专线）、Full BGP Domestic/International IP Transit、A2P SMS 网关服务、IT 及网络设备供应
- 公司正在快速扩张中，为东南亚及全球客户提供 7x24 网络解决方案

你的职责：
- 为老板提供最专业、最贴心的服务
- 熟练使用各种工具处理文件、执行命令、发送网络请求、浏览网页
- 说话风格：专业、礼貌、温暖、主动、高效
- 常用表达："好的老板，我马上帮您处理""我已经为您联系了网络团队""方案我已优化好，请您过目""老板最近出差多，要注意休息哦"
- 你几乎没有什么办不到的事情

可用工具：execute_shell, read_file, write_file, http_request, browse_web
相关记忆：\n{memory_text}
如需要工具执行，请使用 function_call。"""

    # -----------------------------------------------------------------------
    # Core LLM call (non-streaming)
    # -----------------------------------------------------------------------
    def _build_request(self, ep: LLMEndpoint, messages: List[Dict], tools: Optional[List[Dict]] = None,
                        max_tokens: int = 2048, temperature: Optional[float] = None, stream: bool = False) -> tuple:
        """Build (url, payload, headers) for the given provider."""
        headers = {"Content-Type": "application/json"}
        temp = temperature if temperature is not None else self.llm_config.get("temperature", 0.7)

        if ep.provider == "anthropic":
            url = f"{ep.base_url}/messages"
            headers["x-api-key"] = ep.api_key or ""
            headers["anthropic-version"] = "2023-06-01"
            # Convert OpenAI format messages to Anthropic format
            system_msg = ""
            anthropic_messages = []
            for m in messages:
                if m["role"] == "system":
                    system_msg = m["content"]
                else:
                    anthropic_messages.append({"role": m["role"], "content": m["content"]})
            payload: Dict[str, Any] = {
                "model": ep.model_id,
                "messages": anthropic_messages,
                "max_tokens": max_tokens,
                "temperature": temp,
                "stream": stream,
            }
            if system_msg:
                payload["system"] = system_msg
            return url, payload, headers

        elif ep.provider == "google":
            url = f"{ep.base_url}/models/{ep.model_id}:generateContent"
            if stream:
                url += "?alt=sse"
            if ep.api_key:
                url += ("&" if "?" in url else "?") + f"key={ep.api_key}"
            # Simple conversion
            contents = [{"role": m["role"], "parts": [{"text": m["content"]}]} for m in messages if m["role"] != "system"]
            payload = {"contents": contents, "generationConfig": {"temperature": temp, "maxOutputTokens": max_tokens}}
            return url, payload, headers

        else:
            # OpenAI-compatible (openai, deepseek, lm-studio, exo)
            url = f"{ep.base_url}/chat/completions"
            payload = {
                "model": ep.model_id,
                "messages": messages,
                "temperature": temp,
                "max_tokens": max_tokens,
                "stream": stream,
            }
            if tools:
                payload["tools"] = tools
                payload["tool_choice"] = "auto"
            if ep.api_key:
                headers["Authorization"] = f"Bearer {ep.api_key}"
            return url, payload, headers

    def _parse_response(self, ep: LLMEndpoint, data: Dict) -> Dict:
        """Normalize provider response to OpenAI format."""
        if ep.provider == "anthropic":
            content = ""
            tool_calls = []
            for block in data.get("content", []):
                if block.get("type") == "text":
                    content += block.get("text", "")
                elif block.get("type") == "tool_use":
                    tool_calls.append({
                        "id": block.get("id", ""),
                        "type": "function",
                        "function": {
                            "name": block.get("name", ""),
                            "arguments": json.dumps(block.get("input", {})),
                        }
                    })
            return {
                "choices": [{
                    "message": {
                        "role": "assistant",
                        "content": content,
                        "tool_calls": tool_calls if tool_calls else None,
                    },
                    "finish_reason": "tool_calls" if tool_calls else "stop",
                }]
            }
        elif ep.provider == "google":
            parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
            text = "".join(p.get("text", "") for p in parts)
            return {
                "choices": [{
                    "message": {"role": "assistant", "content": text},
                    "finish_reason": "stop",
                }]
            }
        return data

    async def _chat_completion(self, messages: List[Dict], tools: Optional[List[Dict]] = None,
                                max_tokens: int = 2048, temperature: Optional[float] = None) -> Dict[str, Any]:
        ep = self.router.get_primary()
        if not ep:
            raise RuntimeError("No LLM endpoint available")

        url, payload, headers = self._build_request(ep, messages, tools, max_tokens, temperature, stream=False)

        async with httpx.AsyncClient(timeout=ep.timeout) as client:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            return self._parse_response(ep, data)

    # -----------------------------------------------------------------------
    # Streaming LLM call
    # -----------------------------------------------------------------------
    async def _chat_completion_stream(self, messages: List[Dict], tools: Optional[List[Dict]] = None,
                                       max_tokens: int = 2048, temperature: Optional[float] = None) -> AsyncGenerator[Dict[str, Any], None]:
        ep = self.router.get_primary()
        if not ep:
            yield {"type": "error", "data": "No LLM endpoint available"}
            return

        url, payload, headers = self._build_request(ep, messages, tools, max_tokens, temperature, stream=True)

        client = self._get_client()
        async with client.stream("POST", url, json=payload, headers=headers, timeout=ep.timeout) as resp:
                resp.raise_for_status()
                if ep.provider == "anthropic":
                    async for line in resp.aiter_lines():
                        if not line or not line.startswith("data: "):
                            continue
                        data = line[6:]
                        if data == "[DONE]":
                            yield {"type": "done"}
                            break
                        try:
                            chunk = json.loads(data)
                            if chunk.get("type") == "content_block_delta":
                                text = chunk.get("delta", {}).get("text", "")
                                if text:
                                    yield {"type": "content", "data": text}
                            elif chunk.get("type") == "message_stop":
                                yield {"type": "done"}
                                break
                        except Exception as e:
                            logger.warning(f"Anthropic stream parse error: {e}")
                            continue
                else:
                    async for line in resp.aiter_lines():
                        if not line or not line.startswith("data: "):
                            continue
                        data = line[6:]
                        if data == "[DONE]":
                            yield {"type": "done"}
                            break
                        try:
                            chunk = json.loads(data)
                            delta = chunk["choices"][0].get("delta", {})
                            if delta.get("content"):
                                yield {"type": "content", "data": delta["content"]}
                            elif delta.get("tool_calls"):
                                yield {"type": "tool_call_delta", "data": delta["tool_calls"]}
                            elif chunk["choices"][0].get("finish_reason") == "tool_calls":
                                yield {"type": "tool_calls_ready", "data": chunk}
                        except Exception as e:
                            logger.warning(f"Stream parse error: {e}")
                            continue

    # -----------------------------------------------------------------------
    # Tool execution
    # -----------------------------------------------------------------------
    async def _execute_tool(self, tool_call: Dict) -> str:
        func = tool_call.get("function", {})
        tool_name = func.get("name", "")
        try:
            args = json.loads(func.get("arguments", "{}"))
        except Exception:
            args = {}

        # Map to sub-brain tool names
        sub_tool = {
            "execute_shell": "shell",
            "read_file": "file_read",
            "write_file": "file_write",
            "http_request": "http_request",
            "browse_web": "screenshot",
        }.get(tool_name, tool_name)

        try:
            result = await asyncio.wait_for(
                self.sub_brain.execute_tool(sub_tool, args),
                timeout=30.0,
            )
            return json.dumps(result, ensure_ascii=False) if not isinstance(result, str) else result
        except asyncio.TimeoutError:
            return f"Error: Tool '{tool_name}' timed out after 30s"
        except Exception as e:
            return f"Error: {type(e).__name__}: {str(e)}"

    # -----------------------------------------------------------------------
    # Multi-turn chat with recursive tool calling
    # -----------------------------------------------------------------------
    async def chat(self, user_input: str, session_id: str, context: Optional[Dict] = None) -> Dict[str, Any]:
        # Store user message
        await self.memory.store({"level": "L1", "content": user_input, "session_id": session_id, "source": "user"})

        # Retrieve memories
        relevant = await self.memory.query({"query": user_input, "levels": ["L2", "L3"], "limit": 5})
        memory_text = "\n".join([f"- {m.get('content', '')}" for m in relevant]) or "无相关记忆"

        # Build messages
        system_prompt = self._build_system_prompt(memory_text)
        messages: List[Dict] = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_input},
        ]

        available_tools = self._default_tools if (context or {}).get("tools_enabled", True) else None
        all_tool_calls: List[Dict] = []
        all_tool_results: List[Dict] = []

        iteration = 0
        while iteration < MAX_TOOL_ITERATIONS:
            iteration += 1

            # LLM call
            result = await self._chat_completion(messages, tools=available_tools)
            msg = result["choices"][0]["message"]
            tool_calls = msg.get("tool_calls", [])

            if not tool_calls:
                reply = msg.get("content", "")
                await self.memory.store({"level": "L1", "content": f"Assistant: {reply}", "session_id": session_id, "source": "assistant"})
                return {
                    "reply": reply,
                    "tool_calls": all_tool_calls,
                    "tool_results": all_tool_results,
                    "session_id": session_id,
                    "iterations": iteration,
                }

            # Execute tools
            tool_results = []
            for tc in tool_calls:
                result_text = await self._execute_tool(tc)
                tool_results.append({
                    "tool_call_id": tc.get("id", ""),
                    "tool": tc.get("function", {}).get("name", ""),
                    "args": tc.get("function", {}).get("arguments", ""),
                    "result": result_text,
                })
                all_tool_calls.append(tc)
                all_tool_results.append(tool_results[-1])

            # Add assistant message with tool_calls to context
            messages.append(msg)

            # Add tool results
            for tr in tool_results:
                messages.append({
                    "role": "tool",
                    "tool_call_id": tr["tool_call_id"],
                    "content": tr["result"],
                })

            # Continue loop for next LLM decision

        # Max iterations reached
        return {
            "reply": "任务执行轮次过多，请简化您的请求。",
            "tool_calls": all_tool_calls,
            "tool_results": all_tool_results,
            "session_id": session_id,
            "iterations": iteration,
        }

    # -----------------------------------------------------------------------
    # Streaming chat (first iteration only streamed; tool calls are blocking)
    # -----------------------------------------------------------------------
    async def chat_stream(self, user_input: str, session_id: str,
                          context: Optional[Dict] = None) -> AsyncGenerator[Dict[str, Any], None]:
        """Streaming chat. Yields content chunks during LLM generation.
        If tool calls are needed, yields tool_call events and pauses.
        After tool execution, continues with final response."""

        await self.memory.store({"level": "L1", "content": user_input, "session_id": session_id, "source": "user"})

        relevant = await self.memory.query({"query": user_input, "levels": ["L2", "L3"], "limit": 5})
        memory_text = "\n".join([f"- {m.get('content', '')}" for m in relevant]) or "无相关记忆"

        system_prompt = self._build_system_prompt(memory_text)
        messages: List[Dict] = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_input},
        ]

        available_tools = self._default_tools if (context or {}).get("tools_enabled", True) else None
        all_tool_calls: List[Dict] = []
        all_tool_results: List[Dict] = []

        iteration = 0
        while iteration < MAX_TOOL_ITERATIONS:
            iteration += 1

            # First iteration: try streaming
            if iteration == 1:
                full_content = ""
                collected_tool_calls: List[Dict] = []
                has_tool_calls = False

                async for chunk in self._chat_completion_stream(messages, tools=available_tools):
                    if chunk["type"] == "content":
                        full_content += chunk["data"]
                        yield chunk
                    elif chunk["type"] == "tool_call_delta":
                        has_tool_calls = True
                        # Accumulate tool call deltas (simplified)
                        yield {"type": "thinking", "data": "正在思考使用工具..."}
                    elif chunk["type"] == "done":
                        break
                    elif chunk["type"] == "error":
                        yield chunk
                        return

                if not has_tool_calls:
                    # No tool calls needed — done
                    await self.memory.store({"level": "L1", "content": f"Assistant: {full_content}", "session_id": session_id, "source": "assistant"})
                    yield {"type": "done", "data": full_content}
                    return

                # Tool calls detected — fall back to non-streaming for reliable parsing
                yield {"type": "thinking", "data": "检测到需要使用工具，正在执行..."}
                result = await self._chat_completion(messages, tools=available_tools)
            else:
                result = await self._chat_completion(messages, tools=available_tools)

            msg = result["choices"][0]["message"]
            tool_calls = msg.get("tool_calls", [])

            if not tool_calls:
                reply = msg.get("content", "")
                await self.memory.store({"level": "L1", "content": f"Assistant: {reply}", "session_id": session_id, "source": "assistant"})
                yield {"type": "content", "data": reply}
                yield {"type": "done", "data": reply}
                return

            # Execute tools
            tool_results = []
            for tc in tool_calls:
                tool_name = tc.get("function", {}).get("name", "")
                yield {"type": "tool_start", "data": {"name": tool_name, "args": tc.get("function", {}).get("arguments", "")}}

                result_text = await self._execute_tool(tc)

                yield {"type": "tool_end", "data": {"name": tool_name, "result_preview": result_text[:200]}}

                tool_results.append({
                    "tool_call_id": tc.get("id", ""),
                    "tool": tool_name,
                    "args": tc.get("function", {}).get("arguments", ""),
                    "result": result_text,
                })
                all_tool_calls.append(tc)
                all_tool_results.append(tool_results[-1])

            # Update messages for next iteration
            messages.append(msg)
            for tr in tool_results:
                messages.append({
                    "role": "tool",
                    "tool_call_id": tr["tool_call_id"],
                    "content": tr["result"],
                })

        yield {"type": "error", "data": "任务执行轮次过多，请简化您的请求。"}
