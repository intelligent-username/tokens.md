"""Simhash-based near-duplicate paragraph detection for the budget cascade."""

from __future__ import annotations

import hashlib
import re

#: Maximum Hamming distance (of 64 simhash bits) treated as a duplicate.
MAX_DISTANCE = 6
#: Blocks shorter than this carry too little shingle signal to match safely.
MIN_BLOCK_WORDS = 8
#: Headings, FILE separators, and TOC/list items are never collapsed.
_IMMUTABLE_RE = re.compile(r"^(#{1,6}\s|=== FILE:|\s*-\s)")


def _shingles(text: str) -> list[tuple[str, int]]:
    """Return weighted multiscale shingles (words and char n-grams)."""
    cleaned = re.sub(r"\s+", " ", text.lower().strip())
    if not cleaned:
        return []
    features: list[tuple[str, int]] = []
    for w in re.findall(r"\w+", cleaned):
        features.append((w, 2))
    for n in (2, 3):
        if len(cleaned) >= n:
            for i in range(len(cleaned) - n + 1):
                features.append((cleaned[i : i + n], 1))
    return features


def simhash(text: str) -> int:
    """Compute a 64-bit simhash over multiscale shingles.

    Each shingle is hashed with md5; bit positions accumulate weighted +1/-1
    votes and the final fingerprint bit is set where the vote is positive.
    """
    features = _shingles(text)
    if not features:
        return 0
    weights = [0] * 64
    for shingle, weight in features:
        digest = int.from_bytes(hashlib.md5(shingle.encode("utf-8")).digest()[:8], "big")
        for bit in range(64):
            weights[bit] += weight if (digest >> bit) & 1 else -weight
    return sum(1 << bit for bit in range(64) if weights[bit] > 0)


def hamming(a: int, b: int) -> int:
    """Return the Hamming distance between two fingerprints."""
    return bin(a ^ b).count("1")


def is_immutable_block(block: str) -> bool:
    """Return True for blocks that must never be collapsed or matched against.

    Covers headings, ``=== FILE:`` separators, TOC/list-dominated blocks,
    and empty blocks.
    """
    lines = [ln for ln in block.splitlines() if ln.strip()]
    if not lines:
        return True
    return sum(1 for ln in lines if _IMMUTABLE_RE.match(ln)) > len(lines) / 2
