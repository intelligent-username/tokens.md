"""
Allocate token limit
And run 5 pruning passes.
"""

from __future__ import annotations

from .budget_support.constants import BOILERPLATE_PATTERNS, HEADING_RE, IMAGE_PATTERN, STOPWORDS
from .budget_support.models import PruneResult
from .budget_support.passes import _finalize, _pass1_boilerplate, _pass2_gentle, _pass3_medium, _pass4_drop_sections, _pass5_truncate
from .budget_support.section_utils import _density, _split_sections
from .tokenizer import DEFAULT_ENCODING, count_tokens, format_tokens


def prune_to_budget(content: str, budget: int, encoding: str = DEFAULT_ENCODING) -> PruneResult:
    """Prune ``content`` to fit ``budget`` tokens via an escalating cascade."""
    result = PruneResult(content=content)
    original_tokens = count_tokens(content, encoding)

    removed: list[str] = []

    current = _pass1_boilerplate(content, removed)
    if count_tokens(current, encoding) <= budget:
        return _finalize(result, current, original_tokens, removed, budget, encoding)

    sections = _split_sections(current)
    for s in sections:
        s.density = _density(s, encoding)

    current = _pass2_gentle(sections, removed, encoding)
    if count_tokens(current, encoding) <= budget:
        return _finalize(result, current, original_tokens, removed, budget, encoding)

    current = _pass3_medium(sections, removed, encoding)
    if count_tokens(current, encoding) <= budget:
        return _finalize(result, current, original_tokens, removed, budget, encoding)

    current = _pass4_drop_sections(sections, removed, encoding, budget)
    if count_tokens(current, encoding) <= budget:
        return _finalize(result, current, original_tokens, removed, budget, encoding)

    current = _pass5_truncate(current, removed, encoding, budget)
    return _finalize(result, current, original_tokens, removed, budget, encoding)


def format_prune_report(result: PruneResult, budget: int, encoding: str = DEFAULT_ENCODING) -> str:
    """Format a human-readable prune report for the CLI."""
    final_tokens = count_tokens(result.content, encoding)
    lines = [f"[budget] {format_tokens(final_tokens + result.removed_tokens)} -> {format_tokens(final_tokens)} tokens"]
    if not result.removed_blocks:
        lines.append("  fits budget (no pruning needed)")
        return "\n".join(lines)
    lines.append(f"  removed {len(result.removed_blocks)} blocks (-{format_tokens(result.removed_tokens)} tokens)")
    lines.append(f"  final: {format_tokens(final_tokens)} tokens (fits budget)" if result.fits else "  final: over budget")
    return "\n".join(lines)


__all__ = ["BOILERPLATE_PATTERNS", "HEADING_RE", "IMAGE_PATTERN", "STOPWORDS", "PruneResult", "format_prune_report", "prune_to_budget"]
