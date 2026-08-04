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
