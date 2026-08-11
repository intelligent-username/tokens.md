"""tokens.md — convert files to token-efficient Markdown for LLM prompts."""

from __future__ import annotations

__version__ = "0.0.5"

from .file_selector import (
    FileSelector,
    DirectoryFileSelector,
    DiscreteFileSelector,
    GlobPatternFileSelector,
    select_files,
)
from .converter import convert_pdf_to_markdown, run_pipeline, pdf_to_markdown
from .registry import (
    Converter,
    Registry,
    DEFAULT_REGISTRY,
    convert_file,
    UnsupportedFormatError,
)
from .fetch import fetch_url
from .merger import merge_files
from .budget import PruneResult, prune_to_budget
from .tokenizer import (
    count_tokens,
    count_tokens_in_file,
    count_pdf_tokens,
    count_raw_file_tokens,
    format_tokens,
    delta_percent,
    get_encoding,
    DEFAULT_ENCODING,
)
from .delta import print_delta_summary
from .clipboard import copy_to_clipboard

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