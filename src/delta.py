"""Token delta inspector: print how many tokens were saved by conversion."""

from __future__ import annotations

from pathlib import Path
from typing import Sequence

from .tokenizer import (
    DEFAULT_ENCODING,
    count_raw_file_tokens,
    count_tokens_in_file,
    delta_percent,
    format_tokens,
)


def _source_tokens(path: Path, encoding: str) -> int:
    return count_raw_file_tokens(path)


def compute_delta_summary(
    sources: Sequence[Path],
    outputs: Sequence[Path],
    encoding: str = DEFAULT_ENCODING,
) -> list[dict[str, object]]:
    """Return per-file token delta entries as dicts.

    Data-returning twin of :func:`print_delta_summary`; each entry has
    ``name``, ``source_tokens``, ``target_tokens`` and ``percent``.
    """
    entries: list[dict[str, object]] = []
    for source, output in zip(sources, outputs):
        source_tokens = _source_tokens(source, encoding)
        target_tokens = count_tokens_in_file(output, encoding)
        entries.append(
            {
                "name": source.name,
                "source_tokens": source_tokens,
                "target_tokens": target_tokens,
                "percent": delta_percent(source_tokens, target_tokens),
            }
        )
    return entries


def print_delta_summary(
    sources: Sequence[Path],
    outputs: Sequence[Path],
    encoding: str = DEFAULT_ENCODING,
) -> None:
    """Print one delta line per file plus a TOTAL line.

    Format: ``PDF (142,000 tokens) -> Markdown (12,400 tokens) [-91.2%]``
    """
    total_source = 0
    total_target = 0

    for source, output in zip(sources, outputs):
        source_tokens = _source_tokens(source, encoding)
        target_tokens = count_tokens_in_file(output, encoding)
        total_source += source_tokens
        total_target += target_tokens
        pct = delta_percent(source_tokens, target_tokens)
        print(
            f"{source.suffix.upper().lstrip('.') or source.name} "
            f"({format_tokens(source_tokens)} tokens) -> "
            f"Markdown ({format_tokens(target_tokens)} tokens) [{pct:+.1f}%]"
        )

    if len(sources) > 1:
        total_pct = delta_percent(total_source, total_target)
        print(
            f"TOTAL ({format_tokens(total_source)} tokens) -> "
            f"({format_tokens(total_target)} tokens) [{total_pct:+.1f}%]"
        )