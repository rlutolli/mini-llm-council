import time
import asyncio
from typing import Dict

class RateLimitManager:
    """
    Implements a Token Bucket algorithm to respect API rate limits.
    """
    def __init__(self, key: str, rpm_limit: int):
        self.key = key
        self.rpm_limit = rpm_limit
        self.tokens = rpm_limit
        self.last_refill = time.time()
        self.capacity = rpm_limit

    async def wait_for_token(self):
        """
        Waits until a token is available, then consumes it.
        """
        while True:
            self._refill()
            if self.tokens >= 1:
                self.tokens -= 1
                return
            else:
                # Calculate time until next token
                # We gain (rpm_limit / 60) tokens per second.
                # To gain 1 token, we need 60 / rpm_limit seconds.
                wait_time = 60.0 / self.rpm_limit
                await asyncio.sleep(wait_time)

    def _refill(self):
        now = time.time()
        elapsed = now - self.last_refill
        refill_amount = elapsed * (self.rpm_limit / 60.0)
        self.tokens = min(self.capacity, self.tokens + refill_amount)
        self.last_refill = now
