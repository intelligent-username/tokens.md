"""Session workspaces under the system temp directory.

A ``Workspace`` owns the uploads/output dirs for one session, a JSON manifest
registry, zip building, a TTL janitor, and bundled demo samples. All file
reads resolve through the manifest; client-supplied paths are sanitized and
re-validated with ``resolve().is_relative_to()`` before any write.
"""

from __future__ import annotations

import json
import re
import shutil
import tempfile
import threading
import time
import uuid
import zipfile
from pathlib import Path
from typing import Any

from src.tokenizer import count_raw_file_tokens

_SAFE_RE = re.compile(r"[^A-Za-z0-9._ -]+")
_MAX_NAME = 120


class WorkspaceError(Exception):
    """Base error for workspace operations."""


class NotFoundError(WorkspaceError):
    """Raised when a manifest entry does not exist."""


class TooLargeError(WorkspaceError):
    """Raised when an upload exceeds configured limits."""


def sanitize_name(name: str) -> str:
    """Keep ``[A-Za-z0-9._ -]``, collapse runs, cap at 120 chars."""
    cleaned = _SAFE_RE.sub("_", name)
    cleaned = cleaned.strip(" .")
    if not cleaned:
        cleaned = "file"
    return cleaned[:_MAX_NAME]


def sanitize_relpath(relpath: str) -> Path:
    """Turn a client-supplied relative path into a safe subpath.

    Drops empty parts and ``..`` segments; every segment is name-sanitized.
    Returns ``Path()`` for a plain (non-folder) file.
    """
    parts: list[str] = []
    for part in relpath.replace("\\", "/").split("/"):
        part = sanitize_name(part)
        if part in {"", "."} or part == "..":
            continue
        parts.append(part)
    if not parts:
        return Path()
    return Path(*parts)


class Workspace:
    """Filesystem-backed session workspace with a JSON manifest registry."""

    def __init__(self, sid: str | None = None) -> None:
        self.sid = sid or uuid.uuid4().hex[:12]
        self.root = Path(tempfile.gettempdir()) / f"tmd-ui-{self.sid}"
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
            file_id = uuid.uuid4().hex[:12]
            self._uploads[file_id] = {
                "file_id": file_id,
                "name": name,
                "relpath": relpath,
                "source_tokens": count_raw_file_tokens(dest),
            }
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
            file_id = uuid.uuid4().hex[:12]
            self._outputs[file_id] = {
                "file_id": file_id,
                "name": path.name,
                "path": str(path),
                "target_tokens": target_tokens,
                "created": time.time(),
            }
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


def start_janitor(ttl_hours: int) -> threading.Event:
    """Start a daemon janitor thread; return a stop event."""
    stop = threading.Event()
    thread = threading.Thread(
        target=_janitor_loop, args=(ttl_hours, stop), daemon=True
    )
    thread.start()
    return stop


def _janitor_loop(ttl_hours: int, stop: threading.Event) -> None:
    while not stop.wait(3600):
        sweep_workspaces(ttl_hours)


def sweep_workspaces(ttl_hours: int) -> None:
    """Delete ``tmd-ui-*`` dirs in the temp dir older than ``ttl_hours``."""
    cutoff = time.time() - ttl_hours * 3600
    for child in Path(tempfile.gettempdir()).glob("tmd-ui-*"):
        if not child.is_dir():
            continue
        try:
            mtime = child.stat().st_mtime
        except OSError:
            continue
        if mtime < cutoff:
            shutil.rmtree(child, ignore_errors=True)


def cleanup_all() -> None:
    """Remove every ``tmd-ui-*`` temp dir (shutdown hygiene)."""
    for child in Path(tempfile.gettempdir()).glob("tmd-ui-*"):
        shutil.rmtree(child, ignore_errors=True)


SAMPLES_DIR = Path(__file__).resolve().parent / "samples"


def list_samples() -> list[dict[str, str]]:
    """List bundled demo files as ``{name, kind}`` dicts."""
    samples: list[dict[str, str]] = []
    for path in sorted(SAMPLES_DIR.iterdir()):
        if path.is_file():
            samples.append(
                {
                    "name": path.name,
                    "kind": path.suffix.lstrip(".") or "text",
                }
            )
    return samples


def read_sample(name: str) -> Path:
    """Resolve a bundled sample file name to its path (path-safe)."""
    candidate = SAMPLES_DIR / sanitize_name(name)
    if (
        not candidate.is_file()
        or not candidate.resolve().is_relative_to(SAMPLES_DIR.resolve())
    ):
        raise NotFoundError(f"Unknown sample: {name}")
    return candidate