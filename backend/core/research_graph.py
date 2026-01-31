"""
Research Graph - LangGraph Cyclic Deep Research Workflow

Implements the Deep Research pattern from the blueprint:
1. Query Decomposition: Local model breaks prompt into search queries
2. Web Search: DuckDuckGo/Brave retrieves structured results
3. Analysis & Reflection: Cloud model identifies knowledge gaps
4. Iteration: Loop back if gaps found (max N iterations)
5. Final Synthesis: Chairman compiles comprehensive report
"""

import asyncio
import logging
from typing import TypedDict, List, Optional, Annotated
from dataclasses import dataclass, field

from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages

from backend.services.search_node import WebSearchNode, SearchResult
from backend.services.gemini import GeminiCouncilMember
from backend.services.ollama import LocalCouncilMember
from backend.config import MAX_RESEARCH_ITERATIONS

logger = logging.getLogger(__name__)


# State definition for the research graph
class ResearchState(TypedDict):
    """State passed between nodes in the research graph"""
    user_query: str
    search_queries: List[str]
    search_results: List[dict]
    analysis: str
    gaps_found: bool
    iteration_count: int
    max_iterations: int
    final_report: str
    status_updates: Annotated[List[str], add_messages]


@dataclass
class ResearchConfig:
    """Configuration for research workflow"""
    max_iterations: int = MAX_RESEARCH_ITERATIONS
    queries_per_iteration: int = 3
    results_per_query: int = 5


