"""
Tab Pool Manager - Efficient browser tab management with LRU eviction.

Manages a pool of reusable browser tabs to minimize memory usage
and improve response times when interacting with LMArena.
"""

import time
import logging
from collections import OrderedDict
from threading import Lock
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)


class TabPool:
    """
    LRU-based tab pool for efficient browser resource management.
    
    Features:
    - Reuses existing tabs instead of creating new ones
    - Evicts least-recently-used tabs when pool is full
    - Thread-safe operations
    - Health checking for stale tabs
    """
    
    def __init__(self, browser, max_tabs: int = 3):
        """
        Initialize the tab pool.
        
        Args:
            browser: DrissionPage Chromium browser instance
            max_tabs: Maximum number of concurrent tabs (default: 3 for low RAM)
        """
        self.browser = browser
        self.max_tabs = max_tabs
        self._tabs: OrderedDict[str, Any] = OrderedDict()  # model_id -> tab
        self._lock = Lock()
        self._last_used: Dict[str, float] = {}  # model_id -> timestamp
        
    def get(self, model_id: str) -> Optional[Any]:
        """
        Get an existing tab for a model if available and healthy.
        
        Args:
            model_id: Unique identifier for the model
            
        Returns:
            Tab object if found and healthy, None otherwise
        """
        with self._lock:
            if model_id not in self._tabs:
                return None
                
            tab = self._tabs[model_id]
            
            # Health check - can we still interact with this tab?
            try:
                if tab.ele('tag:body', timeout=0.5):
                    # Move to end (most recently used)
                    self._tabs.move_to_end(model_id)
                    self._last_used[model_id] = time.time()
                    logger.debug(f"Tab hit for {model_id}")
                    return tab
            except Exception as e:
                logger.warning(f"Tab {model_id} unhealthy: {e}")
                
            # Tab is dead, remove it
            self._remove_tab(model_id)
            return None
    
    def put(self, model_id: str, tab: Any) -> None:
        """
        Add or update a tab in the pool.
        
        Args:
            model_id: Unique identifier for the model
            tab: DrissionPage tab object
        """
        with self._lock:
            # If we're at capacity, evict LRU
            if len(self._tabs) >= self.max_tabs and model_id not in self._tabs:
                self._evict_lru()
            
            self._tabs[model_id] = tab
            self._tabs.move_to_end(model_id)
            self._last_used[model_id] = time.time()
            logger.debug(f"Tab cached for {model_id} (pool size: {len(self._tabs)})")
    
    def remove(self, model_id: str) -> None:
        """Remove a specific tab from the pool."""
        with self._lock:
            self._remove_tab(model_id)
    
    def _remove_tab(self, model_id: str) -> None:
        """Internal: remove tab and close it."""
        if model_id in self._tabs:
            try:
                self._tabs[model_id].close()
            except:
                pass
            del self._tabs[model_id]
            self._last_used.pop(model_id, None)
            logger.debug(f"Tab removed: {model_id}")
    
    def _evict_lru(self) -> None:
        """Evict the least recently used tab."""
        if not self._tabs:
            return
            
        # First item in OrderedDict is LRU
        lru_model_id = next(iter(self._tabs))
        logger.info(f"Evicting LRU tab: {lru_model_id}")
        self._remove_tab(lru_model_id)
    
    def clear(self) -> None:
        """Close all tabs and clear the pool."""
        with self._lock:
            for model_id in list(self._tabs.keys()):
                self._remove_tab(model_id)
            logger.info("Tab pool cleared")
    
    @property
    def size(self) -> int:
        """Current number of tabs in pool."""
        return len(self._tabs)
    
    @property
    def models(self) -> list:
        """List of model IDs currently in pool."""
        return list(self._tabs.keys())
