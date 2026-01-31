"""
Groq API Client - Ultra-fast LLM inference with 14,400 req/day free tier.

Supports:
- Llama 3.3 70B
- Gemma 3 
- Mixtral
"""

import json
import logging
import httpx
from typing import Generator, Optional

logger = logging.getLogger(__name__)

# Free models on Groq (as of Jan 2025)
GROQ_MODELS = {
    "llama-3.3-70b": "llama-3.3-70b-versatile",
    "llama-3.1-8b": "llama-3.1-8b-instant",
    "gemma-3-9b": "gemma2-9b-it",
    "mixtral-8x7b": "mixtral-8x7b-32768",
}


class GroqClient:
    """
    Client for Groq API with streaming support.
    
    Groq offers the fastest LLM inference with generous free tier:
    - 14,400 requests per day
    - No credit card required
    """
    
    BASE_URL = "https://api.groq.com/openai/v1/chat/completions"
    
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize the Groq client.
        
        Args:
            api_key: Groq API key (get free at console.groq.com/keys)
        """
        self.api_key = api_key
        self.timeout = 60.0
    
    def is_configured(self) -> bool:
        """Check if API key is set."""
        return bool(self.api_key)
    
    def chat_stream(
        self,
        prompt: str,
        model: str = "llama-3.3-70b",
        system_prompt: Optional[str] = None
    ) -> Generator[str, None, None]:
        """
        Send a chat message and stream the response.
        
        Args:
            prompt: User's message
            model: Model name (key from GROQ_MODELS or full model ID)
            system_prompt: Optional system message
            
        Yields:
            Response text chunks
        """
        if not self.api_key:
            yield "[Error: Groq API key not configured]"
            return
        
        # Resolve model name
        model_id = GROQ_MODELS.get(model, model)
        
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        
        payload = {
            "model": model_id,
            "messages": messages,
            "stream": True,
        }
        
        try:
            with httpx.Client(timeout=self.timeout) as client:
                with client.stream(
                    "POST",
                    self.BASE_URL,
                    headers=headers,
                    json=payload,
                ) as response:
                    if response.status_code != 200:
                        error_text = response.read().decode()
                        yield f"[Error {response.status_code}: {error_text[:200]}]"
                        return
                    
                    for line in response.iter_lines():
                        if not line:
                            continue
                        
                        if line.startswith("data: "):
                            data = line[6:]
                            
                            if data == "[DONE]":
                                break
                            
                            try:
                                chunk = json.loads(data)
                                if content := chunk.get("choices", [{}])[0].get("delta", {}).get("content"):
                                    yield content
                            except json.JSONDecodeError:
                                continue
                                
        except httpx.TimeoutException:
            yield "[Error: Request timed out]"
        except Exception as e:
            logger.error(f"Groq error: {e}")
            yield f"[Error: {str(e)}]"
    
    def chat(
        self,
        prompt: str,
        model: str = "llama-3.3-70b",
        system_prompt: Optional[str] = None
    ) -> str:
        """Non-streaming chat completion."""
        return "".join(self.chat_stream(prompt, model, system_prompt))
    
    @staticmethod
    def available_models() -> dict:
        """Return dict of available models."""
        return GROQ_MODELS.copy()