class ResearchGraph:
    """LangGraph-based deep research workflow"""
    
    def __init__(self, config: Optional[ResearchConfig] = None):
        self.config = config or ResearchConfig()
        self.search_node = WebSearchNode()
        self.local_model = None  # Lazy load
        self.cloud_model = None  # Lazy load
        self.graph = self._build_graph()
    
    def _get_local_model(self):
        if self.local_model is None:
            self.local_model = LocalCouncilMember()
        return self.local_model
    
    def _get_cloud_model(self):
        if self.cloud_model is None:
            self.cloud_model = GeminiCouncilMember()
        return self.cloud_model
    
    def _build_graph(self) -> StateGraph:
        """Build the LangGraph workflow"""
        graph = StateGraph(ResearchState)
        
        # Add nodes
        graph.add_node("generate_queries", self._generate_queries_node)
        graph.add_node("web_search", self._web_search_node)
        graph.add_node("analyze", self._analyze_node)
        graph.add_node("synthesize", self._synthesize_node)
        
        # Define edges
        graph.set_entry_point("generate_queries")
        graph.add_edge("generate_queries", "web_search")
        graph.add_edge("web_search", "analyze")
        
        # Conditional edge: continue research or synthesize
        graph.add_conditional_edges(
            "analyze",
            self._should_continue,
            {
                "continue": "generate_queries",
                "done": "synthesize"
            }
        )
        
        graph.add_edge("synthesize", END)
        
        return graph.compile()
    
    async def _generate_queries_node(self, state: ResearchState) -> dict:
        """Generate search queries from user prompt"""
        logger.info(f"Generating queries (iteration {state['iteration_count'] + 1})")
        
        prompt = f"""You are a research assistant. Given the user's question, generate {self.config.queries_per_iteration} specific search queries to find relevant information.

User Question: {state['user_query']}

{"Previous search found gaps in: " + state.get('analysis', '') if state.get('analysis') else ""}

Output ONLY the search queries, one per line, no numbering or explanation."""

        try:
            model = self._get_local_model()
            result = await model.generate_opinion(prompt)
            content = result.get("content", "")
            
            # Parse queries (one per line)
            queries = [q.strip() for q in content.strip().split("\n") if q.strip()]
            queries = queries[:self.config.queries_per_iteration]
            
            if not queries:
                queries = [state["user_query"]]
            
            return {
                "search_queries": queries,
                "status_updates": [f"Generated {len(queries)} search queries"]
            }
        except Exception as e:
            logger.error(f"Query generation failed: {e}")
            return {
                "search_queries": [state["user_query"]],
                "status_updates": ["Using original query (generation failed)"]
            }
    
    async def _web_search_node(self, state: ResearchState) -> dict:
        """Execute web searches"""
        queries = state.get("search_queries", [state["user_query"]])
        logger.info(f"Searching for: {queries}")
        
        try:
            results = await self.search_node.search(
                queries, 
                max_results=self.config.results_per_query
            )
            
            # Convert to dicts for state
            result_dicts = [
                {"title": r.title, "url": r.url, "snippet": r.snippet}
                for r in results
            ]
            
            # Merge with existing results
            existing = state.get("search_results", [])
            all_results = existing + result_dicts
            
            return {
                "search_results": all_results,
                "status_updates": [f"Found {len(results)} new results"]
            }
        except Exception as e:
            logger.error(f"Search failed: {e}")
            return {
                "status_updates": [f"Search error: {str(e)}"]
            }
    
    async def _analyze_node(self, state: ResearchState) -> dict:
        """Analyze results and identify knowledge gaps"""
        results = state.get("search_results", [])
        iteration = state.get("iteration_count", 0) + 1
        max_iter = state.get("max_iterations", self.config.max_iterations)
        
        # Format results for analysis
        results_text = "\n\n".join([
            f"**{r['title']}**\n{r['snippet']}"
            for r in results[-15:]  # Last 15 results
        ])
        
        prompt = f"""You are a research analyst. Analyze these search results for the user's question.

User Question: {state['user_query']}

Search Results:
{results_text}

Determine if the results adequately answer the question.
If there are significant knowledge gaps that more searching could fill, list them briefly.
If the question is well-answered or this is iteration {iteration} of {max_iter}, say "RESEARCH COMPLETE".

Be concise."""

        try:
            model = self._get_cloud_model()
            result = await model.generate_opinion(prompt)
            analysis = result.get("content", "")
            
            # Check if research is complete
            gaps_found = "RESEARCH COMPLETE" not in analysis.upper()
            
            # Force completion if max iterations reached
            if iteration >= max_iter:
                gaps_found = False
            
            return {
                "analysis": analysis,
                "gaps_found": gaps_found,
                "iteration_count": iteration,
                "status_updates": [
                    f"Analysis complete. {'Gaps found, continuing...' if gaps_found else 'Research complete.'}"
                ]
            }
        except Exception as e:
            logger.error(f"Analysis failed: {e}")
            return {
                "analysis": "",
                "gaps_found": False,
                "iteration_count": iteration,
                "status_updates": [f"Analysis error, completing research"]
            }
    
    def _should_continue(self, state: ResearchState) -> str:
        """Decide whether to continue research or synthesize"""
        if state.get("gaps_found", False):
            return "continue"
        return "done"
    
    async def _synthesize_node(self, state: ResearchState) -> dict:
        """Synthesize final research report"""
        results = state.get("search_results", [])
        
        # Format all results
        results_text = "\n\n".join([
            f"### [{r['title']}]({r['url']})\n{r['snippet']}"
            for r in results
        ])
        
        prompt = f"""You are a research synthesizer. Create a comprehensive report answering the user's question based on the research gathered.

User Question: {state['user_query']}

Research Results:
{results_text}

Write a well-structured report with:
1. Executive Summary (2-3 sentences)
2. Key Findings (bullet points)
3. Detailed Analysis
4. Sources (list URLs)

Use markdown formatting."""

        try:
            model = self._get_cloud_model()
            result = await model.generate_opinion(prompt)
            report = result.get("content", "No report generated.")
            
            return {
                "final_report": report,
                "status_updates": ["Final report synthesized"]
            }
        except Exception as e:
            logger.error(f"Synthesis failed: {e}")
            return {
                "final_report": f"Research synthesis failed: {str(e)}",
                "status_updates": ["Synthesis error"]
            }
    
    async def research(
        self, 
        query: str, 
        max_iterations: Optional[int] = None
    ) -> dict:
        """
        Execute deep research on a query.
        
        Args:
            query: User's research question
            max_iterations: Override default max iterations (1-5)
        
        Returns:
            Final research state including report
        """
        initial_state: ResearchState = {
            "user_query": query,
            "search_queries": [],
            "search_results": [],
            "analysis": "",
            "gaps_found": False,
            "iteration_count": 0,
            "max_iterations": max_iterations or self.config.max_iterations,
            "final_report": "",
            "status_updates": [f"Starting research: {query}"]
        }
        
        # Run the graph
        final_state = await self.graph.ainvoke(initial_state)
        
        return final_state
    
    async def research_stream(
        self, 
        query: str, 
        max_iterations: Optional[int] = None
    ):
        """
        Stream research progress updates.
        
        Yields status updates as they occur.
        """
        initial_state: ResearchState = {
            "user_query": query,
            "search_queries": [],
            "search_results": [],
            "analysis": "",
            "gaps_found": False,
            "iteration_count": 0,
            "max_iterations": max_iterations or self.config.max_iterations,
            "final_report": "",
            "status_updates": []
        }
        
        yield {"type": "status", "content": f"Starting research: {query}"}
        
        async for event in self.graph.astream(initial_state):
            for node_name, node_output in event.items():
                if "status_updates" in node_output:
                    for update in node_output["status_updates"]:
                        yield {"type": "status", "content": update}
                
                if "final_report" in node_output and node_output["final_report"]:
                    yield {"type": "report", "content": node_output["final_report"]}


# Convenience function
async def deep_research(query: str, max_iterations: int = 3) -> str:
    """Simple research function returning final report"""
    graph = ResearchGraph(ResearchConfig(max_iterations=max_iterations))
    result = await graph.research(query, max_iterations)
    return result.get("final_report", "Research failed")
