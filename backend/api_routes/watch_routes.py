"""Watch folder management and WebSocket event handler routes."""

from __future__ import annotations

import threading
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Request, WebSocket, WebSocketDisconnect

from src.registry import DEFAULT_REGISTRY
from src.tokenizer import count_raw_file_tokens, count_tokens_in_file, delta_percent
from src.watcher import run_watcher

from ..schemas import (
    WatchOptions,
    WatchStartRequest,
    WatchStartResponse,
    WatchStatusResponse,
    WatchStopRequest,
    WatchStopResponse,
)
from ..workspace import Workspace
from .common import _convert_kwargs

router = APIRouter()


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


@router.post("/watch/stop", response_model=WatchStopResponse)
def stop_watch(req: WatchStopRequest, request: Request) -> WatchStopResponse:
    manager = request.app.state.ws_manager
    manager.set_stop(req.session_id)
    return WatchStopResponse(stopped=True)


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


@router.websocket("/ws")
async def ws_endpoint(websocket: WebSocket, session_id: str) -> None:
    await websocket.accept()
    manager = websocket.app.state.ws_manager
    manager.register(session_id, websocket)
    try:
        while True:
            message = await websocket.receive_json()
            if message.get("type") == "subscribe":
                continue
    except WebSocketDisconnect:
        pass
    finally:
        manager.unregister(session_id, websocket)
