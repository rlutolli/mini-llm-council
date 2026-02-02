"""
Web Search Node - Multi-Provider Free Search

Uses DuckDuckGo as primary (unlimited, no API key required).
Falls back to Brave Search API if available.

All results are formatted as clean markdown for LLM consumption.
"""

import asyncio
import logging
from typing import List, Optional
from dataclasses import dataclass
from ddgs import DDGS

from backend.config import BRAVE_API_KEY

logger = logging.getLogger(__name__)


@dataclass
class SearchResult:
    """Structured search result"""
    title: str
    url: str
    snippet: str
    source: str = "duckduckgo"
    
    def to_markdown(self) -> str:
        return f"### [{self.title}]({self.url})\n{self.snippet}\n"


class WebSearchNode:
    """Multi-provider web search with DuckDuckGo as primary"""
    
    PROVIDERS = ["duckduckgo"]
    
    def __init__(self):
        logger.info("WebSearchNode initialized (DuckDuckGo only)")
    
    async def search(
        self, 
        queries: List[str], 
        max_results: int = 5,
        provider: str = "duckduckgo"
    ) -> List[SearchResult]:
        """
        Execute searches and return structured results via DuckDuckGo.
        """
        loop = asyncio.get_running_loop()
        return await self._search_duckduckgo(queries, max_results, loop)
    
    async def _search_duckduckgo(
        self, 
        queries: List[str], 
        max_results: int,
        loop
    ) -> List[SearchResult]:
        """Search using DuckDuckGo (no API key needed)"""
        all_results = []
        
        def sync_search(query: str):
            try:
                # Create fresh DDGS instance per search
                results = DDGS().text(query, max_results=max_results)
                return [
                    SearchResult(
                        title=r.get("title", ""),
                        url=r.get("href", ""),
                        snippet=r.get("body", ""),
                        source="duckduckgo"
                    )
                    for r in results
                ]
            except Exception as e:
                logger.warning(f"DuckDuckGo search failed: {e}")
                return []
        
        for query in queries:
            results = await loop.run_in_executor(None, sync_search, query)
            all_results.extend(results)
        
        return all_results
    
    def results_to_markdown(self, results: List[SearchResult]) -> str:
        """Convert results to markdown for LLM consumption"""
        if not results:
            return "No search results found."
        
        md = "## Web Search Results\n\n"
        for i, r in enumerate(results, 1):
            md += f"**{i}. [{r.title}]({r.url})**\n"
            md += f"> {r.snippet}\n\n"
        
        return md


# Convenience function for quick searches
async def quick_search(query: str, max_results: int = 5) -> str:
    """Single-query search returning markdown"""
    node = WebSearchNode()
    results = await node.search([query], max_results=max_results)
    return node.results_to_markdown(results)
