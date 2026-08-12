"""Pydantic models for watch folder monitoring operations."""

from __future__ import annotations

from pydantic import BaseModel, Field

from .convert import ConvertOptions


class WatchOptions(BaseModel):
    poll_interval: float = 2.0
    extensions: list[str] | None = None
    once: bool = False
    convert_opts: ConvertOptions = Field(default_factory=ConvertOptions)


class WatchStartRequest(BaseModel):
    session_id: str
    options: WatchOptions = Field(default_factory=WatchOptions)


class WatchStartResponse(BaseModel):
    watch_id: str
    source: str
    output: str


class WatchStopRequest(BaseModel):
    session_id: str


class WatchStopResponse(BaseModel):
    stopped: bool


class WatchStatusResponse(BaseModel):
    running: bool
    started_at: float | None = None
    source: str | None = None
    output: str | None = None
    files_processed: int = 0
    source_tokens: int = 0
    target_tokens: int = 0
