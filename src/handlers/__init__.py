"""Built-in converter handlers.

Importing this package registers every built-in handler into
``src.registry.DEFAULT_REGISTRY``.
"""

from __future__ import annotations

from ..registry import DEFAULT_REGISTRY
from .html import HtmlConverter
from .office import OfficeConverter
from .pymupdf import PymupdfConverter
from .repo import RepoConverter
from .structured import StructuredConverter
from .unsupported import UnsupportedConverter

__all__ = [
    "HtmlConverter",
    "OfficeConverter",
    "PymupdfConverter",
    "RepoConverter",
    "StructuredConverter",
    "UnsupportedConverter",
]

DEFAULT_REGISTRY.register(PymupdfConverter())
DEFAULT_REGISTRY.register(OfficeConverter())
DEFAULT_REGISTRY.register(HtmlConverter())
DEFAULT_REGISTRY.register(StructuredConverter())
DEFAULT_REGISTRY.register(RepoConverter())
DEFAULT_REGISTRY.register(UnsupportedConverter())