"""Session workspaces under the system temp directory."""

from __future__ import annotations

import json
import shutil
import tempfile
import threading
import time
import uuid
import zipfile
from pathlib import Path
from typing import Any

from src.tokenizer import count_raw_file_tokens

from .workspace_support.constants import ID_HEX_LENGTH, WORKSPACE_DIR_PREFIX
from .workspace_support.janitor import cleanup_all, start_janitor, sweep_workspaces
from .workspace_support.samples import SAMPLES_DIR, list_samples, read_sample_path
from .workspace_support.sanitizer import sanitize_name, sanitize_relpath


class WorkspaceError(Exception):
    """Base error for workspace operations."""


class NotFoundError(WorkspaceError):
    """Raised when a manifest entry does not exist."""


class TooLargeError(WorkspaceError):
    """Raised when an upload exceeds configured limits."""


def read_sample(name: str) -> Path:
    """Resolve a bundled sample file name to its path (path-safe)."""
    return read_sample_path(name, NotFoundError)


class Workspace:
    """Filesystem-backed session workspace with a JSON manifest registry."""

    def __init__(self, sid: str | None = None) -> None:
        self.sid = sid or uuid.uuid4().hex[:ID_HEX_LENGTH]
        self.root = Path(tempfile.gettempdir()) / f"{WORKSPACE_DIR_PREFIX}{self.sid}"
        self.uploads_dir = self.root / "uploads"
        self.output_dir = self.root / "output"
        self.repo_root = self.root / "repo"
        self.manifest_path = self.root / "manifest.json"
        self._lock = threading.Lock()
        self._uploads: dict[str, dict[str, Any]] = {}
        self._outputs: dict[str, dict[str, Any]] = {}
        self._load_manifest()
        self.uploads_dir.mkdir(parents=True, exist_ok=True)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.repo_root.mkdir(parents=True, exist_ok=True)

    def _load_manifest(self) -> None:
        if not self.manifest_path.exists():
            return
        try:
            data = json.loads(self.manifest_path.read_text(encoding="utf-8"))
        except (ValueError, OSError):
            return
        self._uploads = data.get("uploads", {})
        self._outputs = data.get("outputs", {})

    def _save_manifest(self) -> None:
        payload = {"uploads": self._uploads, "outputs": self._outputs}
        self.manifest_path.write_text(json.dumps(payload), encoding="utf-8")

    def enforce_within(self, path: Path) -> Path:
        """Resolve ``path`` and require it to stay inside the workspace root."""
        resolved = path.resolve()
        root = self.root.resolve()
        if not resolved.is_relative_to(root):
            raise WorkspaceError("Path escapes workspace root")
        return resolved

    def unique_dest(self, directory: Path, name: str) -> Path:
        """Return ``directory/name`` or the next free ``name-2.ext`` variant."""
        candidate = directory / name
        if not candidate.exists():
            return candidate
        stem, suffix = candidate.stem, candidate.suffix
        index = 2
        while True:
            candidate = directory / f"{stem}-{index}{suffix}"
            if not candidate.exists():
                return candidate
            index += 1

    def register_upload(self, dest: Path, name: str, relpath: str) -> str:
        """Register an uploaded file in the manifest and return its file_id."""
        with self._lock:
            file_id = uuid.uuid4().hex[:ID_HEX_LENGTH]
            self._uploads[file_id] = {"file_id": file_id, "name": name, "relpath": relpath, "source_tokens": count_raw_file_tokens(dest)}
            self._save_manifest()
            return file_id

    def upload_meta(self, file_id: str) -> dict[str, Any]:
        """Return the manifest entry for an upload (read-only)."""
        with self._lock:
            entry = self._uploads.get(file_id)
        if entry is None:
            raise NotFoundError(f"Unknown file_id: {file_id}")
        return dict(entry)

    def resolve_upload(self, file_id: str) -> Path:
        """Resolve an upload file_id to a path via the manifest only."""
        entry = self.upload_meta(file_id)
        relpath = str(entry["relpath"])
        return self.enforce_within(self.uploads_dir / relpath)

    def register_output(self, path: Path, target_tokens: int) -> str:
        """Register a converted output in the manifest and return its file_id."""
        with self._lock:
            file_id = uuid.uuid4().hex[:ID_HEX_LENGTH]
            self._outputs[file_id] = {"file_id": file_id, "name": path.name, "path": str(path), "target_tokens": target_tokens, "created": time.time()}
            self._save_manifest()
            return file_id

    def resolve_output(self, file_id: str) -> Path:
        """Resolve an output file_id to a path via the manifest only."""
        with self._lock:
            entry = self._outputs.get(file_id)
        if entry is None:
            raise NotFoundError(f"Unknown file_id: {file_id}")
        return self.enforce_within(Path(str(entry["path"])))

    def list_outputs(self) -> list[dict[str, Any]]:
        """Return copies of all registered output manifest entries."""
        with self._lock:
            return [dict(entry) for entry in self._outputs.values()]

    def list_uploads(self) -> list[dict[str, Any]]:
        """Return copies of all registered upload manifest entries."""
        with self._lock:
            return [dict(entry) for entry in self._uploads.values()]

    def session_size(self) -> int:
        """Total bytes currently stored in the workspace."""
        total = 0
        for path in self.root.rglob("*"):
            if path.is_file():
                try:
                    total += path.stat().st_size
                except OSError:
                    pass
        return total

    def build_zip(self) -> Path:
        """Zip all registered outputs next to the workspace and return the path."""
        zip_path = self.root / f"{self.sid}-outputs.zip"
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            for entry in self.list_outputs():
                path = Path(str(entry["path"]))
                if path.exists():
                    zf.write(path, arcname=str(entry["name"]))
        return zip_path

    def close(self) -> None:
        """Delete the workspace directory tree."""
        shutil.rmtree(self.root, ignore_errors=True)


__all__ = ["NotFoundError", "SAMPLES_DIR", "TooLargeError", "Workspace", "WorkspaceError", "cleanup_all", "list_samples", "read_sample", "sanitize_name", "sanitize_relpath", "start_janitor", "sweep_workspaces"]
