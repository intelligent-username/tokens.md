"""Shared fixtures for the tokens.md test suite."""

from __future__ import annotations

import shutil
import tempfile
import zipfile
from pathlib import Path

import pytest

# --- pytest plugins and output configuration --------------------------------
# Install for better output:
#   pip install pytest-sugar pytest-instafail
# Run with:
#   pytest -v --tb=short -ra        # verbose, short tracebacks, summary table
#   pytest -x -v                    # stop at first failure
#   pytest --instafail -v           # show failures as they happen


DUMMIES_DIR = Path(__file__).resolve().parent / "dummies"
CANONICAL_DIR = DUMMIES_DIR / "canonical"


def pytest_configure(config: pytest.Config) -> None:
    """Enable detailed coverage table when -v is passed; otherwise let --cov-report= suppress the table."""
    if config.option.verbose > 0:
        config.option.cov_report = {"term-missing:skip-covered": None}


def pytest_terminal_summary(terminalreporter: pytest.TerminalReporter, exitstatus: int, config: pytest.Config) -> None:
    """Print a clean single-line coverage percentage whenever coverage is enabled."""
    if getattr(config.option, "cov_source", None):
        try:
            cov_plugin = config.pluginmanager.get_plugin("_cov")
            if cov_plugin and hasattr(cov_plugin, "cov_controller") and cov_plugin.cov_controller:
                import io

                cov = cov_plugin.cov_controller.cov
                stream = io.StringIO()
                total = cov.report(file=stream)
                terminalreporter.write_sep("=", f"Total Coverage: {total:.0f}%", bold=True, green=(total >= 70), yellow=(50 <= total < 70), red=(total < 50))
        except Exception:
            pass


@pytest.fixture
def tmd_workspace(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Point the workspace temp dir at a per-test tmp_path."""
    monkeypatch.setattr(tempfile, "gettempdir", lambda: str(tmp_path))
    return tmp_path


@pytest.fixture(scope="session")
def _shared_fastapi_app():
    """Session-scoped FastAPI application instance to avoid rebuilding routes on every test."""
    from backend.app import create_app

    return create_app()


@pytest.fixture
def client(tmd_workspace: Path, _shared_fastapi_app):
    """FastAPI TestClient with an isolated temp workspace and cached app instance."""
    from fastapi.testclient import TestClient

    with TestClient(_shared_fastapi_app) as test_client:
        yield test_client


@pytest.fixture
def tmp_output(tmp_path: Path) -> Path:
    out = tmp_path / "output"
    out.mkdir()
    return out


@pytest.fixture
def sample_pdf(tmp_path: Path) -> Path:
    target = tmp_path / "sample.pdf"
    shutil.copyfile(CANONICAL_DIR / "sample.pdf", target)
    return target


@pytest.fixture
def sample_md(tmp_path: Path) -> Path:
    target = tmp_path / "notes.md"
    shutil.copyfile(CANONICAL_DIR / "notes.md", target)
    return target


@pytest.fixture
def sample_docx(tmp_path: Path) -> Path:
    target = tmp_path / "letter.docx"
    shutil.copyfile(CANONICAL_DIR / "letter.docx", target)
    return target


@pytest.fixture
def sample_docx_headed(tmp_path: Path) -> Path:
    target = tmp_path / "headed.docx"
    shutil.copyfile(CANONICAL_DIR / "headed.docx", target)
    return target


@pytest.fixture
def sample_pptx(tmp_path: Path) -> Path:
    target = tmp_path / "deck.pptx"
    shutil.copyfile(CANONICAL_DIR / "deck.pptx", target)
    return target


@pytest.fixture
def sample_xlsx(tmp_path: Path) -> Path:
    target = tmp_path / "data.xlsx"
    shutil.copyfile(CANONICAL_DIR / "data.xlsx", target)
    return target


@pytest.fixture
def sample_odt(tmp_path: Path) -> Path:
    target = tmp_path / "sample.odt"
    shutil.copyfile(CANONICAL_DIR / "sample.odt", target)
    return target


@pytest.fixture
def sample_rtf(tmp_path: Path) -> Path:
    target = tmp_path / "sample.rtf"
    shutil.copyfile(CANONICAL_DIR / "sample.rtf", target)
    return target


@pytest.fixture
def sample_eml(tmp_path: Path) -> Path:
    target = tmp_path / "sample.eml"
    shutil.copyfile(CANONICAL_DIR / "sample.eml", target)
    return target


@pytest.fixture
def sample_srt(tmp_path: Path) -> Path:
    target = tmp_path / "sample.srt"
    shutil.copyfile(CANONICAL_DIR / "sample.srt", target)
    return target


@pytest.fixture
def sample_tex(tmp_path: Path) -> Path:
    target = tmp_path / "sample.tex"
    shutil.copyfile(CANONICAL_DIR / "sample.tex", target)
    return target


@pytest.fixture
def sample_azw4(tmp_path: Path) -> Path:
    target = tmp_path / "sample.azw4"
    shutil.copyfile(CANONICAL_DIR / "sample.azw4", target)
    return target


@pytest.fixture
def sample_csv(tmp_path: Path) -> Path:
    target = tmp_path / "data.csv"
    shutil.copyfile(CANONICAL_DIR / "data.csv", target)
    return target


@pytest.fixture
def sample_json(tmp_path: Path) -> Path:
    target = tmp_path / "config.json"
    shutil.copyfile(CANONICAL_DIR / "config.json", target)
    return target


@pytest.fixture
def sample_txt(tmp_path: Path) -> Path:
    target = tmp_path / "readme.txt"
    shutil.copyfile(CANONICAL_DIR / "readme.txt", target)
    return target


@pytest.fixture
def sample_html(tmp_path: Path) -> Path:
    target = tmp_path / "page.html"
    shutil.copyfile(CANONICAL_DIR / "page.html", target)
    return target


@pytest.fixture
def sample_docx_math(tmp_path: Path) -> Path:
    target = tmp_path / "math.docx"
    shutil.copyfile(CANONICAL_DIR / "math.docx", target)
    return target


@pytest.fixture
def sample_tex_math(tmp_path: Path) -> Path:
    target = tmp_path / "math.tex"
    shutil.copyfile(CANONICAL_DIR / "math.tex", target)
    return target


