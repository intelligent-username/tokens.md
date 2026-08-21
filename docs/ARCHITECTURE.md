# Architecture

`tokens.md` is a conversion pipeline with a pluggable registry at its core. The CLI (`tmd`) and the FastAPI backend are both thin entry points into the same `src.*` modules. Neither entry point contains conversion logic.

---

## Layer overview

```
┌─────────────────────────────────────────────────────────────┐
│  Entry points                                               │
│                                                             │
│  tmd (CLI, Typer)          tmd ui (FastAPI + uvicorn)       │
│  src/cli.py                backend/app.py + routes.py       │
└─────────────┬───────────────────────────┬───────────────────┘
              │                           │
              ▼                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Orchestration layer                                        │
│                                                             │
│  src/registry.py      convert_file(), DEFAULT_REGISTRY      │
│  src/merger.py        merge_files(), resolve_to_markdown()  │
│  src/budget.py        prune_to_budget()                     │
│  src/delta.py         compute_delta_summary()               │
│  src/tokenizer.py     count_tokens(), delta_percent()       │
│  src/file_selector.py select_files()                        │
│  src/fetch.py         fetch_url()   (trafilatura)           │
│  src/watcher.py       run_watcher() (watchdog)              │
└─────────────┬───────────────────────────────────────────────┘
              │  registry dispatch by extension
              ▼
┌─────────────────────────────────────────────────────────────┐
│  Converter layer                                            │
│                                                             │
│  src/handlers/pymupdf.py   PDF, EPUB, MOBI, XPS, FB2, ...  │
│  src/handlers/office.py    DOCX, PPTX, XLSX  (thin facade) │
│  src/handlers/structured.py  JSON, XML, CSV, YAML, ...     │
│  src/handlers/html.py      HTML/HTM (trafilatura)           │
│  src/handlers/repo.py      directory -> manifest            │
│  src/handlers/archive.py   ZIP, TAR, GZ, TGZ, BZ2          │
│  src/handlers/unsupported.py  catch-all, raises clearly     │
└─────────────┬───────────────────────────────────────────────┘
              │  office.py delegates to readers
              ▼
┌─────────────────────────────────────────────────────────────┐
│  Reader layer  (src/readers/)                               │
│                                                             │
│  docx.py   DOCX (python-docx, OMML math)                   │
│  pptx.py   PPTX (python-pptx, OMML math)                   │
│  xlsx.py   XLSX (openpyxl)                                  │
│  odf.py    ODT/ODS/ODP (odfpy + MathML-to-LaTeX)           │
│  rtf.py    RTF (striprtf)                                   │
│  eml.py    EML (stdlib email)                               │
│  msg.py    Outlook MSG (extract-msg)                        │
│  ebook.py  AZW3/AZW4 (mobi + pymupdf)                      │
│  subtitle.py  SRT/VTT                                       │
│  tex.py    LaTeX (regex, math verbatim)                     │
│  ipynb.py  Jupyter notebooks                                │
│  markdown.py  MD/MDX pass-through                           │
└─────────────┬───────────────────────────────────────────────┘
              │  Reader.read() -> Document IR
              ▼
┌─────────────────────────────────────────────────────────────┐
│  Model + Renderer                                           │
│                                                             │
│  src/engine/model.py    Document IR (Heading, Paragraph,     │
│                         Table, CodeBlock, ListItem, ...)     │
│  src/engine/renderer.py MarkdownRenderer: Document -> str    │
└─────────────────────────────────────────────────────────────┘
```

---

## Registry and dispatch

Every file type is owned by a `Converter` subclass that declares a `frozenset` of extensions and implements `convert(input_path, output_dir, **kwargs) -> Path`.

```python
# src/registry.py  (simplified)
class Converter(ABC):
    extensions: frozenset[str]
    name: str

    def convert(self, input_path: Path, output_dir: Path, **kwargs) -> Path: ...


class Registry:
    def register(self, converter: Converter) -> None: ...
    def convert_file(self, path: Path, output_dir: Path, **kwargs) -> Path: ...
```

