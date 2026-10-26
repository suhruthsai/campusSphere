"""
In-memory sliding-window rate limiting.

Good enough for a single backend instance (e.g. one Render web service). If you
scale to several instances, move the counters to a shared store such as Redis.
"""
import math
import threading
import time
from collections import defaultdict, deque
from typing import Optional

from fastapi import HTTPException, Request

from backend.app.core.config import settings


class SlidingWindowLimiter:
    """Allows at most `limit` hits per `window` seconds for each key."""

    def __init__(self, limit: int, window: float):
        self.limit = limit
        self.window = window
        self._hits: dict = defaultdict(deque)
        self._lock = threading.Lock()  # sync endpoints run in a threadpool
        self._last_sweep = time.monotonic()

    def _prune(self, q: deque, now: float):
        while q and now - q[0] > self.window:
            q.popleft()

    def _sweep(self, now: float):
        # Occasionally drop idle keys so memory doesn't grow forever
        if now - self._last_sweep < self.window:
            return
        self._last_sweep = now
        for key in [k for k, q in self._hits.items() if not q or now - q[-1] > self.window]:
            del self._hits[key]

    def retry_after(self, key: str) -> Optional[int]:
        """Seconds until `key` may try again, or None if it's under the limit."""
        now = time.monotonic()
        with self._lock:
            q = self._hits.get(key)
            if not q:
                return None
            self._prune(q, now)
            if len(q) < self.limit:
                return None
            return max(1, math.ceil(self.window - (now - q[0])))

    def hit(self, key: str):
        now = time.monotonic()
        with self._lock:
            self._sweep(now)
            q = self._hits[key]
            self._prune(q, now)
            q.append(now)

    def reset(self, key: str):
        with self._lock:
            self._hits.pop(key, None)

    def check_and_hit(self, key: str, detail: str):
        """Count this request, raising 429 if the key is already over the limit."""
        wait = self.retry_after(key)
        if wait is not None:
            raise too_many(detail, wait)
        self.hit(key)


def too_many(detail: str, retry_after: int) -> HTTPException:
    minutes = math.ceil(retry_after / 60)
    return HTTPException(
        status_code=429,
        detail=f"{detail} Try again in {minutes} minute{'s' if minutes != 1 else ''}.",
        headers={"Retry-After": str(retry_after)},
    )


def client_ip(request: Request) -> str:
    """The real client IP, used as a rate-limit key.

    X-Forwarded-For is a client-controlled header: proxies *append* to it, so only
    the last TRUSTED_PROXY_HOPS entries were written by infrastructure we trust.
    Reading from the right stops attackers from dodging per-IP limits by sending
    a fake X-Forwarded-For.
    """
    hops = settings.TRUSTED_PROXY_HOPS
    if hops > 0:
        xff = request.headers.get("x-forwarded-for", "")
        parts = [p.strip() for p in xff.split(",") if p.strip()]
        if parts:
            return parts[-hops] if len(parts) >= hops else parts[0]
    return request.client.host if request.client else "unknown"
