"""Data models for budget pruning results and document sections."""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class PruneResult:
    """Records what was removed while pruning to a token budget."""

    content: str
    removed_tokens: int = 0
    removed_blocks: list[str] = field(default_factory=list)
    fits: bool = True


@dataclass
class _Section:
    heading: str          # heading line, e.g. "## Table of Contents"; "" if none
    body: list[str]       # body lines (after heading) until next heading
    density: float = 0.0  # computed once after pass 1, reused in passes 2-4
