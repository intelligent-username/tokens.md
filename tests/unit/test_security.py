"""Security regression tests for code-scanning fixes.

Covers: Workspace session-id validation (path injection), SSRF guard in
spoof fetchers, github.com host matching in fetch_url, and ReDoS-safe
meta extraction.
"""

from __future__ import annotations

import socket
import time
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from backend.workspace import Workspace, WorkspaceError
from src.fetch import _extract_meta_markdown, fetch_url
from src.spoof_support.fetchers import assert_public_http_url, fetch_via_requests, fetch_via_urllib


# ---------------------------------------------------------------------------
# Workspace session-id validation
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("sid", ["../..", "a/b", "a\\b", "..", ".", "x y", "id;rm", "a" * 65])
def test_workspace_rejects_malicious_session_ids(tmp_path: Path, monkeypatch: pytest.MonkeyPatch, sid: str) -> None:
    monkeypatch.setattr("tempfile.gettempdir", lambda: str(tmp_path))
    with pytest.raises(WorkspaceError):
        Workspace(sid)


@pytest.mark.parametrize("sid", ["abc123", "sess-1", "x", "s", "a" * 64])
def test_workspace_accepts_safe_session_ids(tmp_path: Path, monkeypatch: pytest.MonkeyPatch, sid: str) -> None:
    monkeypatch.setattr("tempfile.gettempdir", lambda: str(tmp_path))
    ws = Workspace(sid)
    assert ws.root == tmp_path / f"tmd-ui-{sid}"


def test_workspace_empty_and_none_sid_generate_ids(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Empty string keeps its historical behavior of generating a fresh id."""
    monkeypatch.setattr("tempfile.gettempdir", lambda: str(tmp_path))
    assert Workspace("").sid != ""
    generated = Workspace()
    assert len(generated.sid) == 12
    assert generated.root.is_relative_to(tmp_path)


# ---------------------------------------------------------------------------
# API surface: malicious session id is rejected, not turned into a path
# ---------------------------------------------------------------------------


def test_api_rejects_malicious_session_id(tmd_workspace: Path) -> None:
    from fastapi.testclient import TestClient

    from backend.app import create_app

    app = create_app()
    with TestClient(app, raise_server_exceptions=False) as test_client:
        response = test_client.post("/api/convert", json={"session_id": "../../evil", "file_ids": []})
    assert response.status_code == 500


# ---------------------------------------------------------------------------
# SSRF guard
# ---------------------------------------------------------------------------


def test_assert_public_http_url_rejects_non_http_schemes() -> None:
    with pytest.raises(ValueError):
        assert_public_http_url("file:///etc/passwd")
    with pytest.raises(ValueError):
        assert_public_http_url("ftp://example.com/file")


def test_assert_public_http_url_rejects_private_and_loopback(monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_getaddrinfo(host: str, port: object):
        ip = "127.0.0.1" if "loopback" in host else "169.254.169.254"
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (ip, 0))]

    monkeypatch.setattr(socket, "getaddrinfo", fake_getaddrinfo)
    with pytest.raises(ValueError):
        assert_public_http_url("http://loopback.local/admin")
    with pytest.raises(ValueError):
        assert_public_http_url("http://metadata.local/latest")


def test_assert_public_http_url_accepts_public_host(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(socket, "getaddrinfo", lambda host, port: [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 0))])
    assert_public_http_url("https://example.com/article")


class _RedirectResponse:
    """Minimal mock of a requests Response returning a redirect."""

    status_code = 301
    headers = {"Location": "http://127.0.0.1/steal"}
    content = b""


def test_fetch_via_requests_blocks_redirect_to_private_host(monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_getaddrinfo(host: str, port: object):
        ip = "93.184.216.34" if host == "example.com" else "127.0.0.1"
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (ip, 0))]

    monkeypatch.setattr(socket, "getaddrinfo", fake_getaddrinfo)
    calls: list[str] = []

    def fake_get(self: object, url: str, **kwargs: object) -> _RedirectResponse:
        calls.append(url)
        return _RedirectResponse()

    monkeypatch.setattr("requests.Session.get", fake_get)
    result = fetch_via_requests("https://example.com/start", {}, timeout_sec=2.0)
    assert result is None
    # Only the first (public) hop may be requested; the private redirect is blocked.
    assert len(calls) == 1


def test_fetch_via_urllib_blocks_non_http_target() -> None:
    assert fetch_via_urllib("file:///etc/passwd", {}, timeout_sec=2.0) is None


# ---------------------------------------------------------------------------
# github.com host matching (incomplete URL substring sanitization)
# ---------------------------------------------------------------------------


def test_fetch_url_lookalike_domain_skips_repo_clone(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    repo_mock = MagicMock()
    monkeypatch.setattr("src.fetch._fetch_github_repo", repo_mock)
    with patch("src.fetch.trafilatura.fetch_url", return_value="<html><body>page</body></html>"), patch("src.fetch.trafilatura.extract", return_value="Body text."):
        out = fetch_url("https://evil-github.com.evil.net/user/repo", tmp_path / "out")

    repo_mock.assert_not_called()
    assert out.name == "evil-github-com-evil-net.md"


@pytest.mark.parametrize("url", ["https://github.com/user/repo", "https://www.github.com/user/repo"])
def test_fetch_url_genuine_github_domains_use_repo_clone(tmp_path: Path, url: str, monkeypatch: pytest.MonkeyPatch) -> None:
    sentinel = tmp_path / "repo.md"
    sentinel.write_text("# repo", encoding="utf-8")
    mock = MagicMock(return_value=sentinel)
    monkeypatch.setattr("src.fetch._fetch_github_repo", mock)
    out = fetch_url(url, tmp_path / "out")
    assert out == sentinel
    mock.assert_called_once()


# ---------------------------------------------------------------------------
# ReDoS-safe meta extraction
# ---------------------------------------------------------------------------


def test_extract_meta_markdown_title_and_description() -> None:
    html = '<html><head><title>My Title</title><meta name="description" content="Desc here"></head></html>'
    assert _extract_meta_markdown(html) == "## My Title\n\nDesc here"


def test_extract_meta_markdown_og_description_variant() -> None:
    html = '<meta property="og:description" content="OG text">'
    assert _extract_meta_markdown(html) == "OG text"


def test_extract_meta_markdown_requires_name_before_content() -> None:
    html = '<meta content="X" name="description">'
    assert _extract_meta_markdown(html) == ""


def test_extract_meta_markdown_title_spans_newlines() -> None:
    html = "<title>Line1\nLine2</title>"
    assert _extract_meta_markdown(html) == "## Line1 Line2"


def test_extract_meta_markdown_hostile_input_is_fast() -> None:
    """Inputs that backtracked catastrophically under the old regex must stay fast."""
    start = time.perf_counter()
    assert _extract_meta_markdown("<meta" * 10000) == ""
    assert _extract_meta_markdown("<title>" + "a" * 100000) == ""
    assert time.perf_counter() - start < 5.0
