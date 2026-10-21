"""
Connection backoff for database pools.
After a failed connect, the database is skipped for a cooldown (60 s, doubling up to 10 min)
so callers fail fast and use their fallbacks instead of reconnecting on every request.
"""
import logging
import time
from typing import Callable

logger = logging.getLogger(__name__)

INITIAL_COOLDOWN_SECONDS = 60.0
MAX_COOLDOWN_SECONDS = 600.0


class DatabaseUnavailableError(RuntimeError):
    """Raised while a pool is cooling down after a failed connect."""


class ConnectBackoff:
    def __init__(
        self,
        name: str,
        initial: float = INITIAL_COOLDOWN_SECONDS,
        maximum: float = MAX_COOLDOWN_SECONDS,
        clock: Callable[[], float] = time.monotonic,
    ):
        self.name = name
        self.initial = initial
        self.maximum = maximum
        self.clock = clock
        self.reset()

    def reset(self) -> None:
        self._retry_at = 0.0
        self._next_cooldown = self.initial

    def remaining(self) -> float:
        """Seconds left in the current cooldown, or 0 when a connect may be attempted."""
        return max(0.0, self._retry_at - self.clock())

    def check(self) -> None:
        """Raise DatabaseUnavailableError if a connect must not be attempted yet."""
        remaining = self.remaining()
        if remaining > 0:
            raise DatabaseUnavailableError(
                f"{self.name} unavailable after a failed connect; retrying in {remaining:.0f}s"
            )

    def record_failure(self, error: Exception) -> None:
        # Concurrent connects that fail together count as one failure, not several doublings
        if self.remaining() > 0:
            return
        cooldown = self._next_cooldown
        self._retry_at = self.clock() + cooldown
        self._next_cooldown = min(cooldown * 2, self.maximum)
        logger.warning(
            f"{self.name} connection failed: {type(error).__name__}: {error}. "
            f"Skipping the database for {cooldown:.0f}s."
        )

    def record_success(self) -> None:
        self.reset()
