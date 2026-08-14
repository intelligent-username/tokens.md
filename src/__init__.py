"""tokens.md — convert files to token-efficient Markdown for LLM prompts."""

from __future__ import annotations

__version__ = "0.0.14"

from .budget import PruneResult, prune_to_budget
from .clipboard import copy_to_clipboard
from .delta import print_delta_summary
from .engine import convert_pdf_to_markdown, pdf_to_markdown, run_pipeline
from .fetch import fetch_url
from .file_selector import DirectoryFileSelector, DiscreteFileSelector, FileSelector, GlobPatternFileSelector, select_files
from .merger import merge_files
from .registry import DEFAULT_REGISTRY, Converter, Registry, UnsupportedFormatError, convert_file
from .tokenizer import DEFAULT_ENCODING, count_pdf_tokens, count_raw_file_tokens, count_tokens, count_tokens_in_file, delta_percent, format_tokens, get_encoding

__all__ = [
    "__version__",
    "FileSelector",
    "DirectoryFileSelector",
    "DiscreteFileSelector",
    "GlobPatternFileSelector",
    "select_files",
    "convert_pdf_to_markdown",
    "run_pipeline",
    "pdf_to_markdown",
    "Converter",
    "Registry",
    "DEFAULT_REGISTRY",
    "convert_file",
    "UnsupportedFormatError",
    "fetch_url",
    "merge_files",
    "PruneResult",
    "prune_to_budget",
    "count_tokens",
    "count_tokens_in_file",
    "count_pdf_tokens",
    "count_raw_file_tokens",
    "format_tokens",
    "delta_percent",
    "get_encoding",
    "DEFAULT_ENCODING",
    "print_delta_summary",
    "copy_to_clipboard",
]
