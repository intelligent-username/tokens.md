"""Hard token budget allocator: fit content to a context window via an
escalating cascade of five pruning passes."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Pattern

from .deps import require
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

#: Any line that starts a markdown heading (levels 1-6).
HEADING_RE = re.compile(r"^#{1,6}\s+")

#: Small hardcoded English stopword set for density scoring (no dependency).
STOPWORDS: frozenset[str] = frozenset({
    "a", "an", "the", "and", "or", "but", "if", "then", "else", "for", "of",
    "to", "in", "on", "at", "by", "with", "from", "as", "is", "are", "was",
    "were", "be", "been", "being", "it", "its", "this", "that", "these",
    "those", "i", "you", "he", "she", "we", "they", "them", "his", "her",
    "their", "our", "your", "my", "not", "no", "so", "do", "does", "did",
    "have", "has", "had", "will", "would", "can", "could", "should", "may",
    "might", "must", "about", "into", "over", "under", "between", "which",
    "who", "whom", "what", "when", "where", "why", "how", "all", "any",
    "both", "each", "few", "more", "most", "other", "some", "such", "only",
    "own", "same", "than", "too", "very", "just", "also", "then", "there",
    "here", "up", "out", "off", "again", "further", "once", "during", "before",
    "after", "above", "below", "these", "those", "because", "until", "while",
})


@dataclass
class PruneResult:
    """Records what was removed while pruning to a token budget."""

    content: str
    removed_tokens: int = 0
    removed_blocks: list[str] = field(default_factory=list)
    fits: bool = True


def _is_boilerplate(line: str) -> bool:
    return any(pattern.match(line) for pattern in BOILERPLATE_PATTERNS)


@dataclass
class _Section:
    heading: str          # heading line, e.g. "## Table of Contents"; "" if none
    body: list[str]       # body lines (after heading) until next heading
    density: float = 0.0  # computed once after pass 1, reused in passes 2-4


def _split_sections(text: str) -> list[_Section]:
    """Split ``text`` into heading-delimited sections.

    A section is a heading line plus its body until the next line that starts
    with ``#``. Content before the first heading becomes an implicit section
    with an empty heading. If there are no headings at all, the whole text is
    one flat section.
    """
    sections: list[_Section] = []
    for line in text.splitlines():
        if HEADING_RE.match(line):
            sections.append(_Section(heading=line, body=[]))
        elif sections:
            sections[-1].body.append(line)
        else:
            sections.append(_Section(heading="", body=[line]))
    return sections


def _rebuild(sections: list[_Section]) -> str:
    """Join sections back into a single markdown string."""
    parts: list[str] = []
    for s in sections:
        if s.heading:
            parts.append(s.heading)
        parts.extend(s.body)
    return "\n".join(parts)


def _density(section: _Section, encoding: str) -> float:
    """unique_nonstopword_terms / total_tokens for a section."""
    text = "\n".join([section.heading] + section.body)
    tokens = count_tokens(text, encoding)
    if tokens == 0:
        return 0.0
    terms = re.findall(r"[A-Za-z0-9]+", text.lower())
    unique = {t for t in terms if t not in STOPWORDS}
    return len(unique) / tokens


def _textrank_prune(text: str, keep_ratio: float) -> str:
    """Prune ``text`` to ~``keep_ratio`` of its sentences via TextRank.

    sumy is imported lazily here so it is only loaded when passes 2/3 run.
    Kept sentences are re-sorted back to original document order.
    """
    require("sumy", "budget pruning")
    from sumy.nlp.stemmers import Stemmer
    from sumy.nlp.tokenizers import Tokenizer
    from sumy.parsers.plaintext import PlaintextParser
    from sumy.summarizers.text_rank import TextRankSummarizer
    from sumy.utils import get_stop_words

    language = "english"
    parser = PlaintextParser.from_string(text, Tokenizer(language))
    sentences = list(parser.document.sentences)
    if not sentences:
        return text
    keep_n = max(1, round(len(sentences) * keep_ratio))
    summarizer = TextRankSummarizer(Stemmer(language))
    summarizer.stop_words = get_stop_words(language)
    ranked = summarizer(parser.document, keep_n)
    ranked_texts = {str(s) for s in ranked}
    ordered = [str(s) for s in sentences if str(s) in ranked_texts]
    return " ".join(ordered)


def prune_to_budget(
    content: str, budget: int, encoding: str = DEFAULT_ENCODING
) -> PruneResult:
    """Prune ``content`` to fit ``budget`` tokens via an escalating cascade.

    Passes: 1 boilerplate/images, 2 TextRank on the lowest-density section,
    3 TextRank on all sections (density-proportional), 4 drop whole sections
    lowest-density first, 5 end truncation. The budget is re-checked after
    every pass; the first pass that fits wins.
    """
    result = PruneResult(content=content)
    original_tokens = count_tokens(content, encoding)
    if original_tokens <= budget:
        return result

    removed: list[str] = []

    # Pass 1: boilerplate + image lines (free).
    current = _pass1_boilerplate(content, removed)
    if count_tokens(current, encoding) <= budget:
        return _finalize(result, current, original_tokens, removed, budget, encoding)

    # Compute sections + densities once, after pass 1; reused in passes 2-4.
    sections = _split_sections(current)
    for s in sections:
        s.density = _density(s, encoding)

    # Pass 2: gentle - TextRank the single lowest-density section.
    current = _pass2_gentle(sections, removed, encoding)
    if count_tokens(current, encoding) <= budget:
        return _finalize(result, current, original_tokens, removed, budget, encoding)

    # Pass 3: medium - TextRank all sections, density-proportional keep_ratio.
    current = _pass3_medium(sections, removed, encoding)
    if count_tokens(current, encoding) <= budget:
        return _finalize(result, current, original_tokens, removed, budget, encoding)

    # Pass 4: aggressive - drop whole sections, lowest density first.
    current = _pass4_drop_sections(sections, removed, encoding, budget)
    if count_tokens(current, encoding) <= budget:
        return _finalize(result, current, original_tokens, removed, budget, encoding)

    # Pass 5: last resort - end truncation (existing behavior).
    current = _pass5_truncate(current, removed, encoding, budget)
    return _finalize(result, current, original_tokens, removed, budget, encoding)


def _pass1_boilerplate(content: str, removed: list[str]) -> str:
    """Drop boilerplate + image lines. Returns new content; appends to removed."""
    kept: list[str] = []
    for line in content.splitlines():
        if _is_boilerplate(line) or IMAGE_PATTERN.match(line):
            removed.append(line)
        else:
            kept.append(line)
    return "\n".join(kept)


def _pass2_gentle(sections, removed, encoding) -> str:
    """TextRank-prune the single lowest-density section (keep_ratio 0.5)."""
    target = min(sections, key=lambda s: s.density)
    if target.body:
        pruned = _textrank_prune("\n".join(target.body), 0.5)
        removed.append(f"[pruned] {target.heading or 'intro'}")
        target.body = pruned.splitlines()
    return _rebuild(sections)


def _pass3_medium(sections, removed, encoding) -> str:
    """TextRank-prune every section; denser sections keep more."""
    max_density = max((s.density for s in sections), default=0.0)
    for s in sections:
        if not s.body:
            continue
        ratio = 0.15 if max_density == 0 else 0.15 + 0.55 * (s.density / max_density)
        ratio = max(0.15, min(0.7, ratio))
        pruned = _textrank_prune("\n".join(s.body), ratio)
        removed.append(f"[pruned] {s.heading or 'intro'}")
        s.body = pruned.splitlines()
    return _rebuild(sections)


def _pass4_drop_sections(sections, removed, encoding, budget) -> str:
    """Drop whole sections, lowest density first (deeper headings first on ties)."""
    def depth(s):
        m = HEADING_RE.match(s.heading)
        return len(m.group(0).strip()) if m else 0
    for s in sorted(sections, key=lambda s: (s.density, -depth(s))):
        if count_tokens(_rebuild(sections), encoding) <= budget:
            break
        removed.append(f"[dropped] {s.heading or 'intro'}")
        sections.remove(s)
    return _rebuild(sections)


def _pass5_truncate(content: str, removed: list[str], encoding, budget) -> str:
    """End-truncation fallback (existing behavior)."""
    kept = content.splitlines()
    while kept and count_tokens("\n".join(kept), encoding) > budget:
        removed.append(kept.pop())
    return "\n".join(kept)


def _finalize(
    result, content, original_tokens, removed, budget, encoding
) -> PruneResult:
    result.content = content
    result.removed_blocks = removed
    result.removed_tokens = original_tokens - count_tokens(content, encoding)
    result.fits = count_tokens(content, encoding) <= budget
    return result


def format_prune_report(
    result: PruneResult, budget: int, encoding: str = DEFAULT_ENCODING
) -> str:
    """Format a human-readable prune report for the CLI."""
    final_tokens = count_tokens(result.content, encoding)
    lines = [
        f"[budget] {format_tokens(final_tokens + result.removed_tokens)}"
        f" -> {format_tokens(final_tokens)} tokens"
    ]
    if not result.removed_blocks:
        lines.append("  fits budget (no pruning needed)")
        return "\n".join(lines)
    lines.append(
        f"  removed {len(result.removed_blocks)} blocks"
        f" (-{format_tokens(result.removed_tokens)} tokens)"
    )
    lines.append(
        f"  final: {format_tokens(final_tokens)} tokens (fits budget)"
        if result.fits
        else "  final: over budget"
    )
    return "\n".join(lines)
