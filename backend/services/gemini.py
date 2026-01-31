try:
    import google.generativeai as genai
except ImportError:
    genai = None

import asyncio
from backend.config import GEMINI_API_KEY, GEMINI_RPM_LIMIT, SMART_CLOUD_MODEL
from backend.core.rate_limiter import RateLimitManager

class GeminiCouncilMember:
    def __init__(self, api_key: str = GEMINI_API_KEY, model: str = SMART_CLOUD_MODEL):
        if not genai:
            raise ImportError("google-generativeai package is not installed.")
        
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel(model)
        self.limiter = RateLimitManager("gemini", rpm_limit=GEMINI_RPM_LIMIT)

    async def generate_opinion(self, prompt: str) -> dict:
        # Wait for token availability
        await self.limiter.wait_for_token()
        
        try:
            # Run in executor because genai is synchronous blocking
            loop = asyncio.get_running_loop()
            response = await loop.run_in_executor(
                None, 
                lambda: self.model.generate_content(prompt)
            )
            
            return {
                "source": "Gemini-Cloud",
                "model": self.model.model_name,
                "content": response.text,
                "status": "success",
                "type": "final"
            }
        except Exception as e:
            # Handle API errors gracefully
            return {"source": "Gemini-Cloud", "error": str(e), "status": "failed", "type": "error"}
