# `tmd` Usage Guide

`tmd` is the command-line interface for `tokens.md`. It converts files to
token-efficient Markdown for LLM prompts, combines files into master documents,
and reports how many tokens you saved.

```bash
tmd --help            # list all subcommands
tmd <command> --help  # help for a specific subcommand
tmd --version         # show version
```

Bare `tmd` runs `tmd convert` with defaults, preserving the original
`python src/main.py` behavior. Both bare `tmd` and `python src/main.py`
resolve the default `input/` and `output/` folders relative to the **project
root**, so they work from any directory. (Explicit `tmd convert <path>` and
`-o/--output` arguments are resolved relative to your current directory, as
usual.)

After converting, each file prints its token count — whole source file
(raw size) → Markdown — plus a `TOTAL` line:

```
Converted report.pdf -> report.md (142,000 -> 12,400 tokens)
TOTAL (142,000 tokens) -> (12,400 tokens) [-91.3%]
```

---

## `tmd convert` — batch conversion

Convert a file, a folder, or a glob pattern to Markdown.

```bash
tmd convert input/                        # convert all supported files in input/
tmd convert report.pdf -o out/            # single file
tmd convert docs/ --recursive             # recurse into subdirectories
tmd convert docs/ -e pdf,docx,html        # restrict to specific extensions
tmd convert report.pdf --strip-headers-footers
tmd convert report.pdf --write-images --image-path imgs/
tmd convert report.pdf --pages 0,1,2      # zero-based page indices
```

| Flag | Meaning |
|---|---|
| `SOURCE` | Directory, file path, or glob pattern (default `input`) |
| `-o, --output DIR` | Output directory (default `output`) |
| `-r, --recursive` | Recurse into subdirectories |
| `-e, --extensions` | Comma-separated extension filter (default: all supported) |
| `--strip-headers-footers` | Drop header/footer text |
| `--write-images` | Extract embedded images to disk |
| `--image-path DIR` | Where to write images |
| `--pages` | Comma-separated zero-based page indices |
| `--clip` | Also copy the combined Markdown to the clipboard |

Unsupported formats produce a clear message and exit code `1`; they are never
silently skipped. If a feature needs an optional package that isn't installed,
you get a friendly hint instead of a traceback, e.g.:

```
'tmd fetch' requires the 'trafilatura' package, which is not installed.
Install it with:  pip install -e .   (or: pip install trafilatura)
```

---

## `tmd clip` — convert straight to the clipboard