`DEFAULT_REGISTRY` is populated in `src/handlers/__init__.py`. The CLI and API both call `convert_file()`, the single dispatch entry point.

Handlers that use the reader layer wrap a `Reader` subclass in `ReaderConverter`:

```python
# src/readers/adapter.py
class ReaderConverter(Converter):
    def convert(self, input_path, output_dir, **kwargs) -> Path:
        doc = self.reader.read(input_path)
        md = MarkdownRenderer().render(doc)
        out = output_dir / f"{input_path.stem}.md"
        out.write_text(md, encoding="utf-8")
        return out
```

---

## Conversion flow

```
tmd convert report.pdf
         │
         ▼
   select_files(source)
         │
         ▼
   for each path:
     convert_file(path, output_dir)
         │
         ├─ registry.dispatch(path.suffix) → Converter
         │
         ├─ (office) → Reader.read(path) → Document → MarkdownRenderer → .md
         │
         └─ (pymupdf) → pymupdf4llm.to_markdown(path) → .md
         │
         ▼
   count_tokens(markdown)  [tiktoken, o200k_base]
   print delta summary
```

```
tmd merge docs/ --budget 4000
         │
         ▼
   select_files()
         │
         ▼
   for each: resolve_to_markdown()   [convert-first via registry]
         │
         ▼
   merge_files()  [TOC + === FILE: name === separators]
         │
         ▼
   prune_to_budget()  [if --budget]
         │
         ▼
   write merged.md
```

---

## Document IR

Readers produce a `Document`; `MarkdownRenderer` renders it. Neither side knows about the other's concerns.

```python
# src/engine/model.py  (abridged)
Block = Heading | Paragraph | Table | CodeBlock | ListItem | Image | RawMarkdown | ...


@dataclass
class Document:
    blocks: list[Block]
    title: str
    metadata: dict[str, str]
```

`RawMarkdown` is an escape hatch for content already in Markdown format (HTML passthrough, LaTeX equations, Jupyter markdown cells).

---

## Math extraction

| Source | Mechanism | Output |
|---|---|---|
| DOCX | `m:oMath` / `m:oMathPara` XML via `src/math_converters/omml.py` | `$…$` / `$$…$$` |
| PPTX | Same OMML, unwrapped from `mc:AlternateContent` | `$…$` / `$$…$$` |
| ODT/ODS/ODP | MathML sub-documents extracted from zip, converted via `mathml-to-latex` | `$$…$$` |
| TEX | LaTeX source preserved verbatim | as-is |
| PDF / images | Math is rasterized; not extracted | — |

---

## Backend session model

```
POST /api/uploads  →  Workspace(session_id)
                          │
                          ├── uploads/   ← incoming files
                          ├── output/    ← converted .md files
                          └── repo/      ← reconstructed repo tree (tmd repo)

POST /api/convert  →  convert_file() per file_id
POST /api/merge    →  merge_files() → prune_to_budget() → output/merged.md
POST /api/fetch    →  fetch_url() → output/article.md
WS   /api/ws       →  watch events pushed per converted file
```

Sessions are temporary directories on disk, keyed by UUID. A background janitor thread deletes sessions older than `session_ttl_hours` (default 24h). `POST /api/session/close` deletes immediately.

---

## Frontend

```
frontend/
├── app/               Next.js App Router pages
├── components/
│   ├── layout/        Shell, TopBar, Navigation
│   ├── ui/            Reusable primitives (DropZone, Toggle, etc.)
│   └── workspaces/    ConvertWorkspace — main conversion flow
├── lib/
│   ├── api/           Typed wrappers over fetch (endpoints.ts, upload.ts, ws.ts)
│   ├── hooks/         useHealth, useJob, useWorkspaceState, useUpload, ...
│   └── utils/         cn, format, extensions
└── public/
```

The frontend calls the FastAPI backend at `http://127.0.0.1:8642/api`. In development, `npm run dev` proxies to it. In production, `tmd ui` serves the built `frontend/out/` directory from the same process.

---

## Module map

