"""
Pluggable converter registry - compatibility shim re-exporting the original registry.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path

# Re-export the original registry and its classes to maintain compatibility
from src.registry import (
    Converter,
    Registry,
    UnsupportedFormatError,
    convert_file,
    DEFAULT_REGISTRY,
)

__all__ = ["Converter", "Registry", "UnsupportedFormatError", "convert_file", "DEFAULT_REGISTRY"]