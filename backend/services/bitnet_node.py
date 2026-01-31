"""
BitNet Service Adapter - AVX-512 Optimized Local Inference

Uses Microsoft's bitnet.cpp for ultra-fast 1.58-bit inference on Ice Lake CPUs.
Falls back to Ollama if BitNet is not available.

Memory: ~1.2GB for 2B ternary model
Speed: 2.37x-6.17x faster than standard inference via AVX-512

Setup:
    git clone https://github.com/microsoft/BitNet.git ~/bitnet
    cd ~/bitnet && pip install -r requirements.txt
    python setup_env.py -md models/BitNet-b1.58-2B-4T
"""

import asyncio
import subprocess
import os
import logging
from typing import AsyncGenerator, Optional

from backend.config import BITNET_MODEL_PATH, BITNET_EXECUTABLE

logger = logging.getLogger(__name__)


class BitNetMember:
    """Ultra-fast 1.58-bit local inference using bitnet.cpp with AVX-512"""
    
    def __init__(self, model_path: str = BITNET_MODEL_PATH):
        self.model_path = model_path
        self.executable = BITNET_EXECUTABLE
        self._available = self._check_availability()
        
        if self._available:
            logger.info(f"BitNet initialized: {model_path}")
        else:
            logger.warning("BitNet not available, will fall back to Ollama")
    
    def _check_availability(self) -> bool:
        """Check if BitNet model and executable exist"""
        if not os.path.exists(self.executable):
            return False
        if not os.path.exists(self.model_path):
            return False
        return True
    
    @property
    def is_available(self) -> bool:
        return self._available
    
    async def generate(self, prompt: str, max_tokens: int = 512) -> AsyncGenerator[str, None]:
        """Stream tokens from BitNet inference"""
        if not self._available:
            raise RuntimeError("BitNet not available")
        
        loop = asyncio.get_running_loop()
        
        # Build command for bitnet.cpp
        cmd = [
            "python", self.executable,
            "-m", self.model_path,
            "-p", prompt,
            "-n", str(max_tokens),
            "-t", "4",  # 4 threads for i7
        ]
        
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        
        # Stream stdout
        while True:
            chunk = await process.stdout.read(64)
            if not chunk:
                break
            yield chunk.decode('utf-8', errors='ignore')
        
        await process.wait()
    
    async def generate_opinion(self, prompt: str) -> dict:
        """Generate full response (compatible with council interface)"""
        if not self._available:
            return {
                "source": "BitNet",
                "error": "BitNet not installed. Run setup at ~/bitnet",
                "status": "unavailable",
                "type": "error"
            }
        
        try:
            full_response = ""
            async for chunk in self.generate(prompt):
                full_response += chunk
            
            return {
                "source": "BitNet-Local",
                "model": "BitNet-b1.58-2B-4T",
                "content": full_response.strip(),
                "status": "success",
                "type": "final"
            }
        except Exception as e:
            logger.error(f"BitNet generation failed: {e}")
            return {
                "source": "BitNet-Local",
                "error": str(e),
                "status": "failed",
                "type": "error"
            }
    
    async def unload(self):
        """BitNet doesn't need explicit unloading (subprocess cleanup)"""
        pass


class HybridLocalMember:
    """Hybrid local inference: BitNet primary, Ollama fallback"""
    
    def __init__(self):
        self.bitnet = BitNetMember()
        self._ollama = None  # Lazy load
    
    @property
    def ollama(self):
        if self._ollama is None:
            from backend.services.ollama import LocalCouncilMember
            self._ollama = LocalCouncilMember()
        return self._ollama
    
    async def generate_opinion(self, prompt: str, prefer_bitnet: bool = True) -> dict:
        """Generate with automatic fallback"""
        if prefer_bitnet and self.bitnet.is_available:
            result = await self.bitnet.generate_opinion(prompt)
            if result.get("status") == "success":
                return result
            logger.info("BitNet failed, falling back to Ollama")
        
        # Fallback to Ollama
        return await self.ollama.generate_opinion(prompt)
    
    async def unload(self):
        """Unload Ollama model to free RAM"""
        if self._ollama:
            await self._ollama.unload()
