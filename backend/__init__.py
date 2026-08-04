"""tokens.md local web UI: FastAPI backend that drives the ``src`` core."""

from __future__ import annotations

__all__ = ["app", "create_app"]

from .app import create_app

app = create_app()
