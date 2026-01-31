"""
System Metrics Service

Real-time monitoring of RAM, CPU, network, and active models.
Uses psutil for cross-platform metrics collection.
"""

import asyncio
import logging
import time
from typing import Dict, Any, Optional, AsyncGenerator
from dataclasses import dataclass, asdict

try:
    import psutil
    HAS_PSUTIL = True
except ImportError:
    HAS_PSUTIL = False

logger = logging.getLogger(__name__)


@dataclass
class SystemMetrics:
    """Snapshot of system metrics"""
    timestamp: float
    ram_used_gb: float
    ram_total_gb: float
    ram_percent: float
    cpu_percent: float
    net_sent_mb: float
    net_recv_mb: float
    net_rate_up_kbps: float  # Upload rate
    net_rate_down_kbps: float  # Download rate
    active_processes: int
    active_models: list  # Currently loaded models
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class MetricsService:
    """
    Real-time system metrics collection.
    
    Features:
        - RAM usage tracking with 16GB budget awareness
        - CPU utilization
        - Network I/O with rate calculation
        - Active model tracking
    """
    
    RAM_BUDGET_GB = 16.0  # Target system
    SAMPLE_INTERVAL = 1.0  # Seconds between samples
    
    def __init__(self):
        if not HAS_PSUTIL:
            logger.warning("psutil not installed - metrics will be limited")
        
        self._last_net_io = None
        self._last_net_time = 0
        self._active_models: list[str] = []
    
    def get_snapshot(self) -> SystemMetrics:
        """Get current system metrics"""
        now = time.time()
        
        if HAS_PSUTIL:
            mem = psutil.virtual_memory()
            cpu = psutil.cpu_percent(interval=0.1)
            net = psutil.net_io_counters()
            
            # Calculate network rates
            if self._last_net_io and self._last_net_time:
                dt = now - self._last_net_time
                if dt > 0:
                    up_rate = (net.bytes_sent - self._last_net_io.bytes_sent) / dt / 1024
                    down_rate = (net.bytes_recv - self._last_net_io.bytes_recv) / dt / 1024
                else:
                    up_rate = down_rate = 0
            else:
                up_rate = down_rate = 0
            
            self._last_net_io = net
            self._last_net_time = now
            
            return SystemMetrics(
                timestamp=now,
                ram_used_gb=mem.used / 1e9,
                ram_total_gb=mem.total / 1e9,
                ram_percent=mem.percent,
                cpu_percent=cpu,
                net_sent_mb=net.bytes_sent / 1e6,
                net_recv_mb=net.bytes_recv / 1e6,
                net_rate_up_kbps=up_rate,
                net_rate_down_kbps=down_rate,
                active_processes=len(psutil.pids()),
                active_models=self._active_models.copy(),
            )
        else:
            # Fallback without psutil
            return SystemMetrics(
                timestamp=now,
                ram_used_gb=0,
                ram_total_gb=self.RAM_BUDGET_GB,
                ram_percent=0,
                cpu_percent=0,
                net_sent_mb=0,
                net_recv_mb=0,
                net_rate_up_kbps=0,
                net_rate_down_kbps=0,
                active_processes=0,
                active_models=self._active_models.copy(),
            )
    
    def register_model(self, model_id: str):
        """Register a model as active"""
        if model_id not in self._active_models:
            self._active_models.append(model_id)
            logger.info(f"Registered active model: {model_id}")
    
    def unregister_model(self, model_id: str):
        """Remove a model from active list"""
        if model_id in self._active_models:
            self._active_models.remove(model_id)
            logger.info(f"Unregistered model: {model_id}")
    
    def check_memory_budget(self) -> dict:
        """
        Check if system is within memory budget.
        
        Returns:
            {
                "within_budget": bool,
                "used_gb": float,
                "available_gb": float,
                "recommendation": str
            }
        """
        metrics = self.get_snapshot()
        available = self.RAM_BUDGET_GB - metrics.ram_used_gb
        within_budget = metrics.ram_used_gb < self.RAM_BUDGET_GB * 0.9  # 90% threshold
        
        if within_budget:
            recommendation = "System is operating normally"
        elif metrics.ram_used_gb < self.RAM_BUDGET_GB:
            recommendation = "Approaching memory limit - consider unloading unused models"
        else:
            recommendation = "CRITICAL: Memory budget exceeded - unload models immediately"
        
        return {
            "within_budget": within_budget,
            "used_gb": round(metrics.ram_used_gb, 2),
            "available_gb": round(available, 2),
            "recommendation": recommendation,
        }
    
    async def stream_metrics(
        self, 
        interval: float = 1.0
    ) -> AsyncGenerator[SystemMetrics, None]:
        """
        Stream metrics at specified interval.
        
        Args:
            interval: Seconds between updates (default 1.0)
        
        Yields:
            SystemMetrics snapshots
        """
        while True:
            yield self.get_snapshot()
            await asyncio.sleep(interval)
    
    def format_for_terminal(self, metrics: SystemMetrics) -> str:
        """Format metrics for terminal display"""
        ram_bar = self._make_bar(metrics.ram_percent, 20)
        cpu_bar = self._make_bar(metrics.cpu_percent, 20)
        
        return (
            f"┌─ System Health ───────────────────────┐\n"
            f"│ RAM: {ram_bar} {metrics.ram_used_gb:.1f}/{metrics.ram_total_gb:.1f} GB ({metrics.ram_percent:.0f}%)\n"
            f"│ CPU: {cpu_bar} {metrics.cpu_percent:.0f}%\n"
            f"│ NET: ↑{metrics.net_rate_up_kbps:.0f} KB/s ↓{metrics.net_rate_down_kbps:.0f} KB/s\n"
            f"│ Models: {', '.join(metrics.active_models) or 'none'}\n"
            f"└───────────────────────────────────────┘"
        )
    
    @staticmethod
    def _make_bar(percent: float, width: int) -> str:
        """Create ASCII progress bar"""
        filled = int(percent / 100 * width)
        return f"[{'█' * filled}{'░' * (width - filled)}]"


# Singleton instance
_metrics_service: Optional[MetricsService] = None


def get_metrics_service() -> MetricsService:
    """Get or create singleton metrics service"""
    global _metrics_service
    if _metrics_service is None:
        _metrics_service = MetricsService()
    return _metrics_service
