# tmd usage

`tmd` converts documents to token-efficient Markdown for LLM context windows. It runs from the command line, or you can launch the web UI locally with `tmd ui`.

```bash
tmd --help            # list all subcommands
tmd <command> --help  # help for a specific subcommand
tmd --version
```

Bare `tmd` with no arguments runs `tmd convert` with default source/output directories (`in/` or `input/` relative to the project root).

After each conversion, the tool reports token counts:

```
Converted report.pdf -> report.md (142,000 -> 12,400 tokens)
TOTAL (142,000 tokens) -> (12,400 tokens) [-91.3%]
```

The "before" count comes from the raw file size, not from parsing the file — it reflects the entire PDF/DOCX/etc. This is intentional: the number tells you how much context the original would have consumed.

---

## `tmd convert` — batch file conversion

Convert a file, a folder, or a glob pattern.

```bash
tmd convert input/
tmd convert report.pdf -o out/
tmd convert docs/ --recursive
tmd convert docs/ -e pdf,docx,html
tmd convert report.pdf --strip-headers-footers
tmd convert report.pdf --write-images --image-path imgs/
tmd convert report.pdf --pages 0,1,2
tmd convert docs/ --clip
```

| Flag | Default | Meaning |
|---|---|---|
| `SOURCE` | `input` | Directory, file path, or glob pattern |
| `-o, --output DIR` | `output` | Output directory |
| `-r, --recursive` | off | Recurse into subdirectories |
| `-e, --extensions` | all supported | Comma-separated extension filter (e.g. `pdf,docx`) |
| `--strip-headers-footers` | off | Strip running headers and footers from each page |
| `--write-images` | off | Extract embedded images to disk |
| `--image-path DIR` | auto | Where to write extracted images |
| `--pages` | all | Comma-separated zero-based page indices (e.g. `0,1,4`) |
| `--clip` | off | Also copy combined output to the system clipboard |

Unsupported formats exit with code `1` and print a clear message. If a required optional package is missing, the error tells you exactly what to install.

---

## `tmd clip` — convert to clipboard

Converts a file or folder and copies the Markdown to your clipboard, no disk writes required.

```bash
tmd clip report.pdf
tmd clip docs/
tmd clip report.pdf --write           # also save to disk
tmd clip report.pdf --write -o out/
```

| Flag | Default | Meaning |
|---|---|---|
| `SOURCE` | (required) | File or directory |
| `--write` | off | Also save `.md` files to the output directory |
| `-o, --output DIR` | `output` | Used only with `--write` |
| `--strip-headers-footers`, `--write-images`, `--image-path`, `--pages` | | Same as `convert` |

Prints the character and line count of what was copied.

---

## `tmd watch` — hot-folder daemon

Watches a directory and converts new files as they appear.

```bash
tmd watch -s inbox/ -o output/
tmd watch --clip                     # copy each result to clipboard
tmd watch --once                     # convert existing files and exit
tmd watch --poll-interval 3.0
```

| Flag | Default | Meaning |
|---|---|---|
| `-s, --source DIR` | `inbox` | Directory to monitor (created if missing) |
| `-o, --output DIR` | `output` | Output directory |
| `--poll-interval SECONDS` | `2.0` | Stability wait before converting a file (lets in-progress copies finish) |
| `--clip` | off | Copy each result to the clipboard |
| `--once` | off | Process existing files in the source folder and exit |
| `--strip-headers-footers`, `--write-images`, `--image-path`, `--pages` | | Same as `convert` |

`Ctrl+C` stops the watcher cleanly (exit code `0`). Per-file failures are logged and never stop the loop.

---

## `tmd fetch` — web page to Markdown

Fetches a URL, strips navigation, ads, and boilerplate, and saves the article text as Markdown.

```bash
tmd fetch https://example.com/article
tmd fetch https://example.com/article -o output/
```

| Flag | Default | Meaning |
|---|---|---|
| `URL` | (required) | Web page URL |
| `-o, --output DIR` | `output` | Output directory |

The output filename is derived from the page title or hostname.

---

## `tmd repo` — directory to a single manifest

Collapses a repository or project directory into one Markdown file with a directory tree and per-file contents, respecting `.gitignore` rules.

```bash
tmd repo ./my-project -o output/
tmd repo ./my-project --exclude "*.lock" --exclude "build/"
```

| Flag | Default | Meaning |
|---|---|---|
| `DIRECTORY` | (required) | Repository root |
| `-o, --output DIR` | `output` | Output directory |
| `--exclude PATTERN` | none | Extra gitignore-style exclude pattern (repeatable) |

Output structure:

```markdown
# Repository: my-project

## Tree
  src/
    main.py
    registry.py

## Files

=== FILE: src/main.py ===
<file contents>

=== FILE: src/registry.py ===
<file contents>
```

Binary files are skipped automatically.

---

## `tmd merge` — combine files into one document

Merges multiple files into a single Markdown document with a Table of Contents and `=== FILE: <name> ===` section separators. Non-Markdown inputs are converted first.

```bash
tmd merge input/ -o mega.md
tmd merge a.md b.pdf -o mega.md
tmd merge input/ --recursive
tmd merge input/ -o mega.md --no-toc
tmd merge input/ -o mega.md --dedup
tmd merge input/ -o mega.md --no-convert
tmd merge input/ -o mega.md --budget 4000
tmd merge input/ -o mega.md --delta
```

