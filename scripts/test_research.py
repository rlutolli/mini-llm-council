
import asyncio
import os
import logging
from backend.core.research_graph import ResearchGraph

# Setup logging
logging.basicConfig(level=logging.INFO)

async def test_research_graph():
    graph = ResearchGraph()
    
    query = "What are the latest developments in 1.58-bit large language models?"
    print(f"Starting research for: {query}")
    
    # We'll use a small iteration count for the test
    async for event in graph.research_stream(query, max_iterations=2):
        if event["type"] == "status":
            print(f"[STATUS] {event['content']}")
        elif event["type"] == "report":
            print("\n=== FINAL RESEARCH REPORT ===\n")
            print(event["content"])
            print("\n==============================\n")

if __name__ == "__main__":
    asyncio.run(test_research_graph())
