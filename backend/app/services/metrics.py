"""
Operational metrics collector for HeatPath backend.

Tracks:
- Provider failure counters (weather, aqi, shade)
- Cache hit/miss counters and hit rate
- Provider latency moving averages
"""
import time
from typing import Dict, Any, List
from threading import Lock


class MetricsCollector:
    def __init__(self):
        self._lock = Lock()
        self.weather_provider_failures_total: int = 0
        self.aqi_provider_failures_total: int = 0
        self.shade_provider_failures_total: int = 0
        self.cache_hits_total: int = 0
        self.cache_misses_total: int = 0
        self._latencies_ms: Dict[str, List[float]] = {
            "weather": [],
            "aqi": [],
            "shade": [],
        }

    def record_provider_call(
        self,
        provider_name: str,
        duration_ms: float,
        success: bool,
        failure_type: str = None,
    ) -> None:
        """Record the outcome and latency of a third-party or internal provider call."""
        with self._lock:
            # Latency tracking (keep last 100 samples per service to prevent unbounded growth)
            if provider_name in self._latencies_ms:
                samples = self._latencies_ms[provider_name]
                samples.append(round(duration_ms, 2))
                if len(samples) > 100:
                    self._latencies_ms[provider_name] = samples[-100:]

            if not success:
                if provider_name == "weather":
                    self.weather_provider_failures_total += 1
                elif provider_name == "aqi":
                    self.aqi_provider_failures_total += 1
                elif provider_name == "shade":
                    self.shade_provider_failures_total += 1

    def record_cache_access(self, hits: int, misses: int) -> None:
        """Record cache hits and misses."""
        with self._lock:
            self.cache_hits_total += hits
            self.cache_misses_total += misses

    @property
    def cache_hit_rate(self) -> float:
        """Compute the current cache hit rate as a fraction between 0.0 and 1.0."""
        with self._lock:
            total = self.cache_hits_total + self.cache_misses_total
            if total == 0:
                return 0.0
            return round(self.cache_hits_total / total, 4)

    def get_metrics(self) -> Dict[str, Any]:
        """Return a snapshot of all operational metrics."""
        with self._lock:
            total_cache = self.cache_hits_total + self.cache_misses_total
            hit_rate = round(self.cache_hits_total / total_cache, 4) if total_cache > 0 else 0.0

            latency_summary = {}
            for name, samples in self._latencies_ms.items():
                if samples:
                    sorted_samples = sorted(samples)
                    p95_idx = int(len(sorted_samples) * 0.95)
                    latency_summary[name] = {
                        "count": len(samples),
                        "avg_ms": round(sum(samples) / len(samples), 2),
                        "p95_ms": sorted_samples[min(p95_idx, len(sorted_samples) - 1)],
                        "last_ms": samples[-1],
                    }
                else:
                    latency_summary[name] = {
                        "count": 0,
                        "avg_ms": None,
                        "p95_ms": None,
                        "last_ms": None,
                    }

            return {
                "weather_provider_failures_total": self.weather_provider_failures_total,
                "aqi_provider_failures_total": self.aqi_provider_failures_total,
                "shade_provider_failures_total": self.shade_provider_failures_total,
                "cache_hits_total": self.cache_hits_total,
                "cache_misses_total": self.cache_misses_total,
                "cache_hit_rate": hit_rate,
                "provider_latency_ms": latency_summary,
            }

    def reset_for_testing(self) -> None:
        """Reset counters for hermetic test execution."""
        with self._lock:
            self.weather_provider_failures_total = 0
            self.aqi_provider_failures_total = 0
            self.shade_provider_failures_total = 0
            self.cache_hits_total = 0
            self.cache_misses_total = 0
            self._latencies_ms = {
                "weather": [],
                "aqi": [],
                "shade": [],
            }


metrics = MetricsCollector()
