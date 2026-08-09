"""Archive converter handler (.zip, .tar, .gz, .tgz, .bz2)."""

from __future__ import annotations

import os
import tarfile
import tempfile
import zipfile
from pathlib import Path

from ..registry import Converter, UnsupportedFormatError, convert_file

ARCHIVE_EXTENSIONS = frozenset(
    {".zip", ".tar", ".gz", ".tgz", ".bz2"}
)

IGNORE_NAMES = {".DS_Store", "desktop.ini", "thumbs.db"}


class ArchiveConverter(Converter):
    """Unpacks archive files (.zip, .tar, .tgz, etc.) and converts contained documents into a unified Markdown output."""

    extensions = ARCHIVE_EXTENSIONS
    name = "archive"

    def convert(self, input_path: Path, output_dir: Path, **kwargs: object) -> Path:
        output_dir.mkdir(parents=True, exist_ok=True)
        suffix = input_path.suffix.lower()

        with tempfile.TemporaryDirectory() as tmp_dir_str:
            tmp_dir = Path(tmp_dir_str)
            extract_dir = tmp_dir / "extracted"
            extract_dir.mkdir(parents=True, exist_ok=True)

            try:
                if suffix == ".zip":
                    with zipfile.ZipFile(input_path, "r") as zf:
                        zf.extractall(extract_dir)
                elif suffix in {".tar", ".gz", ".tgz", ".bz2"}:
                    with tarfile.open(input_path, "r:*") as tf:
                        tf.extractall(extract_dir)
                else:
                    raise UnsupportedFormatError(f"Unsupported archive format '{suffix}'")
            except Exception as exc:
                raise UnsupportedFormatError(
                    f"Could not extract archive '{input_path.name}': {exc}"
                ) from exc

            extracted_files: list[Path] = []
            for root, _, filenames in os.walk(extract_dir):
                rel_parts = Path(root).relative_to(extract_dir).parts
                if any(part.startswith(".") or part == "__MACOSX" for part in rel_parts):
                    continue
                for fname in filenames:
                    if fname in IGNORE_NAMES or fname.startswith("."):
                        continue
                    extracted_files.append(Path(root) / fname)

            if not extracted_files:
                raise UnsupportedFormatError(f"Archive '{input_path.name}' contains no readable files.")

            extracted_files.sort(key=lambda p: str(p.relative_to(extract_dir)).lower())

            sections: list[str] = [f"# {input_path.stem} — Archive Contents", ""]
            sections.append("## Table of Contents")
            for fpath in extracted_files:
                rel = fpath.relative_to(extract_dir).as_posix()
                sections.append(f"- {rel}")
            sections.append("")

            for fpath in extracted_files:
                rel = fpath.relative_to(extract_dir).as_posix()
                sections.append(f"=== FILE: {rel} ===")

                if fpath.suffix.lower() in {".md", ".markdown", ".txt"}:
                    text = fpath.read_text(encoding="utf-8", errors="replace")
                    sections.append(text)
                else:
                    try:
                        single_out_dir = tmp_dir / "converted"
                        single_out_dir.mkdir(parents=True, exist_ok=True)
                        out_md = convert_file(fpath, single_out_dir, **kwargs)
                        text = out_md.read_text(encoding="utf-8", errors="replace")
                        sections.append(text)
                    except Exception:
                        try:
                            text = fpath.read_text(encoding="utf-8", errors="replace")
                            lang = fpath.suffix.lstrip(".").lower()
                            sections.append(f"```{lang}\n{text}\n```")
                        except Exception:
                            sections.append("*(Binary or unparseable content omitted)*")

                sections.append("")

            output_path = output_dir / f"{input_path.stem}.md"
            output_path.write_text("\n".join(sections), encoding="utf-8")
            return output_path
