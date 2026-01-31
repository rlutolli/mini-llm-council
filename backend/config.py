import os
from dotenv import load_dotenv

load_dotenv()

# --- Hardware Constraints (Target: 16GB RAM) ---
# We limit the context window for local models to prevent OOM
MAX_LOCAL_CONTEXT = 4096 

# Ollama Keep-Alive Settings
# During an active discussion, we keep the model loaded (e.g., for 5 minutes)
OLLAMA_KEEP_ALIVE_ACTIVE = "5m"
# When the session ends or we switch to a heavy cloud task, we unload immediately
OLLAMA_KEEP_ALIVE_IDLE = "0"

# --- API Limits (buffers applied) ---
# Gemini Flash free tier is ~15 RPM. We set a safe limit.
GEMINI_RPM_LIMIT = 13
# Groq free tier varies, but we set a safe limit for 70B models.
GROQ_RPM_LIMIT = 25

# --- Model Selection ---
# Local: Lightweight 3B model for 16GB RAM
LOCAL_MODEL = "llama3.2:3b"

# Cloud (Fast): Groq LPU
FAST_CLOUD_MODEL = "llama-3.3-70b-versatile"

# Cloud (Smart): Gemini 1.5 Pro or Flash
SMART_CLOUD_MODEL = "gemini-2.0-flash"

# --- Vector DB ---
# Lightweight embedding model (approx 80MB)
EMBEDDING_MODEL = "all-MiniLM-L6-v2"
# Path to persist ChromaDB
CHROMA_DB_PATH = os.path.join(os.getcwd(), "data", "chroma_db")

# --- Keys ---
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")

# --- Web Agent Config ---
LMSYS_URL = "https://lmarena.ai/?mode=direct"
# Path to persist browser profile (cookies, auth)
BROWSER_USER_DATA_DIR = os.path.join(os.getcwd(), "data", "browser_profile")

# --- BitNet Config (AVX-512) ---
BITNET_MODEL_PATH = os.path.expanduser("~/bitnet/models/BitNet-b1.58-2B-4T")
BITNET_EXECUTABLE = os.path.expanduser("~/bitnet/run_inference.py")

# --- Deep Research ---
BRAVE_API_KEY = os.getenv("BRAVE_API_KEY", "")  # Optional, DuckDuckGo is primary
MAX_RESEARCH_ITERATIONS = 3  # UI-configurable (1-5)

