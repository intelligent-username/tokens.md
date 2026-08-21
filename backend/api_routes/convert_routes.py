"""Conversion, merge, budget, delta, fetch, repo, and clip API routes."""

from __future__ import annotations

import logging
import shutil
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from fastapi import APIRouter, Request

from src.budget import prune_to_budget
from src.delta import compute_delta_summary
from src.fetch import fetch_url
from src.handlers.repo import RepoConverter
from src.merger import merge_files, resolve_to_markdown
from src.registry import UnsupportedFormatError, convert_file
from src.tokenizer import DEFAULT_ENCODING, count_raw_file_tokens, count_tokens, count_tokens_in_file, delta_percent

from ..schemas import BudgetRequest, BudgetResponse, ClipRequest, ClipResponse, ConvertItem, ConvertRequest, ConvertResponse, DeltaEntry, DeltaRequest, DeltaResponse, FetchRequest, FetchResponse, MergeRequest, MergeResponse, PruneResult, RepoRequest, RepoResponse
from ..workspace import Workspace, sanitize_name
from .common import ApiError, _convert_kwargs, _resolve_upload_paths, _settings
from .constants import ERR_BAD_REQUEST, ERR_UNSUPPORTED_FORMAT, HTTP_BAD_REQUEST, HTTP_UNPROCESSABLE_ENTITY

logger = logging.getLogger("backend")
router = APIRouter()


@router.post("/convert", response_model=ConvertResponse)
def convert(req: ConvertRequest, request: Request) -> ConvertResponse:
    ws = Workspace(req.session_id)
    settings = _settings(request)
    targets = _resolve_upload_paths(ws, req.file_ids, req.path, settings)
    if req.options.extensions:
        exts = {ext if ext.startswith(".") else f".{ext}" for ext in req.options.extensions}
        targets = [(fid, path) for fid, path in targets if path.suffix.lower() in exts]
    kwargs = _convert_kwargs(req.options)

    def _process_target(item: tuple[str | None, Path]) -> ConvertItem:
        file_id, path = item
        try:
            out = convert_file(path, ws.output_dir, **kwargs)
            markdown = out.read_text(encoding="utf-8", errors="replace")
            source_tokens = count_raw_file_tokens(path)
            target_tokens = count_tokens(markdown, DEFAULT_ENCODING)
            out_id = ws.register_output(out, target_tokens)
            return ConvertItem(file_id=file_id or "", name=path.name, status="done", output_file_id=out_id, output_name=out.name, output_size=out.stat().st_size, source_tokens=source_tokens, target_tokens=target_tokens, percent=delta_percent(source_tokens, target_tokens))
        except UnsupportedFormatError as exc:
            return ConvertItem(file_id=file_id or "", name=path.name, status="error", error=str(exc))

    with ThreadPoolExecutor() as executor:
        results = list(executor.map(_process_target, targets))

    converted = sum(1 for r in results if r.status == "done")
    failed = sum(1 for r in results if r.status == "error")
    total_source = sum(r.source_tokens for r in results if r.source_tokens)
    total_target = sum(r.target_tokens for r in results if r.target_tokens)

    return ConvertResponse(results=results, converted_count=converted, failed_count=failed, total_source_tokens=total_source, total_target_tokens=total_target, total_percent=delta_percent(total_source, total_target))


@router.post("/merge", response_model=MergeResponse)
def merge(req: MergeRequest, request: Request) -> MergeResponse:
    ws = Workspace(req.session_id)
    settings = _settings(request)
    targets = _resolve_upload_paths(ws, req.file_ids, req.path, settings)
    paths = [path for _, path in targets]
    if not paths:
        raise ApiError(HTTP_BAD_REQUEST, ERR_BAD_REQUEST, "No files found to merge")
    opts = req.options
    encoding = opts.encoding or DEFAULT_ENCODING
    output_path = ws.output_dir / sanitize_name(req.output_name)
    ws.enforce_within(output_path)
    include_tokens = opts.budget is not None or opts.delta
    merge_files(paths, output_path, no_convert=opts.no_convert, dedup=opts.dedup, toc=not opts.no_toc, encoding=encoding, include_tokens=include_tokens, **_convert_kwargs(opts))
    source_tokens = sum(count_raw_file_tokens(p) for p in paths)
    target_tokens = count_tokens_in_file(output_path, encoding)

    prune: PruneResult | None = None
    if opts.budget is not None:
        try:
            result = prune_to_budget(output_path.read_text(encoding="utf-8"), opts.budget, encoding)
            output_path.write_text(result.content, encoding="utf-8")
            target_tokens = count_tokens(result.content, encoding)
            prune = PruneResult(fits=result.fits, removed_tokens=result.removed_tokens, removed_blocks=result.removed_blocks, budget=opts.budget, final_tokens=target_tokens)
        except Exception as exc:
            logger.warning("Pruning error ignored during merge: %s", exc)

    delta_entries: list[DeltaEntry] | None = None
    if opts.delta:
        delta_entries = [DeltaEntry(**entry) for entry in compute_delta_summary(paths, [output_path], encoding)]

    out_id = ws.register_output(output_path, target_tokens)
    return MergeResponse(output_file_id=out_id, output_name=output_path.name, source_tokens=source_tokens, target_tokens=target_tokens, percent=delta_percent(source_tokens, target_tokens), prune=prune, delta_entries=delta_entries)


