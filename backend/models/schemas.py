from pydantic import BaseModel
from typing import Optional, List, Literal

class ChatRequest(BaseModel):
    prompt: str
    council_size: int = 3 # 1 Local + 1 Groq + 1 Gemini

class CouncilResponse(BaseModel):
    type: Literal["token", "status", "critique", "final", "error", "web_agent", "vote", "complete"]
    source: Optional[str] = None
    content: str
    model: Optional[str] = None
