"""Pydantic models for single-file conversion and clipboard operations."""

from __future__ import annotations

from pydantic import BaseModel, Field


class ConvertOptions(BaseModel):
    """Conversion options shared by convert / merge / clip / watch."""

    strip_headers_footers: bool = False
    write_images: bool = False
    image_path: str | None = None
    pages: list[int] | None = None
    extensions: list[str] | None = None


class ConvertItem(BaseModel):
    """Per-file result of a convert job."""

    file_id: str
    name: str
    status: str
    output_file_id: str | None = None
    output_name: str | None = None
    output_size: int | None = None
    source_tokens: int = 0
    target_tokens: int = 0
    percent: float = 0.0
    error: str | None = None


class ConvertResponse(BaseModel):
    """Aggregated result of a convert job."""

    results: list[ConvertItem]
    converted_count: int
    failed_count: int
    total_source_tokens: int
    total_target_tokens: int
    total_percent: float


class ConvertRequest(BaseModel):
    session_id: str
    file_ids: list[str] = Field(default_factory=list)
    options: ConvertOptions = Field(default_factory=ConvertOptions)
    path: str | None = None


class ClipRequest(BaseModel):
    session_id: str
    file_ids: list[str] = Field(default_factory=list)
    options: ConvertOptions = Field(default_factory=ConvertOptions)


class ClipResponse(BaseModel):
    text: str
    chars: int
    lines: int
    tokens: int
    file_count: int