| Flag | Default | Meaning |
|---|---|---|
| `SOURCE` | (required) | Directory, file, or glob pattern |
| `-o, --output FILE` | `merged.md` | Output file |
| `-r, --recursive` | off | Recurse into subdirectories |
| `--no-toc` | off | Skip the generated Table of Contents |
| `--dedup` | off | Remove exact duplicate lines (order preserved) |
| `--no-convert` | off | Use raw file contents instead of converting first |
| `--encoding NAME` | `o200k_base` | tiktoken encoding for token counting |
| `--budget N` | off | Prune output to fit a hard token budget (see below) |
| `--delta` | off | Print a per-file token delta summary after merging |

Files are merged in sorted path order.

---

## `tmd delta` — token savings report

Shows the token reduction for files already converted.

```bash
tmd delta input/ -o output/
```

| Flag | Default | Meaning |
|---|---|---|
| `SOURCE` | (required) | Directory, file, or glob pattern of source files |
| `-o, --output DIR` | `output` | Directory containing the converted `.md` files |
| `--encoding NAME` | `o200k_base` | tiktoken encoding |

Output, one line per file:

```
PDF (142,000 tokens) -> Markdown (12,400 tokens) [-91.2%]
```

---

## `tmd ui` — local web UI

Launches the FastAPI backend and serves the web interface at `http://127.0.0.1:8642`. The browser opens automatically.

```bash
tmd ui
tmd ui --host 0.0.0.0    # expose on LAN
tmd ui --port 9000
tmd ui --no-browser      # don't auto-open the browser
```

| Flag | Default | Meaning |
|---|---|---|
| `--host` | `127.0.0.1` | Bind address |
| `--port` | `8642` | Port (auto-increments up to +20 if busy) |
| `--no-browser` | off | Skip auto-opening the browser |

### Static UI Resolution & Dev Mode
When `tmd ui` runs, it resolves the frontend interface in the following order:
1. **Bundled Static Assets**: Checks for pre-packaged `tmd_ui_static/` inside the installed package directory.
2. **Local Static Export**: Checks for `frontend/out/` in your workspace. If found, `tmd ui` serves both the API and UI directly on `http://127.0.0.1:8642`.
3. **Frontend Not Built Warning**: If neither static folder is built, navigating to `http://127.0.0.1:8642` displays instructions on how to build the frontend (`cd frontend && npm run build`).

To build the static UI for single-process hosting on `http://127.0.0.1:8642`, run:
```bash
cd frontend && npm install && npm run build
```

The REST API is available at `http://127.0.0.1:8642/api` with interactive Swagger docs at `/docs`.


---

## Token budgeting

`--budget N` forces the output to fit within `N` tokens. Pruning happens in order:

1. License/boilerplate lines
2. Markdown image references
3. Truncation from the end (earliest/most important content preserved)

Example output:

```
[budget] 12,400 -> 4,000 tokens
  removed 3 blocks (-3,000 tokens)
  final: 4,000 tokens (fits budget)
```

---

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Success |
| `1` | One or more files failed to convert, or no files found |

---

## Supported formats

| Family | Formats |
|---|---|
| Documents | DOCX, PPTX, ODT, ODS, ODP, RTF |
| Spreadsheets | XLSX, CSV |
| E-books | PDF, EPUB, MOBI, XPS/OXPS, FB2, CBZ, AZW3, AZW4 |
| Email | EML, MSG |
| Subtitles | SRT, VTT |
| Plain text | TXT |
| LaTeX | TEX |
| Markdown | MD, MARKDOWN, MDX |
| Notebooks | IPYNB |
| Web | HTML, HTM |
| Structured data | JSON, XML, YAML, YML, TOML, INI, LOG |
| Archives | ZIP, TAR, GZ, TGZ, BZ2 |
| Repositories | Any directory via `tmd repo` |

Math equations are preserved as LaTeX from DOCX/PPTX (OMML) and ODT/ODS/ODP (MathML). PDF and image math is rasterized and is not extracted.

Not supported by design: KFX, DJVU, Apple iWork (PAGES/NUMBERS/KEY), legacy binary Office (DOC/XLS/PPT).

---

## Environment variables (web backend)

These only apply when running `tmd ui` or the backend directly.

| Variable | Default | Meaning |
|---|---|---|
| `TMD_HOST` | `127.0.0.1` | Bind address |
| `TMD_PORT` | `8642` | Port |
| `TMD_MAX_UPLOAD_MB` | `100` | Per-file upload size limit |
| `TMD_MAX_SESSION_MB` | `1000` | Total session size limit |
| `TMD_SESSION_TTL_HOURS` | `24` | Session expiry |
| `TMD_CORS_ORIGINS` | `http://localhost:3000,...` | Allowed CORS origins (comma-separated) |
| `TMD_UI_DIR` | auto | Path to built frontend static files |
| `TMD_ALLOW_LOCAL_PATHS` | `false` | Allow server-side file paths in API requests |
| `TMD_LOCAL_PATHS_ROOT` | cwd | Root for server-side path access when enabled |
| `TMD_LOG_LEVEL` | `info` | Logging level |
