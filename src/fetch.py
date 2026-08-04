"""URL fetching: download a web page and extract clean Markdown."""

from __future__ import annotations

import re
from pathlib import Path
from urllib.parse import urlparse

from .deps import require
from .registry import UnsupportedFormatError


def _slugify(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return slug or "page"


def fetch_url(url: str, output_dir: Path, **kwargs: object) -> Path:
    """Download ``url`` and write clean article Markdown into ``output_dir``.

    Returns the path of the written file. Raises ``UnsupportedFormatError`` if
    the page cannot be fetched or no text can be extracted.
    """
    trafilatura = require("trafilatura", "tmd fetch")

    output_dir.mkdir(parents=True, exist_ok=True)

    downloaded = trafilatura.fetch_url(url)
    if not downloaded:
        raise UnsupportedFormatError(f"Could not fetch URL: {url}")

    content = trafilatura.extract(
        downloaded, output_format="markdown", include_links=True
    )
    if not content:
        raise UnsupportedFormatError(f"No text could be extracted from {url}")

    host = urlparse(url).netloc or "page"
    header = f"# {host}\n\n> Source: {url}\n\n"
    output_path = output_dir / f"{_slugify(host)}.md"
    output_path.write_text(header + content, encoding="utf-8")
    return output_path