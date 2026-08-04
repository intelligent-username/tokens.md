"""REST + WebSocket handlers for the tokens.md web API.

Handlers are plain ``def`` so FastAPI runs them in the threadpool, keeping the
WebSocket event loop responsive. They are thin wrappers over ``src.*`` and the
``Workspace``; no conversion logic lives here.
"""

from __future__ import annotations

import json
import shutil
import threading
from pathlib import Path
from typing import Any

from fastapi import APIRouter, File, Form, Request, UploadFile, WebSocket
from fastapi import WebSocketDisconnect
from fastapi.responses import FileResponse

from src import __version__
from src.budget import prune_to_budget
from src.delta import compute_delta_summary
from src.fetch import fetch_url
from src.handlers.repo import RepoConverter
from src.merger import merge_files, resolve_to_markdown
from src.registry import DEFAULT_REGISTRY, UnsupportedFormatError, convert_file
from src.tokenizer import (
    DEFAULT_ENCODING,
    count_raw_file_tokens,
    count_tokens,
    count_tokens_in_file,
    delta_percent,
)
from src.watcher import run_watcher

from .config import Settings
from .schemas import (
    BudgetRequest,
    BudgetResponse,
    ClipRequest,
    ClipResponse,
    ConvertItem,
    ConvertRequest,
    ConvertResponse,
    DeltaEntry,
    DeltaRequest,
    DeltaResponse,
    ErrorBody,
    FetchRequest,
    FetchResponse,
    FileMeta,
    FilesResponse,
    MergeRequest,
    MergeResponse,
    OutputFile,
    PruneResult,
    RepoRequest,
    RepoResponse,
    SampleInfo,
    SamplesResponse,
    SessionCloseRequest,
    SessionCloseResponse,
    UploadResponse,
    WatchOptions,
    WatchStartRequest,
    WatchStartResponse,
    WatchStatusResponse,
    WatchStopRequest,
    WatchStopResponse,
)
from .workspace import (
    NotFoundError,
    Workspace,
    list_samples,
    read_sample,
    sanitize_name,
    sanitize_relpath,
)

router = APIRouter()


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
    kwargs: dict[str, Any] = {
        "strip_headers_footers": bool(getattr(opts, "strip_headers_footers", False)),
        "write_images": bool(getattr(opts, "write_images", False)),
    }
    image_path = getattr(opts, "image_path", None)
    if image_path:
        kwargs["image_path"] = image_path
    pages = getattr(opts, "pages", None)
    if pages:
        kwargs["pages"] = pages
    return kwargs


def _resolve_upload_paths(
    ws: Workspace,
    file_ids: list[str],
    path: str | None,
    settings: Settings,
) -> list[tuple[str | None, Path]]:
    """Resolve either manifest file_ids or a gated server-side path."""
    if path is not None:
        if not settings.allow_local_paths:
            raise ApiError(403, "local_paths_disabled", "Server-side paths are disabled")
        resolved = Path(path).resolve()
        root = settings.local_paths_root.resolve()
        if not resolved.is_relative_to(root):
            raise ApiError(403, "local_paths_disallowed", "Path outside allowed root")
        return [(None, resolved)]
    return [(fid, ws.resolve_upload(fid)) for fid in file_ids]


# -- 1. health -----------------------------------------------------------
@router.get("/health")
def health() -> dict[str, object]:
    return {
        "version": __version__,
        "encoding": DEFAULT_ENCODING,
        "extensions": sorted(ext.lstrip(".") for ext in DEFAULT_REGISTRY.extensions()),
    }


# -- 2. config -----------------------------------------------------------
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


# -- 3. uploads ----------------------------------------------------------
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
        if upload.size is not None and upload.size > settings.max_upload_mb * 1024 * 1024:
            raise ApiError(413, "too_large", f"File exceeds {settings.max_upload_mb} MB limit")
        rel = sanitize_relpath(relpaths[index] if index < len(relpaths) else "")
        name = sanitize_name(upload.filename or f"file-{index}")
        parent = ws.uploads_dir if rel == Path() else ws.uploads_dir / rel
        parent.mkdir(parents=True, exist_ok=True)
        dest = ws.unique_dest(parent, name)
        with dest.open("wb") as handle:
            shutil.copyfileobj(upload.file, handle, length=1024 * 1024)
        if ws.session_size() > settings.max_session_mb * 1024 * 1024:
            raise ApiError(413, "too_large", "Session size limit exceeded")
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


