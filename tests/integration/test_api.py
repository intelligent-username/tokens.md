"""REST API tests for the tokens.md web backend."""

from __future__ import annotations

import io
import zipfile
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from backend.app import create_app
from backend.config import Settings

JSON_BYTES = b'{"host": "localhost", "port": 8080}'


def _upload(client: TestClient, name: str, content: bytes, paths: str = "[]", session_id: str | None = None) -> dict:
    data: dict[str, str] = {"paths": paths}
    if session_id:
        data["session_id"] = session_id
    resp = client.post("/api/uploads", files=[("files", (name, content, "application/octet-stream"))], data=data)
    assert resp.status_code == 201, resp.text
    return resp.json()


def _client_with(**overrides: object) -> TestClient:
    settings = Settings.from_env()
    for key, value in overrides.items():
        setattr(settings, key, value)
    return TestClient(create_app(settings))


def test_health(client: TestClient) -> None:
    resp = client.get("/api/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["version"]
    assert body["encoding"]
    assert body["extensions"]


def test_config(client: TestClient) -> None:
    resp = client.get("/api/config")
    assert resp.status_code == 200
    body = resp.json()
    assert body["extensions"]
    assert body["limits"]["max_upload_mb"] == 100
    assert "allow_local_paths" in body["feature_flags"]


def test_upload_roundtrip(client: TestClient) -> None:
    body = _upload(client, "notes.json", JSON_BYTES)
    assert body["session_id"]
    assert len(body["files"]) == 1
    meta = body["files"][0]
    assert meta["name"] == "notes.json"
    assert meta["source_tokens"] > 0


def test_convert(client: TestClient) -> None:
    body = _upload(client, "notes.json", JSON_BYTES)
    sid = body["session_id"]
    fid = body["files"][0]["file_id"]
    resp = client.post("/api/convert", json={"session_id": sid, "file_ids": [fid]})
    assert resp.status_code == 200
    result = resp.json()
    assert result["converted_count"] == 1
    assert result["failed_count"] == 0
    item = result["results"][0]
    assert item["status"] == "done"
    assert item["output_file_id"]
    assert item["target_tokens"] > 0
    assert result["total_source_tokens"] > 0


def test_merge_with_budget_and_delta(client: TestClient) -> None:
    body = _upload(client, "a.json", b'{"a": 1}')
    sid = body["session_id"]
    fid_a = body["files"][0]["file_id"]
    body = _upload(client, "b.json", b'{"b": 2}', session_id=sid)
    fid_b = body["files"][0]["file_id"]
    resp = client.post("/api/merge", json={"session_id": sid, "file_ids": [fid_a, fid_b], "options": {"budget": 100000, "delta": True}})
    assert resp.status_code == 200, resp.text
    result = resp.json()
    assert result["output_file_id"]
    assert result["prune"]["fits"] is True
    assert result["delta_entries"]
    assert result["target_tokens"] > 0


def test_merge_prune_failure_returns_warning(client: TestClient) -> None:
    body = _upload(client, "a.json", b'{"a": 1}')
    sid = body["session_id"]
    fid_a = body["files"][0]["file_id"]
    with patch("backend.api_routes.convert_routes.prune_to_budget", side_effect=ValueError("synthetic budget error")):
        resp = client.post("/api/merge", json={"session_id": sid, "file_ids": [fid_a], "options": {"budget": 50}})
    assert resp.status_code == 200, resp.text
    result = resp.json()
    assert result["output_file_id"]
    assert result["prune"] is None
    assert "Pruning failed: synthetic budget error" in (result.get("warning") or "")


def test_budget_standalone(client: TestClient) -> None:
    resp = client.post("/api/budget", json={"session_id": "x", "text": "hello world " * 100, "budget": 10})
    assert resp.status_code == 200
    result = resp.json()
    assert "fits" in result
    assert result["original_tokens"] > result["final_tokens"]


def test_delta(client: TestClient) -> None:
    body = _upload(client, "notes.json", JSON_BYTES)
    sid = body["session_id"]
    fid = body["files"][0]["file_id"]
    client.post("/api/convert", json={"session_id": sid, "file_ids": [fid]})
    resp = client.post("/api/delta", json={"session_id": sid, "file_ids": [fid]})
    assert resp.status_code == 200
    result = resp.json()
    assert len(result["entries"]) == 1
    assert result["entries"][0]["name"] == "notes.json"
    assert result["total_source_tokens"] > 0


def test_fetch(client: TestClient) -> None:
    class FakeTrafilatura:
        def fetch_url(self, url: str) -> bytes:
            return b"<html><body><article><h1>Title</h1><p>Body</p></article></body></html>"

        def extract(self, downloaded: bytes, **kwargs: object) -> str:
            return "# Title\n\nBody text."

    with patch("src.fetch.require", return_value=FakeTrafilatura()):
        resp = client.post("/api/fetch", json={"url": "https://example.com/article"})
    assert resp.status_code == 200, resp.text
    result = resp.json()
    assert result["output_file_id"]
    assert result["url"] == "https://example.com/article"


def test_repo(client: TestClient) -> None:
    body = _upload(client, "main.py", b"print('hi')\n", paths='["src/main.py"]')
    sid = body["session_id"]
    fid = body["files"][0]["file_id"]
    resp = client.post("/api/repo", json={"session_id": sid, "file_ids": [fid]})
    assert resp.status_code == 200, resp.text
    result = resp.json()
    assert result["output_file_id"]
    assert result["file_count"] >= 1


def test_clip(client: TestClient) -> None:
    body = _upload(client, "notes.json", JSON_BYTES)
    sid = body["session_id"]
    fid = body["files"][0]["file_id"]
    resp = client.post("/api/clip", json={"session_id": sid, "file_ids": [fid]})
    assert resp.status_code == 200
    result = resp.json()
    assert result["text"]
    assert result["tokens"] > 0
    assert result["file_count"] == 1


def test_downloads_and_zip(client: TestClient) -> None:
    body = _upload(client, "notes.json", JSON_BYTES)
    sid = body["session_id"]
    fid = body["files"][0]["file_id"]
    convert = client.post("/api/convert", json={"session_id": sid, "file_ids": [fid]})
    out_id = convert.json()["results"][0]["output_file_id"]

    single = client.get(f"/api/files/{sid}/{out_id}/download")
    assert single.status_code == 200
    assert "attachment" in single.headers["content-disposition"]

    zipped = client.get(f"/api/files/{sid}/download-all")
    assert zipped.status_code == 200
    with zipfile.ZipFile(io.BytesIO(zipped.content)) as zf:
        assert zf.namelist()


def test_files_list(client: TestClient) -> None:
    body = _upload(client, "notes.json", JSON_BYTES)
    sid = body["session_id"]
    fid = body["files"][0]["file_id"]
    client.post("/api/convert", json={"session_id": sid, "file_ids": [fid]})
    resp = client.get(f"/api/files/{sid}")
    assert resp.status_code == 200
    assert len(resp.json()["files"]) == 1


def test_session_close(client: TestClient) -> None:
    body = _upload(client, "notes.json", JSON_BYTES)
    sid = body["session_id"]
    resp = client.post("/api/session/close", json={"session_id": sid})
    assert resp.status_code == 200
    assert resp.json()["closed"] is True


def test_samples(client: TestClient) -> None:
    resp = client.get("/api/samples")
    assert resp.status_code == 200
    samples = resp.json()["samples"]
    assert samples
    name = samples[0]["name"]
    file_resp = client.get(f"/api/samples/{name}")
    assert file_resp.status_code == 200
    assert file_resp.content


def test_traversal_upload_sanitized(client: TestClient) -> None:
    body = _upload(client, "../../evil.json", JSON_BYTES)
    meta = body["files"][0]
    assert ".." not in meta["name"]
    assert meta["name"] == "evil.json"


def test_bad_file_id_404(client: TestClient) -> None:
    resp = client.get("/api/files/nope/badid/download")
    assert resp.status_code == 404
    assert resp.json()["code"] == "not_found"


def test_unknown_format_422(client: TestClient) -> None:
    body = _upload(client, "weird.xyz", b"data")
    sid = body["session_id"]
    fid = body["files"][0]["file_id"]
    resp = client.post("/api/convert", json={"session_id": sid, "file_ids": [fid]})
    assert resp.status_code == 200
    assert resp.json()["results"][0]["status"] == "error"


def test_oversize_upload_413(tmd_workspace: Path) -> None:
    client = _client_with(max_upload_mb=1)
    resp = client.post("/api/uploads", files=[("files", ("big.json", b"x" * (2 * 1024 * 1024), "application/octet-stream"))], data={"paths": "[]"})
    assert resp.status_code == 413
    assert resp.json()["code"] == "too_large"


def test_local_path_gated_off(client: TestClient, tmp_path: Path) -> None:
    target = tmp_path / "local.json"
    target.write_text('{"x": 1}', encoding="utf-8")
    resp = client.post("/api/convert", json={"session_id": "s", "path": str(target)})
    assert resp.status_code == 403
    assert resp.json()["code"] == "local_paths_disabled"


def test_local_path_allowed(tmd_workspace: Path, tmp_path: Path) -> None:
    target = tmp_path / "local.json"
    target.write_text('{"x": 1}', encoding="utf-8")
    client = _client_with(allow_local_paths=True, local_paths_root=tmp_path)
    resp = client.post("/api/convert", json={"session_id": "s", "path": str(target)})
    assert resp.status_code == 200, resp.text
    assert resp.json()["converted_count"] == 1


def test_local_directory_path_conversion(tmd_workspace: Path, tmp_path: Path) -> None:
    dir_target = tmp_path / "docs"
    dir_target.mkdir()
    (dir_target / "a.json").write_text('{"a": 1}', encoding="utf-8")
    (dir_target / "b.json").write_text('{"b": 2}', encoding="utf-8")
    client = _client_with(allow_local_paths=True, local_paths_root=tmp_path)
    resp = client.post("/api/convert", json={"session_id": "s", "path": str(dir_target)})
    assert resp.status_code == 200, resp.text
    assert resp.json()["converted_count"] == 2


def test_local_path_outside_root(tmd_workspace: Path, tmp_path: Path) -> None:
    outside = tmp_path.parent / "outside.json"
    outside.write_text('{"x": 1}', encoding="utf-8")
    client = _client_with(allow_local_paths=True, local_paths_root=tmp_path)
    resp = client.post("/api/convert", json={"session_id": "s", "path": str(outside)})
    assert resp.status_code == 403
    assert resp.json()["code"] == "local_paths_disallowed"


def test_cancel(client: TestClient) -> None:
    resp = client.post("/api/session/abc/cancel")
    assert resp.status_code == 200
    assert resp.json()["cancelled"] is True
