"""
tmd CLI
"""

from __future__ import annotations

from src.cli_support.commands import app
from src.cli_support.theme import console
from src.deps import MissingDependencyError


def main() -> None:
    """Entry point for the ``tmd`` console script and ``python src/main.py``."""
    try:
        app()
    except MissingDependencyError as exc:
        console.print(f"[red]{exc}[/red]")
        raise SystemExit(1)


if __name__ == "__main__":
    main()