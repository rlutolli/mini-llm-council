"""
Main FastAPI Application - Hybrid AI Council Backend

Provides endpoints for:
- Chat with streaming responses
- Tab management (show/foreground)
- Health checks

Accepts API keys from frontend for fallback routing.
"""

from fastapi import FastAPI, HTTPException, Header, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, Dict
import json
import asyncio

from backend.services.fallback_router import get_router, APIKeys

app = FastAPI(title="Hybrid AI Council")

# CORS for React Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, lock this down
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    prompt: str
    model_id: str = "council"
    model_name: str = "GPT-4o"
    system_prompt: Optional[str] = None
    fast_mode: bool = False


class APIKeysHeader(BaseModel):
    openrouter: Optional[str] = None
    groq: Optional[str] = None
    google: Optional[str] = None


def parse_api_keys(header: Optional[str]) -> Dict[str, str]:
    """Parse API keys from X-API-Keys header (JSON)."""
    if not header:
        return {}
    try:
        return json.loads(header)
    except:
        return {}


@app.get("/health")
def health():
    """Basic health check endpoint."""
    return {"status": "ok", "system": "Hybrid AI Council"}


@app.get("/api/health/metrics")
def health_metrics():
    """
    Detailed system metrics for monitoring.
    
    Returns RAM, CPU, network stats, and active models.
    """
    from backend.services.metrics import get_metrics_service
    
    service = get_metrics_service()
    metrics = service.get_snapshot()
    budget = service.check_memory_budget()
    
    return {
        "status": "ok",
        "metrics": metrics.to_dict(),
        "memory_budget": budget,
    }


@app.get("/api/council/personas")
def get_personas():
    """Get list of council member personas for frontend."""
    from backend.core.orchestrator import COUNCIL_PERSONAS
    
    return {
        "personas": [
            {
                "id": p.id,
                "name": p.name,
                "title": p.title,
                "color": p.color,
            }
            for p in COUNCIL_PERSONAS.values()
        ]
    }


@app.websocket("/ws/metrics")
async def websocket_metrics(websocket: WebSocket):
    """
    Live system metrics streaming via WebSocket.
    
    Sends JSON snapshots at 1Hz for real-time dashboard updates.
    """
    from backend.services.metrics import get_metrics_service
    
    await websocket.accept()
    service = get_metrics_service()
    
    try:
        while True:
            metrics = service.get_snapshot()
            budget = service.check_memory_budget()
            
            await websocket.send_json({
                "metrics": metrics.to_dict(),
                "memory_budget": budget,
            })
            
            await asyncio.sleep(1)  # 1Hz updates
    except WebSocketDisconnect:
        pass  # Client disconnected
    except Exception as e:
        await websocket.close(code=1011, reason=str(e))

