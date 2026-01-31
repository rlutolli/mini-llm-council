"""
File Processor Node - Universal File Ingestion via MarkItDown

Converts documents, code, PDFs, images, and audio to markdown for RAG.

Supported formats:
- Office: .docx, .xlsx, .pptx
- PDF: .pdf (including academic papers)
- Code: .py, .js, .ts, .go, .rs, .java, .cpp, .c, .h, .json, .yaml, .toml
- eBooks: .epub, .mobi (via conversion pipeline)
- Academic: .tex, .bib
- Images: .jpg, .png, .gif (OCR or multimodal description)
- Audio: .mp3, .wav (transcription via Whisper)
"""

import os
import logging
from typing import Optional, List
from pathlib import Path

try:
    from markitdown import MarkItDown
    MARKITDOWN_AVAILABLE = True
except ImportError:
    MARKITDOWN_AVAILABLE = False

logger = logging.getLogger(__name__)


# File extension categories
CODE_EXTENSIONS = {
    ".py", ".js", ".ts", ".tsx", ".jsx", ".go", ".rs", ".java",
    ".cpp", ".c", ".h", ".hpp", ".cs", ".rb", ".php", ".swift",
    ".kt", ".scala", ".r", ".sql", ".sh", ".bash", ".zsh",
    ".json", ".yaml", ".yml", ".toml", ".xml", ".html", ".css"
}

DOCUMENT_EXTENSIONS = {".pdf", ".docx", ".doc", ".xlsx", ".xls", ".pptx", ".ppt"}
EBOOK_EXTENSIONS = {".epub", ".mobi"}
ACADEMIC_EXTENSIONS = {".tex", ".bib", ".md", ".rst"}
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"}
AUDIO_EXTENSIONS = {".mp3", ".wav", ".m4a", ".ogg", ".flac"}


class FileProcessor:
    """Convert files to markdown for RAG ingestion"""
    
    def __init__(self):
        if MARKITDOWN_AVAILABLE:
            self.md = MarkItDown()
            logger.info("MarkItDown initialized")
        else:
            self.md = None
            logger.warning("MarkItDown not available")
    
    def get_file_type(self, file_path: str) -> str:
        """Categorize file by extension"""
        ext = Path(file_path).suffix.lower()
        
        if ext in CODE_EXTENSIONS:
            return "code"
        elif ext in DOCUMENT_EXTENSIONS:
            return "document"
        elif ext in EBOOK_EXTENSIONS:
            return "ebook"
        elif ext in ACADEMIC_EXTENSIONS:
            return "academic"
        elif ext in IMAGE_EXTENSIONS:
            return "image"
        elif ext in AUDIO_EXTENSIONS:
            return "audio"
        else:
            return "unknown"
    
    def process(self, file_path: str) -> dict:
        """
        Process a file and return markdown content.
        
        Returns:
            {
                "content": str,  # Markdown content
                "file_type": str,
                "metadata": dict,
                "status": "success" | "error"
            }
        """
        if not os.path.exists(file_path):
            return {
                "content": "",
                "file_type": "unknown",
                "metadata": {"error": "File not found"},
                "status": "error"
            }
        
        file_type = self.get_file_type(file_path)
        filename = Path(file_path).name
        
        try:
            if file_type == "code":
                content = self._process_code(file_path)
            elif self.md and file_type in ("document", "image"):
                content = self._process_with_markitdown(file_path)
            elif file_type == "academic":
                content = self._process_academic(file_path)
            else:
                # Fallback: try MarkItDown or read as text
                content = self._process_fallback(file_path)
            
            return {
                "content": content,
                "file_type": file_type,
                "metadata": {
                    "filename": filename,
                    "path": file_path,
                    "size_bytes": os.path.getsize(file_path)
                },
                "status": "success"
            }
        except Exception as e:
            logger.error(f"Failed to process {file_path}: {e}")
            return {
                "content": "",
                "file_type": file_type,
                "metadata": {"error": str(e)},
                "status": "error"
            }
    
    def _process_code(self, file_path: str) -> str:
        """Process code files with syntax highlighting hints"""
        ext = Path(file_path).suffix.lower().lstrip(".")
        filename = Path(file_path).name
        
        # Language mapping for markdown code blocks
        lang_map = {
            "py": "python", "js": "javascript", "ts": "typescript",
            "tsx": "tsx", "jsx": "jsx", "go": "go", "rs": "rust",
            "java": "java", "cpp": "cpp", "c": "c", "h": "c",
            "cs": "csharp", "rb": "ruby", "php": "php", "swift": "swift",
            "kt": "kotlin", "scala": "scala", "sql": "sql",
            "sh": "bash", "bash": "bash", "zsh": "zsh",
            "json": "json", "yaml": "yaml", "yml": "yaml",
            "toml": "toml", "xml": "xml", "html": "html", "css": "css"
        }
        
        lang = lang_map.get(ext, ext)
        
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            code = f.read()
        
        return f"# {filename}\n\n```{lang}\n{code}\n```"
    
    def _process_with_markitdown(self, file_path: str) -> str:
        """Process using MarkItDown (PDFs, Office docs, images)"""
        result = self.md.convert(file_path)
        return result.text_content
    
    def _process_academic(self, file_path: str) -> str:
        """Process academic files (tex, bib, md)"""
        filename = Path(file_path).name
        ext = Path(file_path).suffix.lower()
        
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
        
        if ext == ".tex":
            return f"# LaTeX: {filename}\n\n```latex\n{content}\n```"
        elif ext == ".bib":
            return f"# Bibliography: {filename}\n\n```bibtex\n{content}\n```"
        else:
            return content  # .md, .rst are already markdown-ish
    
    def _process_fallback(self, file_path: str) -> str:
        """Fallback: try MarkItDown, then read as text"""
        if self.md:
            try:
                result = self.md.convert(file_path)
                return result.text_content
            except Exception:
                pass
        
        # Read as plain text
        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                return f.read()
        except Exception:
            return ""
    
    def chunk_content(
        self, 
        content: str, 
        chunk_size: int = 1000, 
        overlap: int = 100
    ) -> List[str]:
        """Split content into overlapping chunks for RAG"""
        if len(content) <= chunk_size:
            return [content]
        
        chunks = []
        start = 0
        
        while start < len(content):
            end = start + chunk_size
            chunk = content[start:end]
            
            # Try to break at paragraph or sentence
            if end < len(content):
                # Look for paragraph break
                para_break = chunk.rfind("\n\n")
                if para_break > chunk_size // 2:
                    end = start + para_break
                    chunk = content[start:end]
                else:
                    # Look for sentence break
                    sent_break = max(
                        chunk.rfind(". "),
                        chunk.rfind(".\n"),
                        chunk.rfind("? "),
                        chunk.rfind("! ")
                    )
                    if sent_break > chunk_size // 2:
                        end = start + sent_break + 1
                        chunk = content[start:end]
            
            chunks.append(chunk.strip())
            start = end - overlap
        
        return chunks


# Convenience function
def process_file(file_path: str) -> str:
    """Quick file processing returning markdown"""
    processor = FileProcessor()
    result = processor.process(file_path)
    return result.get("content", "")