# -- 4. convert ----------------------------------------------------------
@router.post("/convert", response_model=ConvertResponse)
def convert(req: ConvertRequest, request: Request) -> ConvertResponse:
    ws = Workspace(req.session_id)
    settings = _settings(request)
    targets = _resolve_upload_paths(ws, req.file_ids, req.path, settings)
    if req.options.extensions:
        exts = {
            ext if ext.startswith(".") else f".{ext}"
            for ext in req.options.extensions
        }
        targets = [
            (fid, path) for fid, path in targets if path.suffix.lower() in exts
        ]
    kwargs = _convert_kwargs(req.options)

    results: list[ConvertItem] = []
    total_source = 0
    total_target = 0
    converted = 0
    failed = 0
    for file_id, path in targets:
        try:
            out = convert_file(path, ws.output_dir, **kwargs)
            markdown = out.read_text(encoding="utf-8", errors="replace")
            source_tokens = count_raw_file_tokens(path)
            target_tokens = count_tokens(markdown, DEFAULT_ENCODING)
            out_id = ws.register_output(out, target_tokens)
            results.append(
                ConvertItem(
                    file_id=file_id or "",
                    name=path.name,
                    status="done",
                    output_file_id=out_id,
                    output_name=out.name,
                    source_tokens=source_tokens,
                    target_tokens=target_tokens,
                    percent=delta_percent(source_tokens, target_tokens),
                )
            )
            converted += 1
            total_source += source_tokens
            total_target += target_tokens
        except UnsupportedFormatError as exc:
            failed += 1
            results.append(
                ConvertItem(
                    file_id=file_id or "",
                    name=path.name,
                    status="error",
                    error=str(exc),
                )
            )
    return ConvertResponse(
        results=results,
        converted_count=converted,
        failed_count=failed,
        total_source_tokens=total_source,
        total_target_tokens=total_target,
        total_percent=delta_percent(total_source, total_target),
    )


# -- 5. merge ------------------------------------------------------------
@router.post("/merge", response_model=MergeResponse)
def merge(req: MergeRequest, request: Request) -> MergeResponse:
    ws = Workspace(req.session_id)
    settings = _settings(request)
    targets = _resolve_upload_paths(ws, req.file_ids, req.path, settings)
    paths = [path for _, path in targets]
    opts = req.options
    encoding = opts.encoding or DEFAULT_ENCODING
    output_path = ws.output_dir / sanitize_name(req.output_name)
    ws.enforce_within(output_path)
    include_tokens = opts.budget is not None or opts.delta
    merge_files(
        paths,
        output_path,
        no_convert=opts.no_convert,
        dedup=opts.dedup,
        toc=not opts.no_toc,
        encoding=encoding,
        include_tokens=include_tokens,
        **_convert_kwargs(opts),
    )
    source_tokens = sum(count_raw_file_tokens(p) for p in paths)
    target_tokens = count_tokens_in_file(output_path, encoding)

    prune: PruneResult | None = None
    if opts.budget is not None:
        result = prune_to_budget(
            output_path.read_text(encoding="utf-8"), opts.budget, encoding
        )
        output_path.write_text(result.content, encoding="utf-8")
        target_tokens = count_tokens(result.content, encoding)
        prune = PruneResult(
            fits=result.fits,
            removed_tokens=result.removed_tokens,
            removed_blocks=result.removed_blocks,
            budget=opts.budget,
            final_tokens=target_tokens,
        )

    delta_entries: list[DeltaEntry] | None = None
    if opts.delta:
        delta_entries = [
            DeltaEntry(**entry)
            for entry in compute_delta_summary(paths, [output_path], encoding)
        ]

    out_id = ws.register_output(output_path, target_tokens)
    return MergeResponse(
        output_file_id=out_id,
        output_name=output_path.name,
        source_tokens=source_tokens,
        target_tokens=target_tokens,
        percent=delta_percent(source_tokens, target_tokens),
        prune=prune,
        delta_entries=delta_entries,
    )


# -- 6. budget -----------------------------------------------------------
@router.post("/budget", response_model=BudgetResponse)
def budget(req: BudgetRequest) -> BudgetResponse:
    ws = Workspace(req.session_id)
    encoding = req.encoding or DEFAULT_ENCODING
    if req.text is not None:
        content = req.text
    elif req.file_id:
        content = ws.resolve_upload(req.file_id).read_text(
            encoding="utf-8", errors="replace"
        )
    else:
        raise ApiError(400, "bad_request", "Provide file_id or text")
    result = prune_to_budget(content, req.budget, encoding)
    return BudgetResponse(
        fits=result.fits,
        original_tokens=count_tokens(content, encoding),
        final_tokens=count_tokens(result.content, encoding),
        removed_tokens=result.removed_tokens,
        removed_blocks=result.removed_blocks,
    )


