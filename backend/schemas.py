"""Pydantic v2 request/response models for the web API.

Every response involving a converted artifact carries ``source_tokens``,
``target_tokens`` and ``percent`` (via ``src.tokenizer.delta_percent``).
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class ErrorBody(BaseModel):
    """Uniform error envelope: ``{code, message}``."""

    code: str
    message: str


class FileMeta(BaseModel):
    """Metadata for one uploaded file."""

    file_id: str
    name: str
    relpath: str
    size: int
    source_tokens: int


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


class MergeOptions(BaseModel):
    recursive: bool = False
    budget: int | None = None
    encoding: str | None = None
    no_convert: bool = False
    dedup: bool = False
    no_toc: bool = False
    delta: bool = False
    strip_headers_footers: bool = False
    write_images: bool = False
    image_path: str | None = None
    pages: list[int] | None = None


class MergeRequest(BaseModel):
    session_id: str
    file_ids: list[str] = Field(default_factory=list)
    output_name: str = "merged.md"
    options: MergeOptions = Field(default_factory=MergeOptions)
    path: str | None = None


class PruneResult(BaseModel):
    fits: bool
    removed_tokens: int
    removed_blocks: list[str]
    budget: int
    final_tokens: int


class DeltaEntry(BaseModel):
    name: str
    source_tokens: int
    target_tokens: int
    percent: float


class MergeResponse(BaseModel):
    output_file_id: str
    output_name: str
    source_tokens: int
    target_tokens: int
    percent: float
    prune: PruneResult | None = None
    delta_entries: list[DeltaEntry] | None = None


class BudgetRequest(BaseModel):
    session_id: str
    file_id: str | None = None
    text: str | None = None
    budget: int
    encoding: str | None = None


class BudgetResponse(BaseModel):
    fits: bool
    original_tokens: int
    final_tokens: int
    removed_tokens: int
    removed_blocks: list[str]


class DeltaRequest(BaseModel):
    session_id: str
    file_ids: list[str] = Field(default_factory=list)
    encoding: str | None = None


class DeltaResponse(BaseModel):
    entries: list[DeltaEntry]
    total_source_tokens: int
    total_target_tokens: int
    total_percent: float


class FetchRequest(BaseModel):
    url: str
    session_id: str | None = None


class FetchResponse(BaseModel):
    output_file_id: str
    output_name: str
    target_tokens: int
    source_tokens: int = 0
    percent: float = 0.0
    url: str


class RepoRequest(BaseModel):
    session_id: str
    file_ids: list[str] = Field(default_factory=list)
    exclude: list[str] = Field(default_factory=list)
    path: str | None = None


class RepoResponse(BaseModel):
    output_file_id: str
    output_name: str
    target_tokens: int
    source_tokens: int
    percent: float
    file_count: int


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


class OutputFile(BaseModel):
    file_id: str
    name: str
    size: int
    target_tokens: int
    created: float


class FilesResponse(BaseModel):
    files: list[OutputFile]


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


class SessionCloseRequest(BaseModel):
    session_id: str


class SessionCloseResponse(BaseModel):
    closed: bool


class SampleInfo(BaseModel):
    name: str
    kind: str


class SamplesResponse(BaseModel):
    samples: list[SampleInfo]


class UploadResponse(BaseModel):
    session_id: str
    files: list[FileMeta]