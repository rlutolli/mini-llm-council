import chromadb
from chromadb.config import Settings
from backend.config import CHROMA_DB_PATH, EMBEDDING_MODEL
import os

class RAGService:
    def __init__(self):
        # Ensure the directory exists
        os.makedirs(CHROMA_DB_PATH, exist_ok=True)
        
        self.client = chromadb.PersistentClient(path=CHROMA_DB_PATH)
        # We rely on Chroma's default sentence-transformers usage or configure explicitly if needed
        # For simplicity and given the blueprint, we use the default embedding function which downloads all-MiniLM-L6-v2
        
        self.collection = self.client.get_or_create_collection(name="council_knowledge")

    def add_document(self, doc_id: str, text: str, metadata: dict = None):
        if metadata is None:
            metadata = {}
        self.collection.upsert(
            documents=[text],
            metadatas=[metadata],
            ids=[doc_id]
        )

    def query(self, query_text: str, n_results: int = 5) -> list:
        results = self.collection.query(
            query_texts=[query_text],
            n_results=n_results
        )
        # Format results nicely
        documents = results['documents'][0]
        # metadatas = results['metadatas'][0]
        return documents
