"""Environment-driven settings for the web backend.

Reads ``TMD_*`` environment variables. No ``pydantic-settings`` dependency is
required; a plain dataclass keeps the web extra minimal.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8642
DEFAULT_MAX_UPLOAD_MB = 100
DEFAULT_MAX_SESSION_MB = 1000
DEFAULT_SESSION_TTL_HOURS = 24
DEFAULT_CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"
DEFAULT_LOG_LEVEL = "info"


def _env_int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def _env_bool(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _resolve_ui_dir(env_value: str | None) -> Path | None:
    """Resolve the built frontend directory.

    Order: ``TMD_UI_DIR`` env -> wheel ``tmd_ui_static`` -> repo ``frontend/out``.
    """
    if env_value:
        candidate = Path(env_value)
        if candidate.is_dir():
            return candidate
    wheel_static = Path(__file__).resolve().parent.parent / "tmd_ui_static"
    if wheel_static.is_dir():
        return wheel_static
    repo_out = Path(__file__).resolve().parent.parent / "frontend" / "out"
    if repo_out.is_dir():
        return repo_out
    return None


@dataclass
class Settings:
    """Runtime configuration for the web backend."""

    host: str = DEFAULT_HOST
    port: int = DEFAULT_PORT
    max_upload_mb: int = DEFAULT_MAX_UPLOAD_MB
    max_session_mb: int = DEFAULT_MAX_SESSION_MB
    session_ttl_hours: int = DEFAULT_SESSION_TTL_HOURS
    cors_origins: list[str] = field(default_factory=lambda: list(DEFAULT_CORS_ORIGINS.split(",")))
    ui_dir: Path | None = None
    allow_local_paths: bool = False
    local_paths_root: Path = field(default_factory=Path.cwd)
    log_level: str = DEFAULT_LOG_LEVEL

    @classmethod
    def from_env(cls) -> Settings:
        """Build settings from ``TMD_*`` environment variables."""
        return cls(
            host=os.environ.get("TMD_HOST", DEFAULT_HOST),
            port=_env_int("TMD_PORT", DEFAULT_PORT),
            max_upload_mb=_env_int("TMD_MAX_UPLOAD_MB", DEFAULT_MAX_UPLOAD_MB),
            max_session_mb=_env_int("TMD_MAX_SESSION_MB", DEFAULT_MAX_SESSION_MB),
            session_ttl_hours=_env_int("TMD_SESSION_TTL_HOURS", DEFAULT_SESSION_TTL_HOURS),
            cors_origins=[origin.strip() for origin in os.environ.get("TMD_CORS_ORIGINS", DEFAULT_CORS_ORIGINS).split(",") if origin.strip()],
            ui_dir=_resolve_ui_dir(os.environ.get("TMD_UI_DIR")),
            allow_local_paths=_env_bool("TMD_ALLOW_LOCAL_PATHS", False),
            local_paths_root=Path(os.environ.get("TMD_LOCAL_PATHS_ROOT", str(Path.cwd()))),
            log_level=os.environ.get("TMD_LOG_LEVEL", DEFAULT_LOG_LEVEL),
        )
