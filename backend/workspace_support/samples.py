"""Bundled demo sample file provider functions."""

from __future__ import annotations

from pathlib import Path
from .sanitizer import sanitize_name

SAMPLES_DIR = Path(__file__).resolve().parent.parent / "samples"


def list_samples() -> list[dict[str, str]]:
    """List bundled demo files as ``{name, kind}`` dicts."""
    samples: list[dict[str, str]] = []
    if SAMPLES_DIR.exists():
        for path in sorted(SAMPLES_DIR.iterdir()):
            if path.is_file():
                samples.append(
                    {
                        "name": path.name,
                        "kind": path.suffix.lstrip(".") or "text",
                    }
                )
    return samples


def read_sample_path(name: str, not_found_exc_cls: type[Exception]) -> Path:
    """Resolve a bundled sample file name to its path (path-safe)."""
    candidate = SAMPLES_DIR / sanitize_name(name)
    if (
        not candidate.is_file()
        or not candidate.resolve().is_relative_to(SAMPLES_DIR.resolve())
    ):
        raise not_found_exc_cls(f"Unknown sample: {name}")
    return candidate
