"""Filename and path sanitization helper functions."""

from __future__ import annotations

from pathlib import Path

from .constants import MAX_NAME_LENGTH, SAFE_NAME_RE


def sanitize_name(name: str) -> str:
    """Keep ``[A-Za-z0-9._ -]``, collapse runs, cap at 120 chars.

    Also removes ``..`` sequences and path separators to prevent path traversal via filenames.
    """
    name = name.replace("..", "").replace("/", "").replace("\\", "")
    cleaned = SAFE_NAME_RE.sub("_", name)
    cleaned = cleaned.strip(" .")
    if not cleaned:
        cleaned = "file"
    return cleaned[:MAX_NAME_LENGTH]


def sanitize_relpath(relpath: str) -> Path:
    """Turn a client-supplied relative path into a safe subpath."""
    parts: list[str] = []
    for part in relpath.replace("\\", "/").split("/"):
        if part == "..":
            continue
        part = sanitize_name(part)
        if part in {"", "."}:
            continue
        parts.append(part)
    if not parts:
        return Path()
    return Path(*parts)
