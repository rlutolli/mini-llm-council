from backend.services.ollama import LocalCouncilMember
from backend.services.groq import GroqClient
from backend.services.gemini import GeminiCouncilMember

class LLMFactory:
    @staticmethod
    def create_local():
        return LocalCouncilMember()

    @staticmethod
    def create_groq():
        from backend.config import GROQ_API_KEY
        return GroqClient(api_key=GROQ_API_KEY)

    @staticmethod
    def create_gemini():
        return GeminiCouncilMember()

    @staticmethod
    def create_web_agent(headless: bool = False):
        from backend.services.web_agent_adapter import WebAgentService
        return WebAgentService(headless=headless)
    
    @staticmethod
    def create_bitnet():
        """Create BitNet member for AVX-512 optimized local inference"""
        from backend.services.bitnet_node import BitNetMember
        return BitNetMember()
    
    @staticmethod
    def create_hybrid_local():
        """Create hybrid local member (BitNet primary, Ollama fallback)"""
        from backend.services.bitnet_node import HybridLocalMember
        return HybridLocalMember()
    
    @staticmethod
    def create_search_node():
        """Create web search node (DuckDuckGo/Brave)"""
        from backend.services.search_node import WebSearchNode
        return WebSearchNode()
    
    @staticmethod
    def create_file_processor():
        """Create file processor for RAG ingestion"""
        from backend.services.file_node import FileProcessor
        return FileProcessor()

