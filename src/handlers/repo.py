"""Repository ingestion: collapse a directory tree into a single Markdown file."""

from __future__ import annotations

import os
from collections.abc import Iterable
from pathlib import Path
from typing import TYPE_CHECKING

from ..deps import require
from ..registry import Converter

if TYPE_CHECKING:
    import pathspec

#: Extensions treated as binary and skipped to avoid spewing garbage.
BINARY_EXTENSIONS = frozenset(
    {
        ".png",
        ".jpg",
        ".jpeg",
        ".gif",
        ".bmp",
        ".tif",
        ".tiff",
        ".ico",
        ".pdf",
        ".zip",
        ".gz",
        ".tar",
        ".7z",
        ".rar",
        ".exe",
        ".dll",
        ".so",
        ".dylib",
        ".woff",
        ".woff2",
        ".ttf",
        ".otf",
        ".eot",
        ".mp3",
        ".mp4",
        ".wav",
        ".ogg",
        ".pyc",
        ".pyo",
        ".pyd",
        ".class",
        ".jar",
        ".db",
        ".sqlite",
        ".sqlite3",
        ".lock",
        ".whl",
        ".egg",
        ".bin",
        ".dat",
    }
)

#: Language tag inferred from file extension for code fences.
_LANG_BY_EXT = {
    ".py": "python",
    ".js": "javascript",
    ".ts": "typescript",
    ".tsx": "tsx",
    ".jsx": "jsx",
    ".java": "java",
    ".c": "c",
    ".h": "c",
    ".cpp": "cpp",
    ".hpp": "cpp",
    ".cs": "csharp",
    ".go": "go",
    ".rs": "rust",
    ".rb": "ruby",
    ".php": "php",
    ".swift": "swift",
    ".kt": "kotlin",
    ".sh": "bash",
    ".bash": "bash",
    ".zsh": "bash",
    ".ps1": "powershell",
    ".html": "html",
    ".htm": "html",
    ".css": "css",
    ".scss": "scss",
    ".json": "json",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".toml": "toml",
    ".ini": "ini",
    ".xml": "xml",
    ".sql": "sql",
    ".md": "markdown",
    ".markdown": "markdown",
    ".txt": "text",
    ".dockerfile": "dockerfile",
}


def _looks_binary(path: Path) -> bool:
    if path.suffix.lower() in BINARY_EXTENSIONS:
        return True
    try:
        with path.open("rb") as handle:
            chunk = handle.read(1024)
    except OSError:
        return True
    return b"\x00" in chunk


def _lang_for(path: Path) -> str:
    if path.name.lower() == "dockerfile":
        return "dockerfile"
    return _LANG_BY_EXT.get(path.suffix.lower(), "")


def _build_tree(root: Path, files: Iterable[Path]) -> str:
    """Build an indented directory tree of the included files."""
    lines: list[str] = []
    for path in sorted(files, key=lambda p: str(p).lower()):
        rel = path.relative_to(root)
        depth = len(rel.parts) - 1
        lines.append("  " * depth + rel.name)
    return "\n".join(lines)


class RepoConverter(Converter):
    """Directory-oriented handler producing a single repository manifest."""

    extensions = frozenset()
    name = "repo"

    def convert(self, input_path: Path | str, output_dir: Path, exclude: Iterable[str] | None = None, **kwargs: object) -> Path:
        import subprocess
        import tempfile

        output_dir.mkdir(parents=True, exist_ok=True)
        raw_str = str(input_path).strip()

        if raw_str.startswith(("http://", "https://", "git@")) or raw_str.endswith(".git"):
            repo_name = raw_str.rstrip("/").split("/")[-1].removesuffix(".git") or "repository"
            with tempfile.TemporaryDirectory() as tmp_dir:
                tmp_path = Path(tmp_dir) / repo_name
                res = subprocess.run(["git", "clone", "--depth", "1", raw_str, str(tmp_path)], capture_output=True, text=True)
                if res.returncode != 0:
                    raise RuntimeError(f"Failed to clone git repository {raw_str}: {res.stderr.strip()}")
                return self._convert_local(tmp_path, output_dir, exclude=exclude, repo_name=repo_name)
        else:
            root = Path(input_path).resolve()
            return self._convert_local(root, output_dir, exclude=exclude, repo_name=root.name)

    def _convert_local(self, root: Path, output_dir: Path, exclude: Iterable[str] | None = None, repo_name: str | None = None) -> Path:
        name = repo_name or root.name
        spec = self._load_gitignore(root, exclude)
        files = self._collect_files(root, spec)

        sections: list[str] = [f"# Repository: {name}", ""]
        sections.append("## Tree")
        sections.append(_build_tree(root, files))
        sections.append("")
        sections.append("## Files")
        sections.append("")

        for path in sorted(files, key=lambda p: str(p).lower()):
            rel = path.relative_to(root)
            sections.append(f"=== FILE: {rel.as_posix()} ===")
            lang = _lang_for(path)
            try:
                content = path.read_text(encoding="utf-8", errors="replace")
            except OSError:
                content = ""
            if lang:
                sections.append(f"```{lang}")
                sections.append(content)
                sections.append("```")
            else:
                sections.append(content)
            sections.append("")

        manifest = output_dir / f"{name}.md"
        manifest.write_text("\n".join(sections), encoding="utf-8")
        return manifest

    def _load_gitignore(self, root: Path, exclude: Iterable[str] | None) -> pathspec.PathSpec:
        pathspec = require("pathspec", "tmd repo")

        patterns: list[str] = []
        gitignore = root / ".gitignore"
        if gitignore.exists():
            patterns.extend(line.strip() for line in gitignore.read_text(encoding="utf-8", errors="replace").splitlines() if line.strip() and not line.strip().startswith("#"))
        if exclude:
            patterns.extend(exclude)
        return pathspec.PathSpec.from_lines("gitwildmatch", patterns)

    def _collect_files(self, root: Path, spec: pathspec.PathSpec) -> list[Path]:
        files: list[Path] = []
        for dirpath, dirnames, filenames in os.walk(root):
            dirnames[:] = [d for d in dirnames if not self._ignored(root, Path(dirpath) / d, spec)]
            for filename in filenames:
                path = Path(dirpath) / filename
                if self._ignored(root, path, spec):
                    continue
                if _looks_binary(path):
                    continue
                files.append(path)
        return files

    @staticmethod
    def _ignored(root: Path, path: Path, spec: pathspec.PathSpec) -> bool:
        rel = path.relative_to(root).as_posix()
        return spec.match_file(rel)
