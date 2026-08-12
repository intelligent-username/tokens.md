from abc import ABC, abstractmethod
from collections.abc import Sequence
from pathlib import Path


class FileSelector(ABC):
    """Abstract base class for file selection strategies."""

    @abstractmethod
    def select_files(self) -> list[Path]:
        """Return a list of Path objects pointing to files to process."""
        pass


class DirectoryFileSelector(FileSelector):
    """Selects files from a specified directory based on file extensions."""

    def __init__(self, directory: str | Path, extensions: Sequence[str] = (".pdf",), recursive: bool = False):
        self.directory = Path(directory)
        self.extensions = tuple(ext.lower() if ext.startswith(".") else f".{ext.lower()}" for ext in extensions)
        self.recursive = recursive

    def select_files(self) -> list[Path]:
        if not self.directory.exists():
            return []

        pattern = "**/*" if self.recursive else "*"
        return [path for path in self.directory.glob(pattern) if path.is_file() and path.suffix.lower() in self.extensions]


class DiscreteFileSelector(FileSelector):
    """Selects a explicit, specific list of file paths."""

    def __init__(self, file_paths: Sequence[str | Path]):
        self.file_paths = [Path(p) for p in file_paths]

    def select_files(self) -> list[Path]:
        return [path for path in self.file_paths if path.is_file()]


class GlobPatternFileSelector(FileSelector):
    """Selects files matching a glob pattern."""

    def __init__(self, pattern: str, base_dir: str | Path = "."):
        self.pattern = pattern
        self.base_dir = Path(base_dir)

    def select_files(self) -> list[Path]:
        if not self.base_dir.exists():
            return []
        return [path for path in self.base_dir.glob(self.pattern) if path.is_file()]


def select_files(source: str | Path | Sequence[str | Path] | FileSelector = "in", extensions: Sequence[str] = (".pdf",), recursive: bool = False) -> list[Path]:
    """
    Convenience function to select files to convert.

    :param source: Directory path, single file path, list of file paths, or a FileSelector strategy instance.
    :param extensions: Allowed extensions when directory path is specified.
    :param recursive: Search recursively if source is a directory.
    :return: List of Path objects matching selection criteria.
    """
    if isinstance(source, FileSelector):
        return source.select_files()

    if isinstance(source, (list, tuple)):
        return DiscreteFileSelector(source).select_files()

    source_path = Path(source)
    if source_path.is_file():
        return DiscreteFileSelector([source_path]).select_files()
    else:
        # Defaults to DirectoryFileSelector
        return DirectoryFileSelector(source_path, extensions=extensions, recursive=recursive).select_files()
