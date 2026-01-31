import asyncio
import os
from backend.services.web_agent_adapter import WebAgentService

# Mock config availability if run directly
if "BROWSER_USER_DATA_DIR" not in os.environ:
    os.environ["BROWSER_USER_DATA_DIR"] = os.path.join(os.getcwd(), "data", "browser_profile")

async def test_agent():
    print("Initializing Web Agent (Headful)...")
    service = WebAgentService(headless=False)
    
    print("Generating opinion via LMSYS (Direct Chat)...")
    # A simple prompt that doesn't trigger complex reasoning to keep it fast
    response = await service.generate_opinion("What is the capital of France? Answer in one word.")
    
    print("\n--- Response ---")
    print(response)
    print("----------------")
    
    # Keep browser open for inspection for a few seconds
    await asyncio.sleep(5)
    
    print("Closing agent...")
    await service.close()

if __name__ == "__main__":
    asyncio.run(test_agent())
