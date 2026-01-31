"""
Fallback Router - Smart routing between LMArena browser and API fallbacks.

Orchestrates:
1. Try LMArena browser agent first
2. If rate-limited, switch to configured API fallback
3. Notify user of fallback via special token
"""

import logging
from typing import Generator, Optional, Dict, Any
from dataclasses import dataclass

from backend.agent.core import LMSYSAgent, RateLimitError
from backend.services.openrouter import OpenRouterClient
from backend.services.groq import GroqClient

logger = logging.getLogger(__name__)


# Default fallback mapping: LMArena model -> (provider, fallback_model)
DEFAULT_FALLBACKS = {
    "gpt-4o": ("openrouter", "deepseek-r1"),
    "gpt-4": ("openrouter", "deepseek-r1"),
    "gpt-5": ("openrouter", "deepseek-r1"),
    "claude-3.5": ("openrouter", "qwen3-32b"),
    "claude-4": ("openrouter", "qwen3-32b"),
    "gemini-pro": ("google", "gemini-2.0-flash"),
    "gemini": ("google", "gemini-2.0-flash"),
    "llama-3.3": ("groq", "llama-3.3-70b"),
    "llama": ("groq", "llama-3.3-70b"),
    "mistral": ("openrouter", "mistral-small"),
}


@dataclass
class APIKeys:
    """Container for user's API keys."""
    openrouter: Optional[str] = None
    groq: Optional[str] = None
    google: Optional[str] = None


class FallbackRouter:
    """
    Routes chat requests to LMArena browser first, then API fallbacks.
    
    Features:
    - Primary: LMArena browser agent
    - Fallback: OpenRouter, Groq, Google AI (if keys configured)
    - Rate-limit detection and automatic fallback
    - User notifications via special tokens
    """
    
    def __init__(self, api_keys: Optional[APIKeys] = None, headless: bool = False):
        """
        Initialize the router.
        
        Args:
            api_keys: User's optional API keys for fallbacks
            headless: Run browser in headless mode (False to allow Cloudflare verification)
        """
        self.api_keys = api_keys or APIKeys()
        self.headless = headless
        
        self._browser_agent: Optional[LMSYSAgent] = None
        self._openrouter: Optional[OpenRouterClient] = None
        self._groq: Optional[GroqClient] = None
        
    def _init_browser(self) -> LMSYSAgent:
        """Lazy-init browser agent."""
        if self._browser_agent is None:
            self._browser_agent = LMSYSAgent(headless=self.headless)
        return self._browser_agent
    
    def _get_openrouter(self) -> Optional[OpenRouterClient]:
        """Get OpenRouter client if configured."""
        if self._openrouter is None and self.api_keys.openrouter:
            self._openrouter = OpenRouterClient(self.api_keys.openrouter)
        return self._openrouter
    
    def _get_groq(self) -> Optional[GroqClient]:
        """Get Groq client if configured."""
        if self._groq is None and self.api_keys.groq:
            self._groq = GroqClient(self.api_keys.groq)
        return self._groq
    
    def chat_stream(
        self,
        prompt: str,
        model_id: str,
        model_name: str,
        system_prompt: Optional[str] = None,
    ) -> Generator[str, None, None]:
        """
        Stream a chat response, with automatic fallback on rate-limit.
        
        Args:
            prompt: User's prompt
            model_id: Unique model identifier
            model_name: Display name for model selection
            system_prompt: Optional system message (for API fallbacks)
            
        Yields:
            Response chunks, may include [FALLBACK:...] notification
        """
        try:
            # 1. Try LMArena browser first
            agent = self._init_browser()
            
            for chunk in agent.chat_stream(prompt, model_id, model_name):
                yield chunk
                
        except RateLimitError as e:
            logger.warning(f"Rate limited: {e.model_id} ({e.challenge_type})")
            
            # 2. Try fallback
            fallback_gen = self._try_fallback(prompt, model_name, system_prompt)
            
            if fallback_gen:
                yield from fallback_gen
            else:
                # No fallback configured
                yield f"\n[RATE_LIMITED:{model_name}]"
                yield "\n[Configure API keys in Settings for automatic fallback]"
                
        except Exception as e:
            logger.error(f"Router error: {e}")
            yield f"\n[Error: {str(e)}]"
    
    def _try_fallback(
        self,
        prompt: str,
        model_name: str,
        system_prompt: Optional[str] = None,
    ) -> Optional[Generator[str, None, None]]:
        """
        Try to use an API fallback for a rate-limited model.
        
        Returns generator if fallback available, None otherwise.
        """
        # Find fallback mapping
        model_key = model_name.lower().replace(" ", "-")
        fallback = None
        
        for key, (provider, fallback_model) in DEFAULT_FALLBACKS.items():
            if key in model_key:
                fallback = (provider, fallback_model)
                break
        
        if not fallback:
            # Use default fallback
            fallback = ("openrouter", "deepseek-r1")
        
        provider, fallback_model = fallback
        
        # Get appropriate client
        if provider == "openrouter":
            client = self._get_openrouter()
            if client:
                logger.info(f"Falling back to OpenRouter: {fallback_model}")
                return self._wrap_fallback(
                    client.chat_stream(prompt, fallback_model, system_prompt),
                    model_name,
                    fallback_model,
                    "OpenRouter"
                )
                
        elif provider == "groq":
            client = self._get_groq()
            if client:
                logger.info(f"Falling back to Groq: {fallback_model}")
                return self._wrap_fallback(
                    client.chat_stream(prompt, fallback_model, system_prompt),
                    model_name,
                    fallback_model,
                    "Groq"
                )
        
        return None
    
    def _wrap_fallback(
        self,
        generator: Generator[str, None, None],
        original_model: str,
        fallback_model: str,
        provider: str,
    ) -> Generator[str, None, None]:
        """Wrap fallback generator with notification."""
        yield f"[FALLBACK:{original_model}→{fallback_model}@{provider}]\n"
        yield from generator
    
    def close(self):
        """Clean up resources."""
        if self._browser_agent:
            self._browser_agent.close()


# Singleton instance
_router: Optional[FallbackRouter] = None


def get_router(api_keys: Optional[Dict[str, str]] = None, headless: bool = False) -> FallbackRouter:
    """Get or create the singleton router instance. Headless=False by default for Cloudflare."""
    global _router
    
    keys = APIKeys(
        openrouter=api_keys.get("openrouter") if api_keys else None,
        groq=api_keys.get("groq") if api_keys else None,
        google=api_keys.get("google") if api_keys else None,
    )
    
    if _router is None:
        _router = FallbackRouter(keys, headless)
    else:
        # Update keys if provided
        if api_keys:
            _router.api_keys = keys
            _router._openrouter = None  # Reset to pick up new key
            _router._groq = None
    
    return _router