Convert on the fly and copy the Markdown to your system clipboard, skipping the
disk entirely. Paste directly into ChatGPT, Claude, or Gemini. `clip` supports
**every registered format** — PDFs, Office documents, e-books, email, subtitles,
LaTeX, and more. Files that cannot be converted (e.g. DRM'd or corrupt) are
skipped with a clear warning instead of aborting the whole operation.

```bash
tmd clip report.pdf                  # file -> clipboard
tmd clip docs/                       # folder -> clipboard (concatenated)
tmd clip report.pdf --write          # also save the .md to -o/--output
```

| Flag | Meaning |
|---|---|
| `--write` | Additionally save `.md` files to the output directory |
| `-o, --output DIR` | Output directory (only used with `--write`) |
| `--strip-headers-footers`, `--write-images`, `--image-path`, `--pages` | Same as `convert` |

Prints a confirmation with the character/line count of what was copied.

---

## `tmd watch` — hot-folder daemon

Watch a folder and auto-convert new files as they appear. Drop a PDF into the
inbox and the `.md` appears in the output — optionally on the clipboard too.

```bash
tmd watch -s inbox/ -o output/       # watch inbox/ (auto-created)
tmd watch --clip                     # copy each result to the clipboard
tmd watch --once                     # process existing files and exit
tmd watch --poll-interval 3.0        # stability wait before processing
```

| Flag | Meaning |
|---|---|
| `-s, --source DIR` | Hot folder to monitor (default `inbox`, auto-created) |
| `-o, --output DIR` | Output directory (default `output`) |
| `--poll-interval SECONDS` | Wait before processing a file so in-progress copies finish (default `2.0`) |
| `--clip` | Copy each converted result to the clipboard |
| `--once` | Process files already in the source folder and exit |
| `--strip-headers-footers`, `--write-images`, `--image-path`, `--pages` | Same as `convert` |

Press `Ctrl+C` to stop cleanly (exit code `0`). Per-file failures are logged
and never stop the watcher.

---

## `tmd fetch` — web page to Markdown

Fetch a web page, strip navbars, footers, ads, and scripts, and save just the
article's clean text as Markdown.

```bash
tmd fetch https://example.com/article -o output/
```

| Flag | Meaning |
|---|---|
| `URL` | The page to fetch |
| `-o, --output DIR` | Output directory (default `output`) |

The output file is named after the page's host/title.

---

## `tmd repo` — repository to a single manifest

Collapse an entire code repository into a single Markdown file with clear file
boundaries, respecting `.gitignore` rules.

```bash
tmd repo ./my-project -o output/
tmd repo ./my-project --exclude "*.lock" --exclude "build/"
```

| Flag | Meaning |
|---|---|
| `DIRECTORY` | Repository root |
| `-o, --output DIR` | Output directory (default `output`) |
| `--exclude PATTERN` | Extra gitignore-style patterns to skip (repeatable) |

Output structure:

```markdown
# Repository: my-project

## Tree
<indented directory tree>

## Files

=== FILE: src/main.py ===
<file contents>

=== FILE: src/registry.py ===
<file contents>
```

Binary files are skipped automatically.

---

## `tmd merge` — combine files into one master document

Merge many files into a single structured document with a Table of Contents and
`=== FILE: <name> ===` separators. Non-Markdown inputs are converted first.

```bash
tmd merge input/ -o mega.md            # merge a folder
tmd merge a.md b.pdf -o mega.md        # merge explicit files
tmd merge input/ --recursive           # recurse
tmd merge input/ -o mega.md --dedup    # drop duplicate lines
tmd merge input/ -o mega.md --no-toc   # skip the table of contents
tmd merge input/ -o mega.md --no-convert  # merge raw contents as-is
```

| Flag | Meaning |
|---|---|
| `SOURCE` | Directory, file path, or glob pattern |
| `-o, --output FILE` | Output file (default `merged.md`) |
| `-r, --recursive` | Recurse into subdirectories |
| `--dedup` | Remove exact duplicate lines (order preserved) |
| `--no-toc` | Skip the generated Table of Contents |
| `--no-convert` | Read raw file contents instead of converting first |
| `--encoding NAME` | tiktoken encoding (default `o200k_base`) |
| `--budget N` | Prune output to fit a hard token budget (see below) |
| `--delta` | Print a token delta summary after merging |

Files are merged in deterministic (path-sorted) order.

---

## Token budgeting & delta inspection

### `--budget N` — fit a hard token ceiling

Force the merged document to fit within `N` tokens. Content is pruned in order:
license/boilerplate lines, Markdown image references, then truncation from the
end (preserving the most important, earliest content).

```bash
tmd merge input/ -o mega.md --budget 4000
```

The tool prints a report of exactly what was removed:

```
[budget] 12,400 -> 4,000 tokens
  removed 3 blocks (-3,000 tokens)
  final: 4,000 tokens (fits budget)
```

### `tmd delta` — token savings report

Show how many tokens each conversion saved. The "before" count is the whole
source file estimated from its raw size (~4 bytes per token), so it reflects
the entire PDF/DOCX/PPTX/etc. rather than just its extracted text:

```bash
tmd delta input/ -o output/
tmd merge input/ -o mega.md --delta
```

Output format, one line per file plus a total:

```
PDF (142,000 tokens) -> Markdown (12,400 tokens) [-91.2%]
```

---

## Supported formats

| Family | Formats |
|---|---|
| Documents | PDF, DOCX, PPTX, XLSX, ODT/ODS/ODP (LibreOffice), RTF |
| E-books | EPUB, MOBI, XPS/OpenXPS, FB2, CBZ, AZW3/AZW4 (Kindle) |
| Email | Outlook MSG, EML |
| Subtitles | SRT, VTT |
| LaTeX | TEX |
| Web | HTML/HTM, live URLs (`tmd fetch`) |
| Structured data | JSON, XML, CSV, YAML, TOML, INI, LOG |
| Images | PNG, JPG/JPEG, TIF/TIFF, GIF, BMP, SVG |
| Text | TXT |
| Code | Any repository directory (`tmd repo`) |

**Math fidelity:** equations are preserved as LaTeX wherever the source encodes
them directly — DOCX/PPTX (OMML), ODF (MathML), and LaTeX source (verbatim).
Formats that rasterize math (PDF, images) skip math fidelity by design.

**Deliberately excluded** (no robust pure-Python parser): KFX, DJVU, Apple
iWork (PAGES/NUMBERS/KEY), and legacy binary Office (DOC/XLS/PPT).

Office and structured formats use best-effort extraction; anything that cannot
be meaningfully converted reports a clear "unsupported format" message instead
of failing silently.
