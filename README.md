# tokens.md

![Moses on Mounta Sinai by Jean-Léon, 1895](.github/Cover.jpg)

Tokens.md is my tool for saving tokens when speaking to chatbots by converting files en-masse to Markdown. It turns PDFs, Office documents, e-books, structured data, HTML, web pages, and whole code repositories into clean, token-efficient Markdown you can paste straight into an LLM.

## Features

- **`tmd convert`** — batch-convert files to Markdown (PDF, DOCX, PPTX, XLSX, EPUB, images, HTML, JSON, XML, CSV, TXT, and more).
- **`tmd clip`** — convert on the fly and copy the Markdown to your clipboard, skipping the disk.
- **`tmd watch`** — watch a hot folder and auto-convert new files as they appear.
- **`tmd fetch`** — pull a web page and save clean article Markdown.
- **`tmd repo`** — collapse an entire code repository into a single Markdown manifest.
- **`tmd merge`** — combine many files into one master document with a Table of Contents.
- **`tmd delta`** — see how many tokens you saved by converting.
- **`--budget`** — force output to fit a hard token budget.

## Install

The project uses `uv` (or `pip`) and installs a `tmd` console command.

```bash
uv venv --python=3.13 .venv

# on Linux or Mac
# source .venv/bin/activate

# On Windows
.venv\Scripts\activate

uv pip install -e .               # editable install (provides `tmd`)
```

Or install the runtime dependencies directly:

```bash
uv pip install -r requirements.txt
```

> `pyproject.toml` is the source of truth for dependencies; `requirements.txt` mirrors the runtime set.

## Basic usage

```bash
tmd convert input/ -o output/
```

Bare `tmd` runs `convert` with defaults for backward compatibility.

### Web UI (`tmd ui`)

The optional web interface wraps all seven commands (convert, merge, clip, fetch, repo, watch, delta) plus budget in a browser app — a Next.js frontend backed by a FastAPI server that imports `src/` in-process.

```bash
uv pip install -e ".[web]"     # or: uv pip install -r requirements-web.txt
tmd ui                         # serves the API on http://127.0.0.1:8642
```

- REST API base: `http://127.0.0.1:8642` (configurable via `TMD_HOST`/`TMD_PORT` env vars; auto-increments the port if busy).
- WebSocket: `/api/ws?session_id=...` for watch events and job progress.
- Endpoints: health, config, samples, upload, list/download/download-all, convert, merge, clip, fetch, repo, delta, budget, watch start/stop/status, session close/cancel — see [`docs/WEBUI.md`](docs/WEBUI.md) (if present) or `backend/routes.py`.
- Frontend lives in `frontend/` (Next.js App Router). To build it: `cd frontend && npm install && npm run build`, then point it at the API base above.

The same CLI can also be run directly without installing:

```bash
python src/main.py
```

Both are entry points to the same command-line interface. Bare `tmd` and
`python src/main.py` resolve the default `input/`/`output/` folders relative to
the project root, so they work from any directory. To learn how to use the CLI,
check the [docs](docs/USAGE.md) folder.

## Development

Install dev dependencies and run the checks:

```bash
uv pip install -e ".[dev]"
pytest
ruff check .
mypy src
```

## Supported formats

PDF, EPUB, MOBI, XPS, FB2, CBZ, SVG, images (PNG/JPG/TIF/GIF/BMP), TXT, DOCX, PPTX, XLSX, HTML/HTM, JSON, XML, CSV, YAML, TOML, INI, LOG, and whole repositories via `tmd repo`.

## Documentation

- [`docs/USAGE.md`](docs/USAGE.md) — full usage guide for every `tmd` subcommand.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — how the converter registry works and how to add new formats.
