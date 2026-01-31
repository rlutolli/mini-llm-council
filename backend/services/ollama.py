import asyncio
from ollama import AsyncClient
from backend.config import OLLAMA_KEEP_ALIVE_ACTIVE, OLLAMA_KEEP_ALIVE_IDLE, LOCAL_MODEL, OLLAMA_HOST, MAX_LOCAL_CONTEXT

class LocalCouncilMember:
    def __init__(self, model_name: str = LOCAL_MODEL, host: str = OLLAMA_HOST):
        self.client = AsyncClient(host=host)
        self.model = model_name

    async def generate_opinion(self, prompt: str) -> dict:
        try:
            # Use keep_alive to maintain residency during generation
            response = await self.client.chat(
                model=self.model,
                messages=[{'role': 'user', 'content': prompt}],
                keep_alive=OLLAMA_KEEP_ALIVE_ACTIVE,
                options={
                    "temperature": 0.7,
                    "num_ctx": MAX_LOCAL_CONTEXT, # Hard limit for RAM safety
                    "num_thread": 4  # Limit threads to avoid starving I/O
                }
            )
            return {
                "source": "Local-Ollama",
                "model": self.model,
                "content": response['message']['content'],
                "status": "success",
                "type": "final" 
            }
        except Exception as e:
            return {"source": "Local-Ollama", "error": str(e), "status": "failed", "type": "error"}

    async def unload(self):
        """Force unload to free RAM for other tasks"""
        try:
            # Sending an empty generate request with keep_alive=0 forces unload
            # We use a dummy prompt and don't expect a meaningful response
            await self.client.generate(model=self.model, prompt="", keep_alive=0)
        except Exception:
            pass # Ignore errors during unload