@app.post("/api/warmup")
async def warmup():
    """Initialize browser agent in advance."""
    try:
        router = get_router()
        # Trigger lazy-init
        router._init_browser()
        return {"status": "success", "message": "Browser initialization started"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.post("/api/chat")
async def chat(
    request: ChatRequest,
    x_api_keys: Optional[str] = Header(None, alias="X-API-Keys"),
):
    """
    Stream a chat response from LMArena or fallback APIs.
    
    API keys can be passed via X-API-Keys header as JSON.
    """
    api_keys = parse_api_keys(x_api_keys)
    router = get_router(api_keys)
    
    def event_generator():
        try:
            for chunk in router.chat_stream(
                prompt=request.prompt,
                model_id=request.model_id,
                model_name=request.model_name,
                system_prompt=request.system_prompt,
            ):
                # Format as SSE
                logger.info(f"Streaming chunk for {request.model_id}: {len(chunk)} chars")
                data = json.dumps({"content": chunk, "model": request.model_name})
                yield f"data: {data}\n\n"

            yield "data: [DONE]\n\n"
        except Exception as e:
            error_data = json.dumps({"error": str(e)})
            yield f"data: {error_data}\n\n"
            yield "data: [DONE]\n\n"
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


@app.post("/api/council/deliberate")
async def council_deliberate(
    request: ChatRequest,
    x_api_keys: Optional[str] = Header(None, alias="X-API-Keys"),
):
    """
    Run a full council deliberation with all members using LangGraph.
    
    Streams:
    1. Phase transitions (INIT -> DELIBERATION -> ...)
    2. Parallel opinion chunks
    3. Sequential voting updates
    4. Final decree
    """
    api_keys = parse_api_keys(x_api_keys)
    from backend.core.orchestrator import CouncilOrchestrator
    orchestrator = CouncilOrchestrator()
    
    async def event_generator():
        try:
            async for response in orchestrator.run_council_stream(request.prompt, fast_mode=request.fast_mode):
                # Ensure the response is converted to dict if it's a CouncilResponse object
                # (CouncilOrchestrator yields CouncilResponse objects)
                from backend.models.schemas import CouncilResponse
                
                if isinstance(response, CouncilResponse):
                    data = json.dumps(response.dict())
                else:
                    data = json.dumps(response)
                    
                yield f"data: {data}\n\n"
            
            yield "data: [DONE]\n\n"
        except Exception as e:
            error_data = json.dumps({"type": "error", "content": str(e)})
            yield f"data: {error_data}\n\n"
            yield "data: [DONE]\n\n"
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


@app.post("/api/tabs/{model_id}/show")
async def show_tab(model_id: str):
    """Bring a model's browser tab to focus."""
    try:
        router = get_router()
        if router._browser_agent and model_id in router._browser_agent.active_models:
            tab = router._browser_agent.active_models[model_id]
            router._browser_agent.browser.activate_tab(tab.tab_id)
            return {"status": "success", "model_id": model_id}
        raise HTTPException(status_code=404, detail="Tab not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/agent/show")
async def show_agent_browser():
    """Bring the background browser window to front for manual bypass."""
    try:
        router = get_router()
        if router._browser_agent:
            success = router._browser_agent.show_browser()
            return {"status": "success" if success else "error"}
        raise HTTPException(status_code=404, detail="Agent not initialized")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/challenge/{model_id}/screenshot")
async def get_challenge_screenshot(model_id: str):
    """Get screenshot of challenge page for in-app solving."""
    try:
        router = get_router()
        if router._browser_agent:
            screenshot = router._browser_agent.get_challenge_screenshot(model_id)
            if screenshot:
                return {"screenshot": screenshot, "model_id": model_id}
        raise HTTPException(status_code=404, detail="No screenshot available")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class ClickRequest(BaseModel):
    x: int
    y: int


@app.post("/api/challenge/{model_id}/click")
async def click_challenge(model_id: str, request: ClickRequest):
    """Click at position to solve challenge from frontend."""
    try:
        router = get_router()
        if router._browser_agent:
            success = router._browser_agent.click_at_position(model_id, request.x, request.y)
            if success:
                return {"status": "success", "model_id": model_id}
        raise HTTPException(status_code=400, detail="Click failed")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/models")
def list_models():
    """List available models and their providers."""
    return {
        "lmarena": [
            "GPT-4o", "GPT-4", "GPT-5",
            "Claude 3.5", "Claude 4",
            "Gemini Pro", "Gemini 2.0",
            "Llama 3.3", "Mistral Large",
        ],
        "fallback": {
            "openrouter": ["DeepSeek R1", "Qwen3 32B", "Mistral Small"],
            "groq": ["Llama 3.3 70B", "Gemma 3 9B", "Mixtral 8x7B"],
            "google": ["Gemini 2.0 Flash"],
        },
        "local": {
            "bitnet": "BitNet-b1.58-2B-4T (AVX-512)",
            "ollama": "Llama 3.2:3B"
        }
    }


# === DEEP RESEARCH ENDPOINTS ===

class ResearchRequest(BaseModel):
    query: str
    max_iterations: int = 3  # 1-5, UI configurable


@app.post("/api/research")
async def deep_research(request: ResearchRequest):
    """
    Execute deep research with streaming status updates.
    
    Uses LangGraph cyclic workflow:
    1. Generate search queries
    2. Web search (DuckDuckGo/Brave)
    3. Analyze for gaps
    4. Iterate or synthesize
    """
    from backend.core.research_graph import ResearchGraph, ResearchConfig
    
    # Clamp iterations to 1-5 range
    max_iter = max(1, min(5, request.max_iterations))
    
    config = ResearchConfig(max_iterations=max_iter)
    graph = ResearchGraph(config)
    
    async def event_generator():
        try:
            async for event in graph.research_stream(request.query, max_iter):
                data = json.dumps(event)
                yield f"data: {data}\n\n"
            
            yield "data: [DONE]\n\n"
        except Exception as e:
            error_data = json.dumps({"type": "error", "content": str(e)})
            yield f"data: {error_data}\n\n"
            yield "data: [DONE]\n\n"
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


# === FILE UPLOAD ENDPOINTS ===

from fastapi import UploadFile, File
import tempfile
import os as _os


@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    """
    Upload and process a file for RAG ingestion.
    
    Supports: PDF, Office docs, code files, academic papers.
    Returns processed markdown and adds to knowledge base.
    """
    from backend.services.file_node import FileProcessor
    from backend.services.rag import RAGService
    
    processor = FileProcessor()
    rag = RAGService()
    
    # Save to temp file
    temp_path = None
    try:
        suffix = _os.path.splitext(file.filename)[1] if file.filename else ""
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = await file.read()
            tmp.write(content)
            temp_path = tmp.name
        
        # Process file
        result = processor.process(temp_path)
        
        if result["status"] == "success":
            # Chunk and add to RAG
            chunks = processor.chunk_content(result["content"])
            
            for i, chunk in enumerate(chunks):
                doc_id = f"{file.filename}_{i}"
                rag.add_document(
                    doc_id=doc_id,
                    text=chunk,
                    metadata={
                        "filename": file.filename,
                        "file_type": result["file_type"],
                        "chunk_index": i
                    }
                )
            
            return {
                "status": "success",
                "filename": file.filename,
                "file_type": result["file_type"],
                "chunks_added": len(chunks),
                "preview": result["content"][:500] + "..." if len(result["content"]) > 500 else result["content"]
            }
        else:
            return {
                "status": "error",
                "error": result.get("metadata", {}).get("error", "Processing failed")
            }
    
    except Exception as e:
        return {"status": "error", "error": str(e)}
    
    finally:
        if temp_path and _os.path.exists(temp_path):
            _os.unlink(temp_path)


@app.get("/api/research/settings")
def get_research_settings():
    """Get current research settings for UI."""
    from backend.config import MAX_RESEARCH_ITERATIONS, BRAVE_API_KEY
    
    return {
        "max_iterations": MAX_RESEARCH_ITERATIONS,
        "search_providers": ["duckduckgo"] + (["brave"] if BRAVE_API_KEY else []),
        "default_provider": "duckduckgo"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)

