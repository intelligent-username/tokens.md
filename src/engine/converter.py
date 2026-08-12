"""Pipeline conversion engine."""

from __future__ import annotations

from pathlib import Path
from typing import Any, List, Optional, Sequence, Union

from ..file_selector import FileSelector, select_files
from ..handlers.pymupdf import PymupdfConverter, pdf_to_markdown
from ..registry import convert_file

__all__ = [
    "convert_pdf_to_markdown",
    "run_pipeline",
    "pdf_to_markdown",
]


def convert_pdf_to_markdown(
    pdf_path: Union[str, Path],
    output_dir: Union[str, Path] = "output",
    strip_headers_footers: bool = False,
    page_chunks: bool = False,
    write_images: bool = False,
    image_path: Optional[Union[str, Path]] = None,
    pages: Optional[List[int]] = None,
    **kwargs: Any,
) -> Path:
    """Convert a single file to Markdown and save it into ``output_dir``."""
    return PymupdfConverter().convert(
        Path(pdf_path),
        Path(output_dir),
        strip_headers_footers=strip_headers_footers,
        page_chunks=page_chunks,
        write_images=write_images,
        image_path=image_path,
        pages=pages,
        **kwargs,
    )


def run_pipeline(
    source: Union[str, Path, Sequence[Union[str, Path]], FileSelector] = "in",
    output_dir: Union[str, Path] = "output",
    strip_headers_footers: bool = False,
    write_images: bool = False,
    extensions: Sequence[str] = (".pdf",),
    recursive: bool = False,
    **kwargs: Any,
) -> List[Path]:
    """Run the conversion pipeline over all selected files."""
    files_to_convert = select_files(
        source, extensions=extensions, recursive=recursive
    )
    converted_files: List[Path] = []

    for file_path in files_to_convert:
        out_file = convert_file(
            file_path,
            Path(output_dir),
            strip_headers_footers=strip_headers_footers,
            write_images=write_images,
            **kwargs,
        )
        converted_files.append(out_file)

    return converted_files
