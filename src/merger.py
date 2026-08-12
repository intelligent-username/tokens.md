"""
Combines multiple ifles into one.
"""

from __future__ import annotations

import tempfile
from collections.abc import Sequence
from pathlib import Path
from typing import Any

from .registry import convert_file
from .tokenizer import DEFAULT_ENCODING, count_tokens, format_tokens

FILE_SEPARATOR = "=== FILE: {name} ==="


def resolve_to_markdown(path: Path, *, no_convert: bool = False, **convert_kwargs: Any) -> str:
    """Return the Markdown text for a single file.

    Markdown files are read directly; everything else is converted first via
    the converter registry. ``no_convert`` forces raw file contents.
    """
    path = Path(path)
    if no_convert or path.suffix.lower() in {".md", ".markdown"}:
        return path.read_text(encoding="utf-8", errors="replace")
    with tempfile.TemporaryDirectory() as tmp:
        out = convert_file(path, Path(tmp), **convert_kwargs)
        return out.read_text(encoding="utf-8", errors="replace")


def build_toc(entries: Sequence[tuple[str, str]]) -> str:
    """Build a Table of Contents from the headings of each entry."""
    lines = ["## Table of Contents"]
    for name, content in entries:
        lines.append(f"- {name}")
        for line in content.splitlines():
            stripped = line.strip()
            if stripped.startswith("## ") or stripped.startswith("# "):
                lines.append(f"  - {stripped}")
    return "\n".join(lines)


def dedup_lines(text: str) -> str:
    """Remove exact duplicate lines, preserving first-occurrence order."""
    seen: set[str] = set()
    kept: list[str] = []
    for line in text.splitlines():
        if line not in seen:
            seen.add(line)
            kept.append(line)
    return "\n".join(kept)


def merge_files(paths: Sequence[Path], output_path: Path, *, no_convert: bool = False, dedup: bool = False, toc: bool = True, encoding: str = DEFAULT_ENCODING, include_tokens: bool = False, **convert_kwargs: Any) -> Path:
    """Merge ``paths`` into a single Markdown document at ``output_path``.

    Files are sorted by natural path order for deterministic output. Returns
    the path of the written document.
    """
    ordered = sorted(paths, key=lambda p: str(p).lower())
    entries: list[tuple[str, str]] = []
    for path in ordered:
        content = resolve_to_markdown(path, no_convert=no_convert, **convert_kwargs)
        entries.append((path.name, content))

    sections: list[str] = [f"# {output_path.stem} — Merged Document", ""]
    if include_tokens:
        total = sum(count_tokens(content, encoding) for _, content in entries)
        sections.append(f"> Sources: {len(entries)} files · Total tokens: {format_tokens(total)}")
        sections.append("")
    if toc:
        sections.append(build_toc(entries))
        sections.append("")

    for name, content in entries:
        sections.append(FILE_SEPARATOR.format(name=name))
        sections.append(content)
        sections.append("")

    merged = "\n".join(sections)
    if dedup:
        merged = dedup_lines(merged)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(merged, encoding="utf-8")
    return output_path
