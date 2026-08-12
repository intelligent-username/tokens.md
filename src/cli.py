"""Unified ``tmd`` command-line interface.

Subcommands: ``convert``, ``clip``, ``watch``, ``fetch``, ``repo``, ``merge``,
``delta``. Bare ``tmd`` runs ``convert`` with defaults for backward
compatibility.
"""

from __future__ import annotations

from .cli_support.commands import app
from .cli_support.theme import console
from .deps import MissingDependencyError


def main() -> None:
    """Entry point for the ``tmd`` console script and ``python src/main.py``."""
    try:
        app()
    except MissingDependencyError as exc:
        console.print(f"[red]{exc}[/red]")
        raise SystemExit(1)


if __name__ == "__main__":
    main()
