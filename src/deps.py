"""Optional-dependency helpers with friendly error messages.

The heavy third-party packages (``trafilatura``, ``tiktoken``, ``pyperclip``,
``watchdog``, ``pymupdf4llm``, ``pathspec``, ``sumy``) are imported lazily so
the tool loads even when one is missing. When a feature actually needs a
missing package, :func:`require` raises a clear :class:`MissingDependencyError`
instead of a bare ``ModuleNotFoundError``.
"""

from __future__ import annotations

import importlib
from typing import Any


class MissingDependencyError(RuntimeError):
    """Raised when an optional dependency is required but not installed."""


def require(module_name: str, feature: str) -> Any:
    """Import ``module_name`` or raise a friendly :class:`MissingDependencyError`.

    ``feature`` is a short human-readable description of what needs the
    dependency (e.g. ``"tmd fetch"``).
    """
    try:
        return importlib.import_module(module_name)
    except ImportError as exc:
        raise MissingDependencyError(f"'{feature}' requires the '{module_name}' package, which is not installed.\nInstall it with:  pip install -e .   (or: pip install {module_name})") from exc
