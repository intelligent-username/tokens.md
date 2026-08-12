"""Pydantic v2 request/response models for the web API."""

from __future__ import annotations

from .schema_models.common import ErrorBody, FileMeta, FilesResponse, OutputFile, SampleInfo, SamplesResponse, SessionCloseRequest, SessionCloseResponse, UploadResponse
from .schema_models.convert import ClipRequest, ClipResponse, ConvertItem, ConvertOptions, ConvertRequest, ConvertResponse
from .schema_models.transform import BudgetRequest, BudgetResponse, DeltaEntry, DeltaRequest, DeltaResponse, FetchRequest, FetchResponse, MergeOptions, MergeRequest, MergeResponse, PruneResult, RepoRequest, RepoResponse
from .schema_models.watch import WatchOptions, WatchStartRequest, WatchStartResponse, WatchStatusResponse, WatchStopRequest, WatchStopResponse

__all__ = [
    "BudgetRequest",
    "BudgetResponse",
    "ClipRequest",
    "ClipResponse",
    "ConvertItem",
    "ConvertOptions",
    "ConvertRequest",
    "ConvertResponse",
    "DeltaEntry",
    "DeltaRequest",
    "DeltaResponse",
    "ErrorBody",
    "FetchRequest",
    "FetchResponse",
    "FileMeta",
    "FilesResponse",
    "MergeOptions",
    "MergeRequest",
    "MergeResponse",
    "OutputFile",
    "PruneResult",
    "RepoRequest",
    "RepoResponse",
    "SampleInfo",
    "SamplesResponse",
    "SessionCloseRequest",
    "SessionCloseResponse",
    "UploadResponse",
    "WatchOptions",
    "WatchStartRequest",
    "WatchStartResponse",
    "WatchStatusResponse",
    "WatchStopRequest",
    "WatchStopResponse",
]
