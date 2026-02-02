"""
LangGraph Council Orchestrator

State machine-based council deliberation with:
- Parallel opinion streaming
- Sequential voting with cross-references
- Memory-aware model loading
- Council member personas
"""

import asyncio
import json
import logging
from typing import Annotated, TypedDict, Literal, AsyncGenerator, Optional
from dataclasses import dataclass, field
from enum import Enum

from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages

from backend.services.llm_factory import LLMFactory
from backend.services.rag import RAGService
from backend.models.schemas import CouncilResponse
from backend.config import BITNET_MODEL_PATH

logger = logging.getLogger(__name__)


# ============================================================================
# Council Member Personas
# ============================================================================

@dataclass
class CouncilPersona:
    """Defines a council member's identity and behavior"""
    id: str
    name: str
    title: str
    color: str  # Hex color for UI
    model_id: str
    system_prompt: str
    vote_weight: float = 1.0


COUNCIL_PERSONAS = {
    "advocate": CouncilPersona(
        id="advocate",
        name="The Advocate",
        title="Champion of Possibilities",
        color="#10B981",  # Emerald
        model_id="gemini-3-pro",
        system_prompt=(
            "You are The Advocate, Champion of Possibilities. "
            "Be extremely enthusiastic, optimistic, and focus only on the UPSIDE. "
            "Use words like 'Revolutionary', 'Magnificent', and 'Limitless'. "
            "Your role is to find the best possible interpretation and defend it passionately."
        ),
    ),
    "skeptic": CouncilPersona(
        id="skeptic",
        name="The Skeptic",
        title="Guardian of Caution",
        color="#EF4444",  # Ruby
        model_id="grok-4.1-thinking",
        system_prompt=(
            "You are The Skeptic, Guardian of Caution. "
            "Question every assumption and identify fatal risks. "
            "Be cynical, cautious, and demanding of evidence. "
            "Use words like 'Hazardous', 'Unproven', and 'Deceptive'. "
            "Your role is to protect the council from blind spots."
        ),
    ),
    "synthesizer": CouncilPersona(
        id="synthesizer",
        name="The Synthesizer",
        title="Bridge Builder",
        color="#3B82F6",  # Sapphire
        model_id="claude-opus-4-5-20251101-thinking-32k",
        system_prompt=(
            "You are The Synthesizer, Bridge Builder. "
            "Find common ground between opposing viewpoints. "
            "Be diplomatic, balanced, and integrative. "
            "Use words like 'Integration', 'Balance', and 'Harmony'. "
            "Your role is to weave diverse perspectives into coherent insight."
        ),
    ),
    "pragmatist": CouncilPersona(
        id="pragmatist",
        name="The Pragmatist",
        title="Reality Checker",
        color="#F59E0B",  # Amber
        model_id="gpt-5.1-high", 
        system_prompt=(
            "You are The Pragmatist, Reality Checker. "
            "Focus on the 'How' and the cost. "
            "Be blunt, realistic, and impatient with vague ideas. "
            "Use words like 'Budget', 'Logistics', and 'Feasibility'. "
            "Your role is to ground the discussion in practical reality."
        ),
    ),
    "visionary": CouncilPersona(
        id="visionary",
        name="The Visionary",
        title="Future Architect",
        color="#8B5CF6",  # Violet
        model_id="gpt-5.2",
        system_prompt=(
            "You are The Visionary, Future Architect. "
            "Consider the 50-year impact and legacy. "
            "Be philosophical, abstract, and focus on meaning. "
            "Use words like 'Destiny', 'Legacy', and 'Transcendence'. "
            "Your role is to expand the council's temporal horizon."
        ),
    ),
}


# ============================================================================
# State Definition
# ============================================================================

class CouncilPhase(str, Enum):
    INIT = "init"
    DELIBERATION = "deliberation"
    VOTING = "voting"
    SYNTHESIS = "synthesis"
    COMPLETE = "complete"


class CouncilState(TypedDict):
    """State passed through the LangGraph workflow"""
    # Input
    user_prompt: str
    rag_context: str
    
    # Phase tracking
    phase: CouncilPhase
    
    # Deliberation results
    opinions: dict  # {persona_id: opinion_text}
    
    # Voting results  
    votes: dict  # {persona_id: "yes" | "no" | "abstain"}
    vote_reasoning: dict  # {persona_id: reasoning_text}
    
    # Final output
    synthesis: str
    decree: str
    
    # Memory management
    active_model: str  # Currently loaded local model
    model_mutex: bool  # Lock for model switching


