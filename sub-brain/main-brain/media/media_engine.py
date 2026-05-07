"""
Media Engine — Local-first TTS and Image Generation

TTS: edge-tts (Microsoft Edge online TTS, free, no API key)
Image: HTTP API to local Stable Diffusion / ComfyUI / EXO cluster
"""

import asyncio
import logging
from pathlib import Path
from typing import Any, Dict, Optional

import httpx

logger = logging.getLogger("webrain.media")


class MediaEngine:
    """Generate media using local or lightweight online services."""

    def __init__(self, output_dir: Optional[str] = None):
        self.output_dir = Path(output_dir or Path.home() / ".webrain" / "media")
        self.output_dir.mkdir(parents=True, exist_ok=True)

    async def text_to_speech(self, text: str, voice: str = "zh-CN-XiaoxiaoNeural", output_format: str = "mp3") -> Dict[str, Any]:
        """Convert text to speech using edge-tts."""
        try:
            import edge_tts
            output_file = self.output_dir / f"tts-{hash(text) % 1000000:06d}.{output_format}"

            communicate = edge_tts.Communicate(text, voice)
            await communicate.save(str(output_file))

            return {
                "ok": True,
                "file_path": str(output_file),
                "file_url": f"/media/files/{output_file.name}",
                "voice": voice,
                "duration_estimate": len(text) * 0.25,
            }
        except Exception as e:
            logger.error(f"TTS failed: {e}")
            return {"ok": False, "error": str(e)}

    async def list_voices(self, locale: str = "zh") -> Dict[str, Any]:
        """List available TTS voices."""
        try:
            import edge_tts
            voices = await edge_tts.list_voices()
            filtered = [v for v in voices if locale.lower() in v["Locale"].lower()]
            return {
                "ok": True,
                "voices": [{"name": v["ShortName"], "locale": v["Locale"], "gender": v["Gender"]} for v in filtered[:20]],
            }
        except Exception as e:
            return {"ok": False, "error": str(e)}

    async def generate_image(self, prompt: str, width: int = 512, height: int = 512, steps: int = 20, sd_url: Optional[str] = None) -> Dict[str, Any]:
        """Generate image via local Stable Diffusion HTTP API."""
        url = sd_url or "http://127.0.0.1:7860/sdapi/v1/txt2img"

        try:
            async with httpx.AsyncClient(timeout=300.0) as client:
                resp = await client.post(url, json={
                    "prompt": prompt,
                    "negative_prompt": "",
                    "width": width,
                    "height": height,
                    "steps": steps,
                    "sampler_name": "Euler a",
                })
                resp.raise_for_status()
                data = resp.json()

                import base64
                from pathlib import Path

                image_b64 = data["images"][0]
                image_bytes = base64.b64decode(image_b64.split(",")[0])
                output_file = self.output_dir / f"img-{hash(prompt) % 1000000:06d}.png"
                output_file.write_bytes(image_bytes)

                return {
                    "ok": True,
                    "file_path": str(output_file),
                    "file_url": f"/media/files/{output_file.name}",
                    "prompt": prompt,
                }
        except Exception as e:
            logger.error(f"Image generation failed: {e}")
            return {"ok": False, "error": str(e)}

    def get_media_file(self, filename: str) -> Optional[bytes]:
        """Read a generated media file."""
        file_path = self.output_dir / filename
        if file_path.exists():
            return file_path.read_bytes()
        return None
