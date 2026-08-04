# Architecture

`tokens.md` is a small, pluggable toolkit that turns files into token-efficient
Markdown for LLM prompts. This document explains how the pieces fit together and
how to extend the tool.

## Module map

```
src/
├── cli.py            # Typer CLI: convert, clip, watch, fetch, repo, merge, delta
├── registry.py       # Converter ABC, Registry, DEFAULT_REGISTRY, convert_file
├── handlers/         # Built-in converters (one per format family)
│   ├── pymupdf.py    #   PDF / e-books / images / text (pymupdf4llm)
│   ├── office.py     #   DOCX / PPTX / XLSX (stdlib zipfile + XML)
│   ├── structured.py #   JSON / XML / CSV / YAML / TOML / INI / LOG
│   ├── html.py       #   HTML / HTM (trafilatura)
│   ├── repo.py       #   directory -> single manifest (pathspec gitignore)
│   └── unsupported.py#   catch-all that raises a clear error
├── fetch.py          # `tmd fetch <url>` (trafilatura)
├── converter.py      # Backward-compatible wrappers over the registry
├── file_selector.py  # Strategy-based file selection (unchanged)
├── tokenizer.py      # tiktoken token counting (shared)
├── merger.py         # `tmd merge` (TOC + separators + dedup)
├── budget.py         # `--budget` pruning
├── delta.py          # `tmd delta` token savings report
├── watcher.py        # `tmd watch` hot-folder daemon
└── clipboard.py      # pyperclip wrapper
```

## The converter registry

The heart of the tool is a pluggable **registry** (`src/registry.py`). Each file
type is handled by a `Converter` subclass that declares which extensions it owns
and how to turn one input file into a Markdown file on disk.

```python
from pathlib import Path
from src.registry import Converter

class MyConverter(Converter):
    extensions = frozenset({".foo"})
    name = "myformat"

    def convert(self, input_path: Path, output_dir: Path, **kwargs) -> Path:
        output_dir.mkdir(parents=True, exist_ok=True)
        out = output_dir / f"{input_path.stem}.md"
        out.write_text(extract_text(input_path), encoding="utf-8")
        return out
```

Handlers are registered in `src/handlers/__init__.py`:

```python
DEFAULT_REGISTRY.register(MyConverter())
```

That's it — no changes to the CLI or pipeline are needed. The registry
dispatches by file extension, and `convert_file()` is the single entry point
used by the pipeline, `merge`, and the CLI.

### Adding a new format

1. Create `src/handlers/<name>.py` with a `Converter` subclass.
2. Declare its `extensions` and implement `convert()`.
3. Import and register it in `src/handlers/__init__.py`.
4. Add a test in `tests/test_handlers.py`.

The `Converter.convert()` contract: write a `.md` file into `output_dir` and
return its `Path`. Raise `UnsupportedFormatError` if the file cannot be
converted — the CLI reports a clear message instead of silently skipping.

## Data flow

```
tmd convert input/ -o output/
  select_files() -> [paths]
  for each path: convert_file(path, output_dir)   # registry dispatch
  -> .md files in output/

tmd merge input/ -o mega.md --budget 4000 --delta
  select_files() -> [paths]
  for each: resolve_to_markdown()                 # convert-first via registry
  -> merge + TOC + separators
  -> if --budget: prune_to_budget() -> PruneResult
  -> write output
  -> if --delta: print_delta_summary()
```

## Token math

`src/tokenizer.py` is the single source of truth for token counting (tiktoken,
default encoding `o200k_base`). It is used by both the delta inspector and the
budget allocator, so token numbers are always consistent.

## Backward compatibility

`src/converter.py` keeps the original public API (`convert_pdf_to_markdown`,
`run_pipeline`) as thin wrappers over the registry, and `src/main.py` is a shim
that invokes the Typer CLI. Existing callers keep working unchanged.

## Entry points & modalities

The core logic (registry, handlers, tokenizer, merger, budget) is fully
decoupled from how it is invoked. Today there are two entry points to the same
CLI:

| Entry point | When to use |
|---|---|
| `tmd` (console script) | Installed globally via `pip install -e .` / `uv tool install .`; runnable from anywhere |
| `python src/main.py` | No install needed; just the dependencies in the environment |

Future modalities (a GUI, a web frontend, an API server, desktop app) can reuse
the same modules without touching the conversion logic — a new modality only
needs to call into `src/registry`, `src/merger`, etc.

## Development

```bash
uv pip install -e ".[dev]"
pytest          # run the test suite
ruff check .    # lint
mypy src        # type-check (strict)
```