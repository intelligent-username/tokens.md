"""Unified ``tmd`` command-line interface.

Subcommands: ``convert``, ``clip``, ``watch``, ``fetch``, ``repo``, ``merge``,
``delta``. Bare ``tmd`` runs ``convert`` with defaults for backward
compatibility.
"""

from __future__ import annotations

from .cli_support.commands import (
    app,
    clip,
    convert,
    delta,
    fetch,
    help_cmd,
    merge,
    repo,
    ui,
    version_cmd,
    watch,
)
from .cli_support.convert_runner import convert_impl
from .cli_support.theme import CLITheme, OrderGroup, console
from .cli_support.utils import (
    _convert_kwargs,
    _default_extensions,
    _default_source,
    _parse_extensions,
    _resolve_output_dir,
)
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