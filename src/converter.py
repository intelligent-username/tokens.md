import pymupdf4llm
from pathlib import Path
from typing import Union, List, Optional, Sequence
from .file_selector import select_files, FileSelector


def convert_pdf_to_markdown(
    pdf_path: Union[str, Path],
    output_dir: Union[str, Path] = "output",
    strip_headers_footers: bool = False,
    page_chunks: bool = False,
    write_images: bool = False,
    image_path: Optional[Union[str, Path]] = None,
    pages: Optional[List[int]] = None,
    **kwargs
) -> Path:
    """
    Converts a single PDF file to Markdown using pymupdf4llm and saves the output.

    :param pdf_path: Path to the input PDF file.
    :param output_dir: Directory where the converted markdown file will be saved.
    :param strip_headers_footers: If True, excludes headers and footers from markdown.
    :param page_chunks: If True, returns page chunks (handled separately if needed).
    :param write_images: If True, extracts embedded images to disk.
    :param image_path: Folder to save extracted images if write_images is True.
    :param pages: Optional list of zero-based page indices to process.
    :param kwargs: Additional arguments passed directly to pymupdf4llm.to_markdown.
    :return: Path to the created output file.
    """
    pdf_path = Path(pdf_path)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    markdown_kwargs = {
        "header": not strip_headers_footers,
        "footer": not strip_headers_footers,
        "page_chunks": page_chunks,
        "write_images": write_images,
        **kwargs
    }

    if pages is not None:
        markdown_kwargs["pages"] = pages

    if write_images:
        if image_path is None:
            image_path = output_dir / f"{pdf_path.stem}_images"
        else:
            image_path = Path(image_path)
        image_path.mkdir(parents=True, exist_ok=True)
        markdown_kwargs["image_path"] = str(image_path)

    md_content = pymupdf4llm.to_markdown(str(pdf_path), **markdown_kwargs)

    output_path = output_dir / f"{pdf_path.stem}.md"
    
    if isinstance(md_content, str):
        output_path.write_text(md_content, encoding="utf-8")
    else:
        # In case page_chunks=True, write string representation or handle json/structured output
        import json
        output_path = output_dir / f"{pdf_path.stem}_chunks.json"
        output_path.write_text(json.dumps(md_content, indent=2, ensure_ascii=False), encoding="utf-8")

    return output_path


def run_pipeline(
    source: Union[str, Path, Sequence[Union[str, Path]], FileSelector] = "in",
    output_dir: Union[str, Path] = "output",
    strip_headers_footers: bool = False,
    write_images: bool = False,
    **kwargs
) -> List[Path]:
    """
    Runs the PDF-to-Markdown conversion pipeline over all selected files.

    :param source: Directory path, file path, list of paths, or FileSelector instance.
    :param output_dir: Directory where markdown outputs will be stored.
    :param strip_headers_footers: Exclude header/footer text.
    :param write_images: Extract images to disk during conversion.
    :param kwargs: Additional options for pymupdf4llm.to_markdown.
    :return: List of created output file paths.
    """
    files_to_convert = select_files(source)
    converted_files = []

    for file_path in files_to_convert:
        out_file = convert_pdf_to_markdown(
            pdf_path=file_path,
            output_dir=output_dir,
            strip_headers_footers=strip_headers_footers,
            write_images=write_images,
            **kwargs
        )
        converted_files.append(out_file)

    return converted_files
