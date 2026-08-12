"""CLI utility functions for path resolution, options parsing, and ports."""

from __future__ import annotations

import socket
from pathlib import Path
from typing import Any, Optional, Sequence

from ..registry import DEFAULT_REGISTRY
from .constants import PORT_SEARCH_RANGE, TRUNCATE_DESC_LENGTH


def _default_extensions() -> str:
    return ", ".join(sorted(ext.lstrip(".") for ext in DEFAULT_REGISTRY.extensions()))


def _parse_extensions(value: str) -> Sequence[str]:
    result: list[str] = []
    for raw in value.split(","):
        part = raw.strip()
        if part:
            result.append(part if part.startswith(".") else f".{part}")
    return result


def _convert_kwargs(
    strip_headers_footers: bool,
    write_images: bool,
    image_path: Optional[str],
    pages: Optional[str],
) -> dict[str, Any]:
    kwargs: dict[str, Any] = {
        "strip_headers_footers": strip_headers_footers,
        "write_images": write_images,
    }
    if image_path:
        kwargs["image_path"] = image_path
    if pages:
        kwargs["pages"] = [int(p.strip()) for p in pages.split(",") if p.strip()]
    return kwargs


def _default_source() -> Path:
    """Resolve the default input dir relative to the project root."""
    root = Path(__file__).resolve().parent.parent.parent
    in_dir = root / "in"
    input_dir = root / "input"
    if in_dir.exists():
        return in_dir
    if input_dir.exists():
        return input_dir
    in_dir.mkdir(exist_ok=True)
    return in_dir


def _resolve_output_dir(output: str, loc: Optional[str] = None) -> Path:
    """Resolve destination directory from --output or --loc option."""
    if loc is not None:
        target = "." if (loc.strip() == "" or loc == ".") else loc
    else:
        target = output
    p = Path(target)
    p.mkdir(parents=True, exist_ok=True)
    return p


def _find_free_port(host: str, port: int) -> int:
    """Return ``port`` or the first free port up to ``port + PORT_SEARCH_RANGE``."""
    for candidate in range(port, port + PORT_SEARCH_RANGE):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            try:
                sock.bind((host, candidate))
            except OSError:
                continue
        return candidate
    return port


def _truncate_desc(text: str, length: int = TRUNCATE_DESC_LENGTH) -> str:
    if len(text) <= length:
        return text.ljust(length)
    return text[: length - 3] + "..."
