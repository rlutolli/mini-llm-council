import asyncio
from backend.agent.core import LMSYSAgent

class WebAgentService:
    def __init__(self, headless: bool = False):
        self.agent = LMSYSAgent(headless=headless)
        self.model = "Web-Agent (LMSYS)"

    async def generate_opinion(self, prompt: str) -> dict:
        try:
            # Note: Browser automation is blocking, so we run it in an executor
            # to avoid freezing the FastAPI event loop.
            loop = asyncio.get_running_loop()
            
            # 1. Navigation (if needed)
            await loop.run_in_executor(None, self.agent.navigate_to_direct_chat)
            
            # 2. Select Model (optional, or fixed)
            # await loop.run_in_executor(None, lambda: self.agent.select_model("claude-3-5-sonnet"))
            
            # 3. Chat and Stream
            # Since our Council interface expects a single string or stream, 
            # we need to decide how to handle the generator.
            # For simplicity in this adapter, we will accumulate the full response.
            full_response = ""
            
            def run_sync_chat():
                nonlocal full_response
                for chunk in self.agent.chat_stream(prompt):
                    # In a real impl, we would parse JSON. 
                    # Here we assume chunk is the text delta or needs parsing.
                    # Simplified for blueprint:
                    if isinstance(chunk, bytes):
                        chunk = chunk.decode('utf-8', errors='ignore')
                    full_response += str(chunk) 
                return full_response

            content = await loop.run_in_executor(None, run_sync_chat)
            
            return {
                "source": "Web-Agent",
                "model": self.model,
                "content": content, # This might be raw JSON if not parsed correctly above
                "status": "success",
                "type": "final"
            }
        except Exception as e:
            return {"source": "Web-Agent", "error": str(e), "status": "failed", "type": "error"}

    async def chat_stream(self, prompt: str, model_id: str, model_name: str):
        """
        Streams response from a specific model tab without blocking.
        """
        queue = asyncio.Queue()
        loop = asyncio.get_running_loop()

        def producer():
            try:
                # Sync generator from the agent
                gen = self.agent.chat_stream(prompt, model_id, model_name)
                for chunk in gen:
                    loop.call_soon_threadsafe(queue.put_nowait, chunk)
            except Exception as e:
                loop.call_soon_threadsafe(queue.put_nowait, f"\n[WebAgent Error: {str(e)}]")
            finally:
                loop.call_soon_threadsafe(queue.put_nowait, None)

        async def run_producer():
            await loop.run_in_executor(None, producer)

        asyncio.create_task(run_producer())

        while True:
            chunk = await queue.get()
            if chunk is None:
                break
            yield chunk

    async def close(self):
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(None, self.agent.close)
