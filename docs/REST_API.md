# REST API reference

References for the backend's API for local development.

Base URL: `http://127.0.0.1:8642`  
All routes are prefixed with `/api`.  
All request bodies use `Content-Type: application/json` unless noted otherwise (file uploads use `multipart/form-data`).  
All responses are JSON.

---

## Conventions

### Errors

Every error response has the same shape:

```json
{"code": "string", "message": "string"}
```

| Code | HTTP status |
|---|---|
| `not_found` | 404 |
| `too_large` | 413 |
| `local_paths_disabled` / `local_paths_disallowed` | 403 |
| `unsupported_format` | 422 |
| `missing_dependency` | 503 |
| `internal_error` | 500 |
| `bad_request` | 400 |

### Sessions

Sessions are server-side temporary directories identified by a UUID `session_id`. They are created implicitly on the first upload. Sessions expire after `session_ttl_hours` (default 24 hours).

---

## Endpoints

### GET /api/health

Returns server status.

```json
{
  "version": "string",
  "encoding": "string",
  "extensions": ["string"]
}
```

---

### GET /api/config

Returns server configuration.

```json
{
  "extensions": ["string"],
  "limits": {
    "max_upload_mb": 100,
    "max_session_mb": 1000,
    "session_ttl_hours": 24
  },
  "feature_flags": {
    "allow_local_paths": false
  }
}
```

---

### POST /api/uploads

Upload one or more files into a session. Returns `201 Created`.

**Content-Type:** `multipart/form-data`

| Field | Type | Required | Notes |
|---|---|---|---|
| `files` | `File[]` | Yes | One or more files |
| `paths` | JSON string (list of strings) | No | Relative paths matching the `files` array. Defaults to `[]`. |
| `session_id` | string | No | Omit to create a new session. |

**Response:**

```json
{
  "session_id": "string",
  "files": [
    {
      "file_id": "string",
      "name": "string",
      "relpath": "string",
      "size": 0,
      "source_tokens": 0
    }
  ]
}
```

`size` is in bytes. `source_tokens` is estimated from the raw file size.

**Errors:** `413 too_large` if a single file exceeds `max_upload_mb` or the session total exceeds `max_session_mb`.

---

### POST /api/convert

Convert uploaded files to Markdown.

**Request body:**

```json
{
  "session_id": "string",
  "file_ids": ["string"],
  "options": {
    "strip_headers_footers": false,
    "write_images": false,
    "image_path": null,
    "pages": null,
    "extensions": null
  },
  "path": null
}
```

| Field | Type | Notes |
|---|---|---|
| `file_ids` | `string[]` | IDs from a prior upload |
| `options.strip_headers_footers` | bool | Default `false` |
| `options.write_images` | bool | Default `false` |
| `options.image_path` | string or null | Output path for extracted images |
| `options.pages` | `int[]` or null | Zero-based page indices to include |
| `options.extensions` | `string[]` or null | Filter input files by extension |
| `path` | string or null | Server-side path. Requires `allow_local_paths`. |

**Response:**

```json
{
  "results": [
    {
      "file_id": "string",
      "name": "string",
      "status": "done",
      "output_file_id": "string",
      "output_name": "string",
      "output_size": 0,
      "source_tokens": 0,
      "target_tokens": 0,
      "percent": 0.0,
      "error": null
    }
  ],
  "converted_count": 0,
  "failed_count": 0,
  "total_source_tokens": 0,
  "total_target_tokens": 0,
  "total_percent": 0.0
}
```

`status` is `"done"` or `"error"`. `percent` is negative when conversion reduces the token count. `output_size` is in bytes.

---

### POST /api/merge

Merge multiple files into a single Markdown output.

**Request body:**

```json
{
  "session_id": "string",
  "file_ids": ["string"],
  "output_name": "merged.md",
  "options": {
    "recursive": false,
    "budget": null,
    "encoding": null,
    "no_convert": false,
    "dedup": false,
    "no_toc": false,
    "delta": false,
    "strip_headers_footers": false,
    "write_images": false,
    "image_path": null,
    "pages": null
  },
  "path": null
}
```

