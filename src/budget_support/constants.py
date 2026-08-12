"""Constants and regex patterns for budget pruning."""

from __future__ import annotations

import re
from typing import Pattern

#: Boilerplate / license disclaimer patterns removed first during pruning.
BOILERPLATE_PATTERNS: tuple[Pattern[str], ...] = (
    re.compile(r"^\s*Copyright\b.*$", re.IGNORECASE),
    re.compile(r"^\s*All rights reserved.*$", re.IGNORECASE),
    re.compile(r"^\s*Licensed under.*$", re.IGNORECASE),
    re.compile(r"^\s*Permission is hereby granted.*$", re.IGNORECASE),
    re.compile(r"^\s*THE SOFTWARE IS PROVIDED.*$", re.IGNORECASE),
)

#: Markdown image references, e.g. ``![alt](url)`` or ``![](url)``.
IMAGE_PATTERN: Pattern[str] = re.compile(r"^\s*!\[[^\]]*\]\([^)]*\)\s*$")

#: Any line that starts a markdown heading (levels 1-6).
HEADING_RE: Pattern[str] = re.compile(r"^#{1,6}\s+")

#: Ratios for pruning passes
PASS2_KEEP_RATIO = 0.5
PASS3_MIN_RATIO = 0.15
PASS3_MAX_RATIO = 0.70

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