```
src/
├── cli.py            Typer CLI application entry point
├── cli_support/      Modular CLI command implementations
│   ├── commands.py   Typer command definitions (convert, watch, fetch, repo, merge, ui)
│   ├── convert_runner.py  Multithreaded conversion engine with Rich progress bars
│   ├── theme.py      Rich terminal color palettes, themes, and help formatters
│   └── utils.py      CLI path resolution, extension parsers, and port finders
├── registry.py       Converter abstract class, Registry, DEFAULT_REGISTRY
├── engine/           Document IR, renderer, and pipeline engine
│   ├── model.py      Document IR (Document, Block, Paragraph, Heading, Table, ListItem, etc.)
│   ├── renderer.py   MarkdownRenderer: Document -> string
│   └── converter.py  Backward-compatible wrappers (convert_pdf_to_markdown etc.)
├── handlers/         Registered file format handlers
│   ├── __init__.py   Registers all converters
│   ├── pymupdf.py    PDF, EPUB, MOBI, XPS, OXPS, FB2, CBZ, SVG, TXT
│   ├── office.py     DOCX, PPTX, XLSX (thin facade over readers)
│   ├── structured.py JSON, XML, CSV, YAML, TOML, INI, LOG
│   ├── html.py       HTML/HTM
│   ├── repo.py       Directory → manifest
│   ├── archive.py    ZIP, TAR, GZ, TGZ, BZ2
│   └── unsupported.py  Catch-all
├── math_converters/  Math conversion engines
│   ├── mathml.py     MathML -> LaTeX converter for ODF formulas
│   └── omml.py       OMML -> LaTeX converter for Word/PowerPoint equations
├── readers/          Format-specific file readers
├── fetch.py          tmd fetch (trafilatura + browser spoofing)
├── tokenizer.py      tiktoken wrapper (o200k_base default)
├── merger.py         merge_files(), resolve_to_markdown()
├── budget.py         prune_to_budget()
├── delta.py          compute_delta_summary()
├── watcher.py        run_watcher() hot-folder daemon (watchdog)
├── file_selector.py  select_files() with gitignore-style filtering
├── clipboard.py      pyperclip wrapper
└── deps.py           require() — lazy import with friendly error messages

backend/
├── app.py            FastAPI factory, CORS, error handlers, static mount
├── api_routes/       Modular REST & WebSocket API route handlers
│   ├── convert_routes.py  /api/convert, /api/merge, /api/fetch, /api/repo
│   ├── files_routes.py    /api/upload, /api/files/* download & inspect
│   └── watch_routes.py    /api/watch/* hot-folder monitoring controls
├── schemas.py        Pydantic v2 request/response models
├── config.py         Settings from TMD_* env vars
├── workspace.py      Workspace: per-session temp dir management
├── workspace_support/ Janitor cleanup, sample file generators, and path sanitizers
└── ws.py             WsManager: WebSocket event bus
```

---

## Adding a format

**Reader-first (recommended for structured formats):**

```python
# src/readers/myformat.py
from pathlib import Path
from ..engine.model import Document, Paragraph
from .base import Reader


class MyFormatReader(Reader):
    extensions = frozenset({".foo"})
    name = "myformat"

    def read(self, input_path: Path) -> Document:
        doc = Document(title=input_path.stem)
        doc.add(Paragraph("extracted text"))
        return doc
```

Register in `src/handlers/__init__.py`:

```python
from ..readers.adapter import ReaderConverter
from ..readers.myformat import MyFormatReader

DEFAULT_REGISTRY.register(ReaderConverter(MyFormatReader()))
```

**Converter-first (for formats that don't map to the IR):**

Implement `Converter` directly in `src/handlers/myformat.py`. Write the `.md` file to `output_dir`, return its `Path`, and raise `UnsupportedFormatError` on failure.

---

## Backward compatibility

`src/engine/converter.py` exposes the original `convert_pdf_to_markdown` and `run_pipeline` functions as thin wrappers over the registry. `src/main.py` is a shim that calls the Typer CLI. Both exist so callers from before the registry refactor keep working unchanged.