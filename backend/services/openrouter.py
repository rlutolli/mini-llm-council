"""
OpenRouter API Client - Access to 25+ free LLM models.

Supports streaming responses and is used as a fallback
when browser models are rate-limited.
"""

import json
import logging
import httpx
from typing import Generator, Optional, Dict, Any

logger = logging.getLogger(__name__)

# Free models available on OpenRouter
FREE_MODELS = {
    "deepseek-r1": "deepseek/deepseek-r1:free",
    "qwen3-32b": "qwen/qwen3-32b:free", 
    "mistral-small": "mistralai/mistral-small-3.1-24b-instruct:free",
    "llama-3.3-70b": "meta-llama/llama-3.3-70b-instruct:free",
    "gemma-3-27b": "google/gemma-3-27b-it:free",
    "nous-hermes-3": "nousresearch/hermes-3-llama-3.1-405b:free",
}


class OpenRouterClient:
    """
    Client for OpenRouter API with streaming support.
    
    OpenRouter provides access to many free models including:
    - DeepSeek R1
    - Qwen3 32B
    - Mistral Small
    - Llama 3.3 70B
    - And more...
    """
    
    BASE_URL = "https://openrouter.ai/api/v1/chat/completions"
    
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize the OpenRouter client.
        
        Args:
            api_key: OpenRouter API key (get free at openrouter.ai/keys)
        """
        self.api_key = api_key
        self.timeout = 90.0
    
    def is_configured(self) -> bool:
        """Check if API key is set."""
        return bool(self.api_key)
    
    def chat_stream(
        self, 
        prompt: str, 
        model: str = "deepseek-r1",
        system_prompt: Optional[str] = None
    ) -> Generator[str, None, None]:
        """
        Send a chat message and stream the response.
        
        Args:
            prompt: User's message
            model: Model name (key from FREE_MODELS or full model ID)
            system_prompt: Optional system message
            
        Yields:
            Response text chunks
        """
        if not self.api_key:
            yield "[Error: OpenRouter API key not configured]"
            return
        
        # Resolve model name
        model_id = FREE_MODELS.get(model, model)
        
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/ai-council",
            "X-Title": "AI Council",
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
            logger.error(f"OpenRouter error: {e}")
            yield f"[Error: {str(e)}]"
    
    def chat(
        self,
        prompt: str,
        model: str = "deepseek-r1",
        system_prompt: Optional[str] = None
    ) -> str:
        """
        Non-streaming chat completion.
        
        Args:
            prompt: User's message
            model: Model name
            system_prompt: Optional system message
            
        Returns:
            Complete response text
        """
        return "".join(self.chat_stream(prompt, model, system_prompt))
    
    @staticmethod
    def available_models() -> Dict[str, str]:
        """Return dict of available free models."""
        return FREE_MODELS.copy()
