"""Common error classes and helper functions for backend API routes."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi import Request

from ..config import Settings
from ..workspace import Workspace
from .constants import ERR_LOCAL_PATHS_DISABLED, ERR_LOCAL_PATHS_DISALLOWED, HTTP_FORBIDDEN


class ApiError(Exception):
    """HTTP error carrying a status code and a stable error code."""

    def __init__(self, status_code: int, code: str, message: str) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message


def _settings(request: Request) -> Settings:
    return request.app.state.settings


def _convert_kwargs(opts: Any) -> dict[str, Any]:
    """Build converter kwargs from an options object with optional fields."""
    kwargs: dict[str, Any] = {"strip_headers_footers": bool(getattr(opts, "strip_headers_footers", False)), "write_images": bool(getattr(opts, "write_images", False))}
    image_path = getattr(opts, "image_path", None)
    if image_path:
        kwargs["image_path"] = image_path
    pages = getattr(opts, "pages", None)
    if pages:
        kwargs["pages"] = pages
    return kwargs


def _resolve_upload_paths(ws: Workspace, file_ids: list[str], path: str | None, settings: Settings) -> list[tuple[str | None, Path]]:
    """Resolve either manifest file_ids or a gated server-side path."""
    if path is not None:
        if not settings.allow_local_paths:
            raise ApiError(HTTP_FORBIDDEN, ERR_LOCAL_PATHS_DISABLED, "Server-side paths are disabled")
        resolved = Path(path).resolve()
        root = settings.local_paths_root.resolve()
        if not resolved.is_relative_to(root):
            raise ApiError(HTTP_FORBIDDEN, ERR_LOCAL_PATHS_DISALLOWED, "Path outside allowed root")
        if resolved.is_dir():
            from src.file_selector import select_files
            from src.registry import DEFAULT_REGISTRY

            files = select_files(resolved, extensions=list(DEFAULT_REGISTRY.extensions()), recursive=True)
            return [(None, f) for f in files]
        return [(None, resolved)]
    return [(fid, ws.resolve_upload(fid)) for fid in file_ids]
