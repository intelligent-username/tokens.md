"""Individual pruning pass implementations (Passes 1-5)."""

from __future__ import annotations

from ..tokenizer import count_tokens
from .constants import HEADING_RE, IMAGE_PATTERN, PASS2_KEEP_RATIO, PASS3_MAX_RATIO, PASS3_MIN_RATIO
from .models import PruneResult, _Section
from .section_utils import _density, _is_boilerplate, _rebuild, _textrank_prune


def _pass1_boilerplate(content: str, removed: list[str]) -> str:
    """Drop boilerplate + image lines. Returns new content; appends to removed."""
    kept: list[str] = []
    for line in content.splitlines():
        if _is_boilerplate(line) or IMAGE_PATTERN.match(line):
            removed.append(line)
        else:
            kept.append(line)
    return "\n".join(kept)


def _pass2_gentle(sections: list[_Section], removed: list[str], encoding: str) -> str:
    """TextRank-prune the single lowest-density section (keep_ratio 0.5)."""
    target = min(sections, key=lambda s: s.density)
    if target.body:
        pruned = _textrank_prune("\n".join(target.body), PASS2_KEEP_RATIO)
        removed.append(f"[pruned] {target.heading or 'intro'}")
        target.body = pruned.splitlines()
    return _rebuild(sections)


def _pass3_medium(sections: list[_Section], removed: list[str], encoding: str) -> str:
    """TextRank-prune every section; denser sections keep more."""
    max_density = max((s.density for s in sections), default=0.0)
    for s in sections:
        if not s.body:
            continue
        ratio = PASS3_MIN_RATIO if max_density == 0 else PASS3_MIN_RATIO + 0.55 * (s.density / max_density)
        ratio = max(PASS3_MIN_RATIO, min(PASS3_MAX_RATIO, ratio))
        pruned = _textrank_prune("\n".join(s.body), ratio)
        removed.append(f"[pruned] {s.heading or 'intro'}")
        s.body = pruned.splitlines()
    return _rebuild(sections)


def _pass4_drop_sections(sections: list[_Section], removed: list[str], encoding: str, budget: int) -> str:
    """Drop whole sections, lowest density first (deeper headings first on ties)."""
    def depth(s: _Section) -> int:
        m = HEADING_RE.match(s.heading)
        return len(m.group(0).strip()) if m else 0
    for s in sorted(sections, key=lambda s: (s.density, -depth(s))):
        if count_tokens(_rebuild(sections), encoding) <= budget:
            break
        if len(sections) == 1:  # Never drop the last section
            break
        removed.append(f"[dropped] {s.heading or 'intro'}")
        sections.remove(s)
    return _rebuild(sections)


def _pass5_truncate(content: str, removed: list[str], encoding: str, budget: int) -> str:
    """End-truncation fallback (existing behavior)."""
    kept = content.splitlines()
    while kept and count_tokens("\n".join(kept), encoding) > budget:
        removed.append(kept.pop())
    return "\n".join(kept)


def _finalize(
    result: PruneResult, content: str, original_tokens: int, removed: list[str], budget: int, encoding: str
) -> PruneResult:
    result.content = content
    result.removed_blocks = removed
    result.removed_tokens = original_tokens - count_tokens(content, encoding)
    result.fits = count_tokens(content, encoding) <= budget
    return result
