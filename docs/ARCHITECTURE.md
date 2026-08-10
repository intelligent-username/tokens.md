# Architecture

`tokens.md` is a small, pluggable toolkit that turns files into token-efficient
Markdown for LLM prompts. This document explains how the pieces fit together and
how to extend the tool.

## Module map

```
src/
├── cli.py            # Typer CLI: convert, clip, watch, fetch, repo, merge, delta
├── registry.py       # Converter ABC, Registry, DEFAULT_REGISTRY, convert_file
├── model.py          # Format-agnostic Document IR (Heading, Paragraph, Table, ...)
├── renderer.py       # MarkdownRenderer: Document IR -> Markdown
├── detector.py       # FormatDetector: magic-byte fallback for unknown extensions
├── omml.py           # OMML -> LaTeX (DOCX/PPTX equations, vendored from docx-equation)
├── mathml.py         # MathML -> LaTeX (ODF equations, stdlib-only)
├── readers/          # Reader ABC + one Reader per format family
│   ├── base.py       #   Reader ABC (read(Path) -> Document)
│   ├── adapter.py    #   ReaderConverter: adapts Reader + Renderer into a Converter
│   ├── docx.py       #   DOCX (python-docx, heading styles, OMML math)
│   ├── pptx.py       #   PPTX (python-pptx, slide titles, notes, OMML math)
│   ├── xlsx.py       #   XLSX (openpyxl, header row -> table)
│   ├── odf.py        #   ODT/ODS/ODP (odfpy, outlinelevel -> headings)
│   ├── rtf.py        #   RTF (striprtf)
│   ├── msg.py        #   Outlook MSG (extract-msg)
│   ├── eml.py        #   EML (stdlib email)
│   ├── ebook.py      #   AZW3 (mobi) / AZW4 (pymupdf PDF wrapper)
│   ├── subtitle.py   #   SRT/VTT (stdlib)
│   └── tex.py        #   LaTeX (regex, math preserved verbatim)
├── handlers/         # Built-in converters (one per format family)
│   ├── pymupdf.py    #   PDF / e-books / images / text (pymupdf4llm)
│   ├── office.py     #   thin facade over DocxReader/PptxReader/XlsxReader
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

There are two ways to add a format, depending on how much structure you need:

**Reader-first (recommended for structured formats).** Create a `Reader`
subclass in `src/readers/` that parses the file into the format-agnostic
`Document` IR (`src/model.py`), then register it via `ReaderConverter`:

```python
# src/readers/myformat.py
from pathlib import Path
from ..model import Document, Paragraph
from .base import Reader

class MyFormatReader(Reader):
    extensions = frozenset({".foo"})
    name = "myformat"

    def read(self, input_path: Path) -> Document:
        doc = Document(title=input_path.stem)
        doc.add(Paragraph("extracted text"))
        return doc
```

```python
# src/handlers/__init__.py
from ..readers.adapter import ReaderConverter
from ..readers.myformat import MyFormatReader
DEFAULT_REGISTRY.register(ReaderConverter(MyFormatReader()))
```

The `ReaderConverter` adapter handles the `Converter` contract (writing the
`.md` file, wrapping parser errors in `UnsupportedFormatError`, rejecting empty
documents). The shared `MarkdownRenderer` turns your `Document` blocks into
Markdown, so output style is identical across all formats.

**Converter-first (for simple/legacy formats).** Create `src/handlers/<name>.py`
with a `Converter` subclass, declare its `extensions`, implement `convert()`,
and register it in `src/handlers/__init__.py`.

The `Converter.convert()` contract: write a `.md` file into `output_dir` and
return its `Path`. Raise `UnsupportedFormatError` if the file cannot be
converted — the CLI reports a clear message instead of silently skipping.

### Math fidelity

Equations are preserved as LaTeX wherever the source format directly encodes
them:

| Source | Where math lives | Conversion |
|---|---|---|
| DOCX | OMML (`m:oMath` / `m:oMathPara`) | `src/omml.py` → `$…$` / `$$…$$` |
| PPTX | OMML inside `mc:AlternateContent` | unwrap `mc:Choice`, then `src/omml.py` |
| ODT/ODS/ODP | MathML (`<math:math>`) | `src/mathml.py` → `$$…$$` |
| TEX | native LaTeX source | preserved verbatim |

Formats that rasterize math (PDF, images) skip math fidelity by design; see
`notes/format-expansion-plan.md` §5.4 for the full gap list.

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