# -- 7. delta ------------------------------------------------------------
@router.post("/delta", response_model=DeltaResponse)
def delta(req: DeltaRequest) -> DeltaResponse:
    ws = Workspace(req.session_id)
    encoding = req.encoding or DEFAULT_ENCODING
    sources = [ws.resolve_upload(fid) for fid in req.file_ids]
    outputs = [ws.output_dir / f"{path.stem}.md" for path in sources]
    entries = [
        DeltaEntry(**entry)
        for entry in compute_delta_summary(sources, outputs, encoding)
    ]
    total_source = sum(entry.source_tokens for entry in entries)
    total_target = sum(entry.target_tokens for entry in entries)
    return DeltaResponse(
        entries=entries,
        total_source_tokens=total_source,
        total_target_tokens=total_target,
        total_percent=delta_percent(total_source, total_target),
    )


# -- 8. fetch ------------------------------------------------------------
@router.post("/fetch", response_model=FetchResponse)
def fetch(req: FetchRequest) -> FetchResponse:
    ws = Workspace(req.session_id) if req.session_id else Workspace()
    try:
        out = fetch_url(req.url, ws.output_dir)
    except UnsupportedFormatError as exc:
        raise ApiError(422, "unsupported_format", str(exc)) from exc
    target_tokens = count_tokens_in_file(out)
    out_id = ws.register_output(out, target_tokens)
    return FetchResponse(
        output_file_id=out_id,
        output_name=out.name,
        target_tokens=target_tokens,
        url=req.url,
    )


# -- 9. repo -------------------------------------------------------------
@router.post("/repo", response_model=RepoResponse)
def repo(req: RepoRequest, request: Request) -> RepoResponse:
    ws = Workspace(req.session_id)
    settings = _settings(request)
    if req.path is not None:
        if not settings.allow_local_paths:
            raise ApiError(403, "local_paths_disabled", "Server-side paths are disabled")
        root = Path(req.path).resolve()
        if not root.is_relative_to(settings.local_paths_root.resolve()):
            raise ApiError(403, "local_paths_disallowed", "Path outside allowed root")
        source_tokens = 0
    else:
        for file_id in req.file_ids:
            meta = ws.upload_meta(file_id)
            src = ws.resolve_upload(file_id)
            dest = ws.repo_root / str(meta["relpath"])
            ws.enforce_within(dest)
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dest)
        root = ws.repo_root
        source_tokens = sum(
            int(ws.upload_meta(fid)["source_tokens"]) for fid in req.file_ids
        )
    out = RepoConverter().convert(root, ws.output_dir, exclude=req.exclude)
    target_tokens = count_tokens_in_file(out)
    out_id = ws.register_output(out, target_tokens)
    file_count = sum(1 for p in root.rglob("*") if p.is_file())
    return RepoResponse(
        output_file_id=out_id,
        output_name=out.name,
        target_tokens=target_tokens,
        source_tokens=source_tokens,
        percent=delta_percent(source_tokens, target_tokens),
        file_count=file_count,
    )


# -- 10. clip ------------------------------------------------------------
@router.post("/clip", response_model=ClipResponse)
def clip(req: ClipRequest) -> ClipResponse:
    ws = Workspace(req.session_id)
    targets = [ws.resolve_upload(fid) for fid in req.file_ids]
    kwargs = _convert_kwargs(req.options)
    parts = [resolve_to_markdown(path, **kwargs) for path in targets]
    text = "\n\n".join(parts)
    return ClipResponse(
        text=text,
        chars=len(text),
        lines=len(text.splitlines()),
        tokens=count_tokens(text, DEFAULT_ENCODING),
        file_count=len(targets),
    )


# -- 11. files list ------------------------------------------------------
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


# -- 12. single download -------------------------------------------------
@router.get("/files/{session_id}/{file_id}/download")
def download_file(session_id: str, file_id: str) -> FileResponse:
    ws = Workspace(session_id)
    path = ws.resolve_output(file_id)
    if not path.exists():
        raise ApiError(404, "not_found", "Output file not found")
    return FileResponse(path, filename=path.name, media_type="text/markdown")


# -- 13. download-all zip ------------------------------------------------
@router.get("/files/{session_id}/download-all")
def download_all(session_id: str) -> FileResponse:
    ws = Workspace(session_id)
    zip_path = ws.build_zip()
    return FileResponse(zip_path, filename="tmd-outputs.zip", media_type="application/zip")


