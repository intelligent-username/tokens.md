# tokens.md

![Moses on Mounta Sinai by Jean-Léon, 1895](.github/Cover.jpg)

Tokens.md is my tool for saving tokens when speaking to chatbots by converting files en-masse to Markdown. It turns PDFs, Office documents, e-books, structured data, HTML, web pages, and whole code repositories into clean, token-efficient Markdown you can paste straight into an LLM.

## Outline

- [Features](#features)
- [Install](#install)
- [Running](#running)
  - [1. CLI Usage (`tmd`)](#1-cli-usage-tmd)
  - [2. Simple Script Execution (`python src/main.py`)](#2-simple-script-execution-python-srcmainpy)
  - [3. Web Front End (`tmd ui` & Next.js)](#3-web-front-end-tmd-ui--nextjs)
- [Supported Formats](#supported-formats)
- [Development](#development)
- [Documentation](#documentation)

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

# On Linux or Mac
source .venv/bin/activate

# On Windows
.venv\Scripts\activate

uv pip install -e .               # editable install (provides `tmd`)
```

Or install the runtime dependencies directly:

```bash
uv pip install -r requirements.txt
```

> `pyproject.toml` is the source of truth for dependencies; `requirements.txt` mirrors the runtime set.

## Running

You can run `tokens.md` in three distinct ways depending on your workflow preference:

### 1. CLI Usage (`tmd`)

After installing via `pip install -e .`, the `tmd` command is registered in your environment.

```bash
# Convert a folder or file to Markdown
tmd convert input/ -o output/

# Bare `tmd` command uses default input/ and output/ directories
tmd

# Other CLI subcommands
tmd merge input/ -o output/merged.md
tmd fetch https://example.com/article -o output/article.md
tmd repo . -o output/repo.md
```

### 2. Simple Script Execution (`python src/main.py`)

If you want to run the program directly without installing it as a package, run `src/main.py` using your Python interpreter:

```bash
python src/main.py
```

You can pass standard CLI arguments directly to the script:

```bash
python src/main.py convert input/ -o output/
```

Both bare `tmd` and `python src/main.py` automatically resolve default `input/` and `output/` folders relative to the project root.

### 3. Web Front End (`tmd ui` & Next.js)

The single-page web interface wraps all `tmd` capabilities into an intuitive side-by-side visual workbench featuring drag-and-drop file upload, URL fetching, clipboard copying, and live token compression flow meters.

**Method A: Single CLI Command**
```bash
uv pip install -e ".[web]"
tmd ui
```
This launches the backend API on `http://127.0.0.1:8642` and opens the browser interface.

**Method B: Development Server (Frontend + Backend)**
1. Start the FastAPI backend server:
   ```bash
   python -m backend
   ```
2. In a separate terminal, start the Next.js frontend dev server:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
3. Open `http://localhost:3000` in your web browser.

## Supported Formats

PDF, EPUB, MOBI, XPS, FB2, CBZ, SVG, images (PNG/JPG/TIF/GIF/BMP), TXT, DOCX, PPTX, XLSX, HTML/HTM, JSON, XML, CSV, YAML, TOML, INI, LOG, and whole repositories via `tmd repo`.

## Development

Install dev dependencies and run the checks:

```bash
uv pip install -e ".[dev]"
pytest
ruff check .
mypy src
```

## Documentation

- [`docs/USAGE.md`](docs/USAGE.md) — full usage guide for every `tmd` subcommand.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — how the converter registry works and how to add new formats.
