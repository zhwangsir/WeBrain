"""
WeBrain Main Brain → Sub Brain Communication Bridge.

Handles all communication from Hermes (main brain) to OpenClaw (sub brain).
"""

import asyncio
import json
import logging
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger("webrain.bridge")


class SubBrainClient:
    """HTTP client for communicating with the sub-brain (OpenClaw execution layer)."""

    def __init__(self, base_url: str = "http://sub-brain:9797", timeout: float = 30.0):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.client = httpx.AsyncClient(timeout=timeout)

    async def execute_tool(self, tool_name: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a tool via the sub-brain."""
        try:
            response = await self.client.post(
                f"{self.base_url}/tools/execute",
                json={"tool": tool_name, "params": params},
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Tool execution failed: {e}")
            return {"ok": False, "error": str(e)}

    async def send_message(self, channel: str, recipient: str, content: str) -> Dict[str, Any]:
        """Send a message via a channel."""
        try:
            response = await self.client.post(
                f"{self.base_url}/channels/send",
                json={"channel": channel, "recipient": recipient, "content": content},
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Message sending failed: {e}")
            return {"ok": False, "error": str(e)}

    async def list_channels(self) -> List[str]:
        """List available channels."""
        try:
            response = await self.client.get(f"{self.base_url}/channels/list")
            response.raise_for_status()
            data = response.json()
            return data.get("channels", [])
        except Exception as e:
            logger.error(f"Channel listing failed: {e}")
            return []

    async def load_plugin(self, plugin_id: str, config: Optional[Dict] = None) -> Dict[str, Any]:
        """Load a plugin in the sub-brain."""
        try:
            response = await self.client.post(
                f"{self.base_url}/plugins/load",
                json={"plugin_id": plugin_id, "config": config or {}},
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Plugin loading failed: {e}")
            return {"ok": False, "error": str(e)}

    async def list_plugins(self) -> List[Dict[str, Any]]:
        """List loaded plugins."""
        try:
            response = await self.client.get(f"{self.base_url}/plugins/list")
            response.raise_for_status()
            data = response.json()
            return data.get("plugins", [])
        except Exception as e:
            logger.error(f"Plugin listing failed: {e}")
            return []

    async def browse(self, url: str, action: str = "read") -> Dict[str, Any]:
        """Use Dokobot to browse a webpage."""
        try:
            response = await self.client.post(
                f"{self.base_url}/dokobot/browse",
                json={"url": url, "action": action},
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Browsing failed: {e}")
            return {"ok": False, "error": str(e)}

    async def health(self) -> bool:
        """Check sub-brain health."""
        try:
            response = await self.client.get(f"{self.base_url}/health")
            return response.status_code == 200
        except Exception:
            return False

    async def proxy_get(self, path: str) -> Dict[str, Any]:
        """Proxy GET request to sub-brain."""
        try:
            response = await self.client.get(f"{self.base_url}{path}")
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Proxy GET {path} failed: {e}")
            return {"ok": False, "error": str(e)}

    async def proxy_post(self, path: str, body: Dict[str, Any]) -> Dict[str, Any]:
        """Proxy POST request to sub-brain."""
        try:
            response = await self.client.post(f"{self.base_url}{path}", json=body)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Proxy POST {path} failed: {e}")
            return {"ok": False, "error": str(e)}

    async def close(self):
        await self.client.aclose()