| Field | Type | Notes |
|---|---|---|
| `output_name` | string | Default `"merged.md"` |
| `options.recursive` | bool | Default `false` |
| `options.budget` | int or null | Token ceiling for pruning |
| `options.encoding` | string or null | Tokenizer encoding |
| `options.no_convert` | bool | Default `false` |
| `options.dedup` | bool | Default `false` |
| `options.no_toc` | bool | Default `false` |
| `options.delta` | bool | Default `false` |
| `path` | string or null | Server-side path. Requires `allow_local_paths`. |

**Response:**

```json
{
  "output_file_id": "string",
  "output_name": "string",
  "source_tokens": 0,
  "target_tokens": 0,
  "percent": 0.0,
  "prune": {
    "fits": true,
    "removed_tokens": 0,
    "removed_blocks": [],
    "budget": 0,
    "final_tokens": 0
  },
  "delta_entries": [
    {
      "name": "string",
      "source_tokens": 0,
      "target_tokens": 0,
      "percent": 0.0
    }
  ]
}
```

`prune` is `null` when no budget was set. `delta_entries` is `null` when `delta` was not requested.

---

### POST /api/budget

Apply a token budget to a file or raw text, pruning blocks until the output fits.

**Request body:**

```json
{
  "session_id": "string",
  "file_id": null,
  "text": null,
  "budget": 4000,
  "encoding": null
}
```

One of `file_id` or `text` is required.

**Response:**

```json
{
  "fits": true,
  "original_tokens": 0,
  "final_tokens": 0,
  "removed_tokens": 0,
  "removed_blocks": []
}
```

---

### POST /api/delta

Compare source files to their converted outputs and report token counts per file.

The server looks up converted output files by stem (e.g. `report.pdf` maps to `report.md` in the output directory).

**Request body:**

```json
{
  "session_id": "string",
  "file_ids": ["string"],
  "encoding": null
}
```

**Response:**

```json
{
  "entries": [
    {
      "name": "string",
      "source_tokens": 0,
      "target_tokens": 0,
      "percent": 0.0
    }
  ],
  "total_source_tokens": 0,
  "total_target_tokens": 0,
  "total_percent": 0.0
}
```

---

### POST /api/fetch

Fetch a URL and convert it to Markdown.

**Request body:**

```json
{
  "url": "string",
  "session_id": null,
  "user_agent": null
}
```

`session_id` is optional. A new session is created if omitted.

**Response:**

```json
{
  "session_id": "string",
  "output_file_id": "string",
  "output_name": "string",
  "target_tokens": 0,
  "source_tokens": 0,
  "percent": 0.0,
  "url": "string"
}
```

**Errors:** `422 unsupported_format` if the URL is unreachable or cannot be converted.

---

### POST /api/repo

Reconstruct an uploaded file tree as a repository digest and convert it to Markdown.

**Request body:**

```json
{
  "session_id": "string",
  "file_ids": ["string"],
  "exclude": [],
  "path": null
}
```

| Field | Type | Notes |
|---|---|---|
| `file_ids` | `string[]` | Uploaded files, reconstructed as a repo tree |
| `exclude` | `string[]` | Extra gitignore-style patterns |
| `path` | string or null | Server-side path. Requires `allow_local_paths`. |

**Response:**

```json
{
  "output_file_id": "string",
  "output_name": "string",
  "target_tokens": 0,
  "source_tokens": 0,
  "percent": 0.0,
  "file_count": 0
}
```

---

### POST /api/clip

Convert files and return the Markdown text inline. Nothing is written to disk. Useful for clipboard-style access.

**Request body:**

```json
{
  "session_id": "string",
  "file_ids": ["string"],
  "options": {}
}
```

`options` follows the same shape as `ConvertOptions` in `/api/convert`.

**Response:**

```json
{
  "text": "string",
  "chars": 0,
  "lines": 0,
  "tokens": 0,
  "file_count": 0
}
```

