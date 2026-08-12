"""Common response, error, file meta, and session Pydantic models."""

from __future__ import annotations

from pydantic import BaseModel


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


class UploadResponse(BaseModel):
    session_id: str
    files: list[FileMeta]


class OutputFile(BaseModel):
    file_id: str
    name: str
    size: int
    target_tokens: int
    created: float


class FilesResponse(BaseModel):
    files: list[OutputFile]


class SessionCloseRequest(BaseModel):
    session_id: str


class SessionCloseResponse(BaseModel):
    closed: bool


class SampleInfo(BaseModel):
    name: str
    kind: str


class SamplesResponse(BaseModel):
    samples: list[SampleInfo]
