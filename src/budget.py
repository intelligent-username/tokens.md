"""Hard token budget allocator: prune content to fit a context window."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Pattern

from .tokenizer import DEFAULT_ENCODING, count_tokens, format_tokens

#: Boilerplate / license disclaimer patterns removed first during pruning.
BOILERPLATE_PATTERNS: tuple[Pattern[str], ...] = (
    re.compile(r"^\s*Copyright\b.*$", re.IGNORECASE),
    re.compile(r"^\s*All rights reserved.*$", re.IGNORECASE),
    re.compile(r"^\s*Licensed under.*$", re.IGNORECASE),
    re.compile(r"^\s*Permission is hereby granted.*$", re.IGNORECASE),
    re.compile(r"^\s*THE SOFTWARE IS PROVIDED.*$", re.IGNORECASE),
)

#: Markdown image references, e.g. ``![alt](url)`` or ``![](url)``.
IMAGE_PATTERN = re.compile(r"^\s*!\[[^\]]*\]\([^)]*\)\s*$")


@dataclass
class PruneResult:
    """Records what was removed while pruning to a token budget."""

    content: str
    removed_tokens: int = 0
    removed_blocks: list[str] = field(default_factory=list)
    fits: bool = True


def _is_boilerplate(line: str) -> bool:
    return any(pattern.match(line) for pattern in BOILERPLATE_PATTERNS)


def prune_to_budget(
    content: str, budget: int, encoding: str = DEFAULT_ENCODING
) -> PruneResult:
    """Prune ``content`` until it fits within ``budget`` tokens.

    Pruning order: boilerplate lines, image references, then truncation from
    the end. Returns a :class:`PruneResult` describing what was removed.
    """
    result = PruneResult(content=content)
    if count_tokens(content, encoding) <= budget:
        return result

    lines = content.splitlines()
    kept: list[str] = []
    removed: list[str] = []

    for line in lines:
        if _is_boilerplate(line) or IMAGE_PATTERN.match(line):
            removed.append(line)
        else:
            kept.append(line)

    candidate = "\n".join(kept)
    if count_tokens(candidate, encoding) <= budget:
        result.content = candidate
        result.removed_blocks = removed
        result.removed_tokens = count_tokens(content, encoding) - count_tokens(candidate, encoding)
        result.fits = True
        return result

    # Truncate from the end until within budget.
    while kept and count_tokens("\n".join(kept), encoding) > budget:
        dropped = kept.pop()
        removed.append(dropped)

    final = "\n".join(kept)
    result.content = final
    result.removed_blocks = removed
    result.removed_tokens = count_tokens(content, encoding) - count_tokens(final, encoding)
    result.fits = count_tokens(final, encoding) <= budget
    return result


def format_prune_report(result: PruneResult, budget: int, encoding: str = DEFAULT_ENCODING) -> str:
    """Format a human-readable prune report for the CLI."""
    final_tokens = count_tokens(result.content, encoding)
    lines = [
        f"[budget] {format_tokens(final_tokens + result.removed_tokens)} -> {format_tokens(final_tokens)} tokens"
    ]
    if not result.removed_blocks:
        lines.append("  fits budget (no pruning needed)")
        return "\n".join(lines)
    lines.append(f"  removed {len(result.removed_blocks)} blocks (-{format_tokens(result.removed_tokens)} tokens)")
    lines.append(f"  final: {format_tokens(final_tokens)} tokens (fits budget)" if result.fits else "  final: over budget")
    return "\n".join(lines)