# ============================================================================
# LangGraph Orchestrator
# ============================================================================

class LangGraphOrchestrator:
    """
    State machine-based council orchestration using LangGraph.
    
    Workflow:
        INIT → DELIBERATION → VOTING → SYNTHESIS → COMPLETE
        
    Features:
        - Parallel streaming of opinions during deliberation
        - Sequential voting with cross-references
        - Memory-aware local model switching (BitNet ↔ Ollama mutex)
        - Rich persona-based prompting
    """
    
    def __init__(self):
        self.rag = RAGService()
        self.local = LLMFactory.create_local()
        self.groq = LLMFactory.create_groq()
        self.gemini = LLMFactory.create_gemini()
        self.web_agent = LLMFactory.create_web_agent(headless=False)
        
        # Try to use BitNet if available
        try:
            self.bitnet = LLMFactory.create_hybrid_local()
            self.has_bitnet = self.bitnet.bitnet.is_available
        except Exception:
            self.bitnet = None
            self.has_bitnet = False
        
        self._model_lock = asyncio.Lock()
        self._active_local_model = None
        
        # Build the state graph
        self.graph = self._build_graph()
    
    def _build_graph(self) -> StateGraph:
        """Construct the LangGraph state machine"""
        workflow = StateGraph(CouncilState)
        
        # Add nodes
        workflow.add_node("init", self._node_init)
        workflow.add_node("deliberation", self._node_deliberation)
        workflow.add_node("voting", self._node_voting)
        workflow.add_node("synthesis", self._node_synthesis)
        
        # Add edges
        workflow.set_entry_point("init")
        workflow.add_edge("init", "deliberation")
        workflow.add_edge("deliberation", "voting")
        workflow.add_edge("voting", "synthesis")
        workflow.add_edge("synthesis", END)
        
        return workflow.compile()
    
    async def _node_init(self, state: CouncilState) -> CouncilState:
        """Initialize council session with RAG context"""
        # Query RAG for relevant context
        context = ""
        try:
            results = self.rag.query(state["user_prompt"], n_results=3)
            if results and results.get("documents"):
                context = "\n\n".join(results["documents"][0])
        except Exception as e:
            logger.warning(f"RAG query failed: {e}")
        
        return {
            **state,
            "phase": CouncilPhase.DELIBERATION,
            "rag_context": context,
            "opinions": {},
            "votes": {},
            "vote_reasoning": {},
        }
    
    async def _node_deliberation(self, state: CouncilState) -> CouncilState:
        """
        Parallel deliberation phase - all personas speak simultaneously.
        Note: Actual streaming is handled in run_council_stream().
        """
        # This node just validates state transition
        return {
            **state,
            "phase": CouncilPhase.VOTING,
        }
    
    async def _node_voting(self, state: CouncilState) -> CouncilState:
        """Sequential voting phase - each persona reviews and votes"""
        return {
            **state,
            "phase": CouncilPhase.SYNTHESIS,
        }
    
    async def _node_synthesis(self, state: CouncilState) -> CouncilState:
        """Final synthesis by the chairman (Gemini)"""
        transcript = self._format_transcript(state["opinions"])
        vote_summary = self._format_votes(state["votes"])
        
        synthesis_prompt = (
            f"You are the Chairman of the AI Council. "
            f"Based on the deliberations and votes, synthesize a final decree.\n\n"
            f"TOPIC: {state['user_prompt']}\n\n"
            f"DELIBERATIONS:\n{transcript}\n\n"
            f"VOTES:\n{vote_summary}\n\n"
            f"Provide an authoritative, balanced final decree that acknowledges "
            f"the key points raised and the voting outcome."
        )
        
        response = await self.gemini.generate_opinion(synthesis_prompt)
        decree = response.get("content", "The Council has reached no consensus.")
        
        return {
            **state,
            "phase": CouncilPhase.COMPLETE,
            "decree": decree,
        }
    
    # ========================================================================
    # Streaming Council Execution
    # ========================================================================
    
    async def run_council_stream(
        self, 
        user_prompt: str,
        fast_mode: bool = False
    ) -> AsyncGenerator[CouncilResponse, None]:
        """
        Execute the council with real-time streaming.
        
        Yields CouncilResponse objects for each event:
            - status: Phase transitions
            - token: Streaming tokens from personas
            - complete: Persona finished speaking
            - vote: Vote cast
            - final: Final decree
        """
        # Initialize state
        state: CouncilState = {
            "user_prompt": user_prompt,
            "rag_context": "",
            "phase": CouncilPhase.INIT,
            "opinions": {},
            "votes": {},
            "vote_reasoning": {},
            "synthesis": "",
            "decree": "",
            "active_model": "",
            "model_mutex": False,
        }
        
        # --- INIT ---
        yield CouncilResponse(type="status", content="Initializing Council Session...")
        state = await self._node_init(state)
        
        if state["rag_context"]:
            yield CouncilResponse(
                type="status", 
                content=f"Retrieved {len(state['rag_context'])} chars of context from knowledge base"
            )
        
        # --- DELIBERATION (Parallel Streaming) ---
        yield CouncilResponse(
            type="status", 
            content="Summoning the Council for Parallel Deliberation..."
        )
        
        # Stream all personas in parallel
        queue = asyncio.Queue()
        personas = list(COUNCIL_PERSONAS.values())
        
        async def stream_persona(persona: CouncilPersona, q: asyncio.Queue, is_fast: bool):
            """Stream a single persona's opinion using either local or cloud models"""
            prompt = (
                f"{persona.system_prompt}\n\n"
                f"TOPIC: {user_prompt}\n\n"
                f"Provide your opening deliberation. State your title and stance clearly."
            )
            
            try:
                # Use local models if Fast Mode is active, or if explicitly requested
                use_local = is_fast or persona.model_id in ["local", "bitnet", "ollama"]
                
                if use_local:
                    # Use the hybrid local member (BitNet with Ollama fallback)
                    yield_chunk = ""
                    # Note: currently HybridLocalMember (bitnet_node.py) has a simple generate_opinion
                    # but we should ideally stream from it too.
                    # For now, we'll use generate_opinion and manually put it into chunks if it's not streaming.
                    result = await self.bitnet.generate_opinion(prompt)
                    content = result.get("content", "")
                    
                    # Split into fake chunks to maintain streaming UI feel if necessary
                    # but better if we had a real streamer.
                    for i in range(0, len(content), 32):
                        chunk = content[i:i+32]
                        await q.put(CouncilResponse(
                            type="token",
                            source=persona.id,
                            content=chunk
                        ))
                else:
                    # Use the standard web-agent browser flow for cloud models
                    async for chunk in self.web_agent.chat_stream(
                        prompt, 
                        persona.model_id, 
                        persona.model_id
                    ):
                        await q.put(CouncilResponse(
                            type="token",
                            source=persona.id,
                            content=chunk
                        ))
            except Exception as e:
                logger.error(f"Persona {persona.id} failed: {e}")
                await q.put(CouncilResponse(
                    type="error",
                    source=persona.id,
                    content=str(e)
                ))
            
            await q.put(CouncilResponse(
                type="complete",
                source=persona.id,
                content=""
            ))
        
        # Launch all personas
        tasks = [
            asyncio.create_task(stream_persona(p, queue, fast_mode)) 
            for p in personas
        ]
        
        finished = 0
        while finished < len(personas):
            response = await queue.get()
            
            if response.type == "complete":
                finished += 1
            elif response.type == "token":
                # Accumulate opinion
                state["opinions"][response.source] = (
                    state["opinions"].get(response.source, "") + response.content
                )
                yield response
            else:
                yield response
        
        # --- VOTING (Sequential) ---
        yield CouncilResponse(
            type="status",
            content="Deliberations complete. Calling for votes..."
        )
        
        transcript = self._format_transcript(state["opinions"])
        
        for persona in personas:
            yield CouncilResponse(
                type="status",
                content=f"{persona.name} is reviewing and casting vote..."
            )
            
            vote_prompt = (
                f"{persona.system_prompt}\n\n"
                f"You have heard the following deliberations:\n\n"
                f"{transcript}\n\n"
                f"Respond to at least one point made by another member. "
                f"Then cast your final vote on: '{user_prompt}'\n\n"
                f"Start your response with VOTE: [YES/NO/ABSTAIN]."
            )
            
            vote_text = ""
            async for chunk in self.web_agent.chat_stream(
                vote_prompt,
                persona.model_id,
                persona.model_id
            ):
                vote_text += chunk
                yield CouncilResponse(
                    type="token",
                    source=f"{persona.id}_vote",
                    content=chunk
                )
            
            # Parse vote
            vote = "abstain"
            upper_text = vote_text.upper()
            if "VOTE: YES" in upper_text:
                vote = "yes"
            elif "VOTE: NO" in upper_text:
                vote = "no"
            
            state["votes"][persona.id] = vote
            state["vote_reasoning"][persona.id] = vote_text
            
            yield CouncilResponse(
                type="vote",
                source=persona.id,
                content=vote
            )
        
        # --- SYNTHESIS ---
        yield CouncilResponse(
            type="status",
            content="Chairman is synthesizing the final decree..."
        )
        
        state = await self._node_synthesis(state)
        
        yield CouncilResponse(
            type="final",
            source="Chairman",
            content=state["decree"]
        )
        
        # Emit vote tally for visualization
        tally = {
            "yes": list(state["votes"].values()).count("yes"),
            "no": list(state["votes"].values()).count("no"),
            "abstain": list(state["votes"].values()).count("abstain"),
        }
        yield CouncilResponse(
            type="tally",
            content=json.dumps(tally)
        )
    
    # ========================================================================
    # Memory-Aware Model Loading
    # ========================================================================
    
    async def _ensure_model(self, model_type: Literal["bitnet", "ollama"]) -> bool:
        """
        Ensure the specified local model is loaded.
        Uses mutex to prevent simultaneous loading.
        
        Returns True if model is ready.
        """
        async with self._model_lock:
            if self._active_local_model == model_type:
                return True
            
            # Unload current model if different
            if self._active_local_model == "ollama":
                await self.local.unload_model()
                logger.info("Unloaded Ollama model")
            
            # Load requested model
            if model_type == "bitnet":
                if not self.has_bitnet:
                    logger.warning("BitNet not available, falling back to Ollama")
                    model_type = "ollama"
                else:
                    logger.info("BitNet is already resident (no explicit load needed)")
        
            if model_type == "ollama":
                # Ollama loads on first request, just mark as active
                logger.info("Ollama will load on next request")
            
            self._active_local_model = model_type
            return True
    
    # ========================================================================
    # Helpers
    # ========================================================================
    
    def _format_transcript(self, opinions: dict) -> str:
        """Format opinions into a readable transcript"""
        lines = []
        for persona_id, text in opinions.items():
            persona = COUNCIL_PERSONAS.get(persona_id)
            name = persona.name if persona else persona_id.capitalize()
            lines.append(f"## {name}\n{text}\n")
        return "\n".join(lines)
    
    def _format_votes(self, votes: dict) -> str:
        """Format votes into a summary"""
        lines = []
        for persona_id, vote in votes.items():
            persona = COUNCIL_PERSONAS.get(persona_id)
            name = persona.name if persona else persona_id.capitalize()
            emoji = {"yes": "✓", "no": "✗", "abstain": "△"}.get(vote, "?")
            lines.append(f"{emoji} {name}: {vote.upper()}")
        return "\n".join(lines)
    
    def get_personas(self) -> list[dict]:
        """Get persona list for frontend"""
        return [
            {
                "id": p.id,
                "name": p.name,
                "title": p.title,
                "color": p.color,
            }
            for p in COUNCIL_PERSONAS.values()
        ]


# ============================================================================
# Backward Compatibility - Original CouncilOrchestrator interface
# ============================================================================

class CouncilOrchestrator(LangGraphOrchestrator):
    """
    Backward-compatible wrapper for the new LangGraph orchestrator.
    Maintains the same interface as the original.
    """
    
    async def warmup_council(self):
        """Pre-initialize model tabs"""
        mapping = {p.id: p.model_id for p in COUNCIL_PERSONAS.values()}
        logger.info("Turbo Warmup: Summoning Council Members...")
        
        tasks = []
        for mid, mod in mapping.items():
            tasks.append(
                asyncio.to_thread(self.web_agent.agent.get_model_tab, mid, mod)
            )
        
        await asyncio.gather(*tasks)
        logger.info("Council is warm and ready.")
    
    async def run_council(self, user_prompt: str):
        """
        Execute council - yields CouncilResponse objects.
        Wraps the new streaming implementation.
        """
        async for response in self.run_council_stream(user_prompt):
            yield response
