"""
Cache abstraction package.
"""
from .base import CacheBackend
from .noop import NoOpCache

__all__ = ["CacheBackend", "NoOpCache"]
