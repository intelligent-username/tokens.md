"""Pydantic models for merge, budget, delta, fetch, and repo operations."""

from __future__ import annotations

from pydantic import BaseModel, Field


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
    warning: str | None = None


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
    user_agent: str | None = None


class FetchResponse(BaseModel):
    session_id: str
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
