"""File management, session, samples, and health API routes."""

from __future__ import annotations

import json
import shutil
from pathlib import Path

from fastapi import APIRouter, File, Form, Request, UploadFile
from fastapi.responses import FileResponse

from src import __version__
from src.registry import DEFAULT_REGISTRY
from src.tokenizer import DEFAULT_ENCODING, count_raw_file_tokens

from ..schemas import (
    FileMeta,
    FilesResponse,
    OutputFile,
    SampleInfo,
    SamplesResponse,
    SessionCloseRequest,
    SessionCloseResponse,
    UploadResponse,
)
from ..workspace import Workspace, list_samples, read_sample, sanitize_name, sanitize_relpath
from .common import ApiError, _settings
from .constants import (
    BYTES_PER_MB,
    COPY_BUFFER_SIZE,
    ERR_TOO_LARGE,
    HTTP_NOT_FOUND,
    HTTP_PAYLOAD_TOO_LARGE,
)

router = APIRouter()


@router.get("/health")
def health() -> dict[str, object]:
    return {
        "version": __version__,
        "encoding": DEFAULT_ENCODING,
        "extensions": sorted(ext.lstrip(".") for ext in DEFAULT_REGISTRY.extensions()),
    }


@router.get("/config")
def config(request: Request) -> dict[str, object]:
    settings = _settings(request)
    return {
        "extensions": sorted(ext.lstrip(".") for ext in DEFAULT_REGISTRY.extensions()),
        "limits": {
            "max_upload_mb": settings.max_upload_mb,
            "max_session_mb": settings.max_session_mb,
            "session_ttl_hours": settings.session_ttl_hours,
        },
        "feature_flags": {"allow_local_paths": settings.allow_local_paths},
    }


@router.post("/uploads", response_model=UploadResponse, status_code=201)
def upload_files(
    files: list[UploadFile] = File(...),
    paths: str = Form("[]"),
    session_id: str | None = Form(None),
    request: Request = None,  # type: ignore[assignment]
) -> UploadResponse:
    settings = _settings(request)
    ws = Workspace(session_id)
    try:
        relpaths = json.loads(paths)
    except ValueError:
        relpaths = []
    if not isinstance(relpaths, list):
        relpaths = []

    metas: list[FileMeta] = []
    for index, upload in enumerate(files):
        if upload.size is not None and upload.size > settings.max_upload_mb * BYTES_PER_MB:
            raise ApiError(HTTP_PAYLOAD_TOO_LARGE, ERR_TOO_LARGE, f"File exceeds {settings.max_upload_mb} MB limit")
        rel = sanitize_relpath(relpaths[index] if index < len(relpaths) else "")
        name = sanitize_name(upload.filename or f"file-{index}")
        parent = ws.uploads_dir if rel == Path() else ws.uploads_dir / rel
        parent.mkdir(parents=True, exist_ok=True)
        dest = ws.unique_dest(parent, name)
        with dest.open("wb") as handle:
            shutil.copyfileobj(upload.file, handle, length=COPY_BUFFER_SIZE)
        if ws.session_size() > settings.max_session_mb * BYTES_PER_MB:
            raise ApiError(HTTP_PAYLOAD_TOO_LARGE, ERR_TOO_LARGE, "Session size limit exceeded")
        stored_rel = dest.name if rel == Path() else (rel / dest.name).as_posix()
        file_id = ws.register_upload(dest, dest.name, stored_rel)
        metas.append(
            FileMeta(
                file_id=file_id,
                name=dest.name,
                relpath=stored_rel,
                size=dest.stat().st_size,
                source_tokens=count_raw_file_tokens(dest),
            )
        )
    return UploadResponse(session_id=ws.sid, files=metas)


@router.get("/files/{session_id}", response_model=FilesResponse)
def list_files(session_id: str) -> FilesResponse:
    ws = Workspace(session_id)
    files: list[OutputFile] = []
    for entry in ws.list_outputs():
        path = Path(str(entry["path"]))
        size = path.stat().st_size if path.exists() else 0
        files.append(
            OutputFile(
                file_id=str(entry["file_id"]),
                name=str(entry["name"]),
                size=size,
                target_tokens=int(entry["target_tokens"]),
                created=float(entry["created"]),
            )
        )
    return FilesResponse(files=files)


@router.get("/files/{session_id}/{file_id}/download")
def download_file(session_id: str, file_id: str) -> FileResponse:
    ws = Workspace(session_id)
    path = ws.resolve_output(file_id)
    if not path.exists():
        raise ApiError(HTTP_NOT_FOUND, "not_found", "Output file not found")
    return FileResponse(path, filename=path.name, media_type="text/markdown")


@router.get("/files/{session_id}/download-all")
def download_all(session_id: str) -> FileResponse:
    ws = Workspace(session_id)
    zip_path = ws.build_zip()
    return FileResponse(zip_path, filename="tmd-outputs.zip", media_type="application/zip")


@router.post("/session/close", response_model=SessionCloseResponse)
def session_close(req: SessionCloseRequest, request: Request) -> SessionCloseResponse:
    ws = Workspace(req.session_id)
    manager = request.app.state.ws_manager
    manager.set_stop(req.session_id)
    ws.close()
    return SessionCloseResponse(closed=True)


@router.get("/samples", response_model=SamplesResponse)
def samples() -> SamplesResponse:
    return SamplesResponse(
        samples=[SampleInfo(**sample) for sample in list_samples()]
    )


@router.get("/samples/{name}")
def sample_file(name: str) -> FileResponse:
    path = read_sample(name)
    return FileResponse(path, filename=path.name)


@router.post("/session/{session_id}/cancel")
def cancel_session(session_id: str, request: Request) -> dict[str, bool]:
    manager = request.app.state.ws_manager
    manager.set_stop(session_id)
    return {"cancelled": True}