---

### GET /api/files/{session_id}

List all output files in a session.

**Response:**

```json
{
  "files": [
    {
      "file_id": "string",
      "name": "string",
      "size": 0,
      "target_tokens": 0,
      "created": 0.0
    }
  ]
}
```

`created` is a Unix timestamp. `size` is in bytes.

---

### GET /api/files/{session_id}/{file_id}/download

Download a single output file.

**Response:** `text/markdown`

---

### GET /api/files/{session_id}/download-all

Download all output files in the session as a ZIP archive.

**Response:** `application/zip`, filename `tmd-outputs.zip`

---

### POST /api/watch/start

Start a background file watcher. Events are pushed over the WebSocket connection for the session.

**Request body:**

```json
{
  "session_id": "string",
  "options": {
    "poll_interval": 2.0,
    "extensions": null,
    "once": false,
    "convert_opts": {}
  }
}
```

`convert_opts` follows the same shape as `ConvertOptions` in `/api/convert`.

**Response:**

```json
{
  "watch_id": "string",
  "source": "string",
  "output": "string"
}
```

---

### POST /api/watch/stop

Stop the watcher for a session.

**Request body:** `{"session_id": "string"}`

**Response:** `{"stopped": true}`

---

### GET /api/watch/{session_id}

Get the current watcher status.

**Response:**

```json
{
  "running": true,
  "files_processed": 0,
  "source_tokens": 0,
  "target_tokens": 0
}
```

---

### POST /api/session/close

Stop any running watcher and delete all data for a session.

**Request body:** `{"session_id": "string"}`

**Response:** `{"closed": true}`

---

### POST /api/session/{session_id}/cancel

Signal the watcher to stop (non-blocking). Equivalent to `/api/watch/stop` but as a path-parameter route.

**Response:** `{"cancelled": true}`

---

### GET /api/samples

List available sample files.

**Response:**

```json
{
  "samples": [
    {"name": "string", "kind": "string"}
  ]
}
```

---

### GET /api/samples/{name}

Download a sample file by name.

---

## WebSocket

### WS /api/ws?session_id={id}

Connect with a `session_id` query parameter. The server pushes events as JSON objects. Registration happens on connect; the client can optionally send `{"type": "subscribe"}` to confirm (it has no effect server-side).

**Events pushed by the server:**

#### watch.started

```json
{
  "type": "watch.started",
  "data": {
    "watch_id": "string",
    "source": "string",
    "output": "string",
    "poll_interval": 2.0
  }
}
```

#### watch.file

```json
{
  "type": "watch.file",
  "data": {
    "file": "string",
    "status": "done",
    "output": "string",
    "error": null,
    "source_tokens": 0,
    "target_tokens": 0,
    "percent": 0.0
  }
}
```

`status` is `"done"` or `"error"`.

#### watch.total

```json
{
  "type": "watch.total",
  "data": {
    "files": 0,
    "source_tokens": 0,
    "target_tokens": 0
  }
}
```

#### watch.stopped

```json
{
  "type": "watch.stopped",
  "data": {
    "reason": "requested"
  }
}
```

---

## Environment variables

| Variable | Default | Notes |
|---|---|---|
| `TMD_HOST` | `127.0.0.1` | Bind address |
| `TMD_PORT` | `8642` | Bind port |
| `TMD_MAX_UPLOAD_MB` | `100` | Per-file upload limit |
| `TMD_MAX_SESSION_MB` | `1000` | Total session storage limit |
| `TMD_SESSION_TTL_HOURS` | `24` | Session expiry |
| `TMD_CORS_ORIGINS` | `http://localhost:3000,http://127.0.0.1:3000` | Allowed CORS origins |
| `TMD_UI_DIR` | — | Path to built frontend static files |
| `TMD_ALLOW_LOCAL_PATHS` | `false` | Enable server-side path access |
| `TMD_LOCAL_PATHS_ROOT` | cwd | Root for server-side path access |
| `TMD_LOG_LEVEL` | `info` | Log verbosity |