# -- 14. watch start -----------------------------------------------------
@router.post("/watch/start", response_model=WatchStartResponse)
def watch_start(req: WatchStartRequest, request: Request) -> WatchStartResponse:
    ws = Workspace(req.session_id)
    manager = request.app.state.ws_manager
    opts = req.options
    extensions = opts.extensions or sorted(DEFAULT_REGISTRY.extensions())
    convert_kwargs = _convert_kwargs(opts.convert_opts)
    manager.start_watch(req.session_id)
    thread = threading.Thread(
        target=_watch_thread,
        args=(req.session_id, ws, opts, extensions, convert_kwargs, manager),
        daemon=True,
    )
    thread.start()
    manager.emit(
        req.session_id,
        {
            "type": "watch.started",
            "data": {
                "watch_id": req.session_id,
                "source": str(ws.uploads_dir),
                "output": str(ws.output_dir),
                "poll_interval": opts.poll_interval,
            },
        },
    )
    return WatchStartResponse(
        watch_id=req.session_id,
        source=str(ws.uploads_dir),
        output=str(ws.output_dir),
    )


def _watch_thread(
    sid: str,
    ws: Workspace,
    opts: WatchOptions,
    extensions: list[str],
    convert_kwargs: dict[str, Any],
    manager: Any,
) -> None:
    totals = {"files": 0, "source_tokens": 0, "target_tokens": 0}

    def emit_event(event: dict[str, object]) -> None:
        status = str(event.get("event", "done"))
        data: dict[str, object] = {"file": event.get("file"), "status": status}
        if event.get("output"):
            data["output"] = event["output"]
        if event.get("error"):
            data["error"] = event["error"]
        if status == "done":
            source = Path(str(event["file"]))
            source_tokens = count_raw_file_tokens(source)
            target_tokens = 0
            if event.get("output"):
                out_path = Path(str(event["output"]))
                if out_path.exists():
                    target_tokens = count_tokens_in_file(out_path)
            data["source_tokens"] = source_tokens
            data["target_tokens"] = target_tokens
            data["percent"] = delta_percent(source_tokens, target_tokens)
            totals["files"] += 1
            totals["source_tokens"] += source_tokens
            totals["target_tokens"] += target_tokens
            manager.emit(sid, {"type": "watch.total", "data": dict(totals)})
        manager.emit(sid, {"type": "watch.file", "data": data})

    try:
        run_watcher(
            ws.uploads_dir,
            ws.output_dir,
            poll_interval=opts.poll_interval,
            clip=False,
            once=opts.once,
            extensions=extensions,
            stop_event=manager.stop_event(sid),
            on_event=emit_event,
            **convert_kwargs,
        )
    finally:
        manager.stop_watch(sid)
        manager.emit(sid, {"type": "watch.stopped", "data": {"reason": "requested"}})


# -- 15. watch stop ------------------------------------------------------
@router.post("/watch/stop", response_model=WatchStopResponse)
def stop_watch(req: WatchStopRequest, request: Request) -> WatchStopResponse:
    manager = request.app.state.ws_manager
    manager.set_stop(req.session_id)
    return WatchStopResponse(stopped=True)


# -- 16. watch status ----------------------------------------------------
@router.get("/watch/{session_id}", response_model=WatchStatusResponse)
def watch_status(session_id: str, request: Request) -> WatchStatusResponse:
    manager = request.app.state.ws_manager
    totals = manager.get_totals(session_id)
    return WatchStatusResponse(
        running=manager.is_running(session_id),
        files_processed=totals.get("files", 0),
        source_tokens=totals.get("source_tokens", 0),
        target_tokens=totals.get("target_tokens", 0),
    )


# -- 17. session close ---------------------------------------------------
@router.post("/session/close", response_model=SessionCloseResponse)
def session_close(req: SessionCloseRequest, request: Request) -> SessionCloseResponse:
    ws = Workspace(req.session_id)
    manager = request.app.state.ws_manager
    manager.set_stop(req.session_id)
    ws.close()
    return SessionCloseResponse(closed=True)


# -- 18. samples ---------------------------------------------------------
@router.get("/samples", response_model=SamplesResponse)
def samples() -> SamplesResponse:
    return SamplesResponse(
        samples=[SampleInfo(**sample) for sample in list_samples()]
    )


# -- 19. sample file -----------------------------------------------------
@router.get("/samples/{name}")
def sample_file(name: str) -> FileResponse:
    path = read_sample(name)
    return FileResponse(path, filename=path.name)


# -- 20. cancel ----------------------------------------------------------
@router.post("/session/{session_id}/cancel")
def cancel_session(session_id: str, request: Request) -> dict[str, bool]:
    manager = request.app.state.ws_manager
    manager.set_stop(session_id)
    return {"cancelled": True}


# -- WS ------------------------------------------------------------------
@router.websocket("/ws")
async def ws_endpoint(websocket: WebSocket, session_id: str) -> None:
    await websocket.accept()
    manager = websocket.app.state.ws_manager
    manager.register(session_id, websocket)
    try:
        while True:
            message = await websocket.receive_json()
            if message.get("type") == "subscribe":
                # Registration already joins the session's event stream.
                continue
    except WebSocketDisconnect:
        pass
    finally:
        manager.unregister(session_id, websocket)