@router.post("/budget", response_model=BudgetResponse)
def budget(req: BudgetRequest) -> BudgetResponse:
    ws = Workspace(req.session_id)
    encoding = req.encoding or DEFAULT_ENCODING
    if req.text is not None:
        content = req.text
    elif req.file_id:
        content = ws.resolve_upload(req.file_id).read_text(encoding="utf-8", errors="replace")
    else:
        raise ApiError(HTTP_BAD_REQUEST, ERR_BAD_REQUEST, "Provide file_id or text")
    result = prune_to_budget(content, req.budget, encoding)
    return BudgetResponse(fits=result.fits, original_tokens=count_tokens(content, encoding), final_tokens=count_tokens(result.content, encoding), removed_tokens=result.removed_tokens, removed_blocks=result.removed_blocks)


@router.post("/delta", response_model=DeltaResponse)
def delta(req: DeltaRequest) -> DeltaResponse:
    ws = Workspace(req.session_id)
    encoding = req.encoding or DEFAULT_ENCODING
    sources = [ws.resolve_upload(fid) for fid in req.file_ids]
    outputs = [ws.output_dir / f"{path.stem}.md" for path in sources]
    entries = [DeltaEntry(**entry) for entry in compute_delta_summary(sources, outputs, encoding)]
    total_source = sum(entry.source_tokens for entry in entries)
    total_target = sum(entry.target_tokens for entry in entries)
    return DeltaResponse(entries=entries, total_source_tokens=total_source, total_target_tokens=total_target, total_percent=delta_percent(total_source, total_target))


@router.post("/fetch", response_model=FetchResponse)
def fetch(req: FetchRequest, request: Request) -> FetchResponse:
    ws = Workspace(req.session_id) if req.session_id else Workspace()
    ua = req.user_agent or request.headers.get("user-agent")
    client_ip = request.client.host if request.client else "unknown"
    try:
        out = fetch_url(req.url, ws.output_dir, user_agent=ua)
    except Exception as exc:
        logger.warning(f"[FETCH ERROR 422] Client: {client_ip} | Target URL: '{req.url}' | Reason: {exc}", exc_info=True)
        raise ApiError(HTTP_UNPROCESSABLE_ENTITY, ERR_UNSUPPORTED_FORMAT, f"Unreachable or invalid link '{req.url}': {exc}") from exc

    target_tokens = count_tokens_in_file(out)
    out_id = ws.register_output(out, target_tokens)
    return FetchResponse(session_id=ws.sid, output_file_id=out_id, output_name=out.name, target_tokens=target_tokens, url=req.url)


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
        source_tokens = sum(int(ws.upload_meta(fid)["source_tokens"]) for fid in req.file_ids)
    out = RepoConverter().convert(root, ws.output_dir, exclude=req.exclude)
    target_tokens = count_tokens_in_file(out)
    out_id = ws.register_output(out, target_tokens)
    file_count = sum(1 for p in root.rglob("*") if p.is_file())
    return RepoResponse(output_file_id=out_id, output_name=out.name, target_tokens=target_tokens, source_tokens=source_tokens, percent=delta_percent(source_tokens, target_tokens), file_count=file_count)


@router.post("/clip", response_model=ClipResponse)
def clip(req: ClipRequest) -> ClipResponse:
    ws = Workspace(req.session_id)
    targets = [ws.resolve_upload(fid) for fid in req.file_ids]
    kwargs = _convert_kwargs(req.options)
    parts = [resolve_to_markdown(path, **kwargs) for path in targets]
    text = "\n\n".join(parts)
    return ClipResponse(text=text, chars=len(text), lines=len(text.splitlines()), tokens=count_tokens(text, DEFAULT_ENCODING), file_count=len(targets))
