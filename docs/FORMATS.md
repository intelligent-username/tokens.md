# Supported formats

`tokens.md` converts documents to Markdown. All formats go through the registered reader pipeline

- Initial parsing into intermediate blocks
- Normalization prior to writing (headers, references, etc.)
- Written plainly as token-efficient Markdown.

This document outlines which formats are represented and a bit about what parts of them is preserved.

---

## Documents

- **DOCX** (Microsoft Word) — headings, paragraphs, lists, tables, OMML equations converted to LaTeX
- **PPTX** (Microsoft PowerPoint) — slide titles, body text, speaker notes, OMML equations converted to LaTeX
- **ODT** (LibreOffice Writer) — headings and paragraphs via odfpy
- **ODS** (LibreOffice Calc) — sheet contents via odfpy
- **ODP** (LibreOffice Impress) — slide text via odfpy
- **RTF** (Rich Text Format) — text extracted via control word stripping

## Spreadsheets

- **XLSX** (Microsoft Excel) — header rows and tables via openpyxl
- **CSV** (Comma-Separated Values) — converted to Markdown tables

## E-books and fixed layouts

- **PDF** — text, headings, and structure via pymupdf4llm
- **EPUB** — chapter text and structure via PyMuPDF
- **MOBI** — text and table of contents via the `mobi` package
- **XPS / OXPS** — document text extraction via PyMuPDF
- **FB2** (FictionBook) — text extraction via PyMuPDF
- **AZW3** (Amazon Kindle KF8) — text extracted via `mobi`, HTML-routed internally
- **AZW4** (Amazon Kindle PDF wrapper) — delegated to the PDF engine

## Plain text and code

- **TXT** — passed through PyMuPDF as plain text
- **TEX** — sectioning commands parsed, math environments preserved verbatim
- **MD / MARKDOWN / MDX** — native pass-through, no transformation applied
- **HTML / HTM** — structural text extraction via trafilatura

## Structured data and configuration

- **JSON** — pretty-printed in a fenced code block
- **XML** — pretty-printed in a fenced code block
- **YAML / YML** — fenced code block
- **TOML** — fenced code block
- **INI** — fenced code block
- **LOG** — fenced code block

## Email and messages

- **EML** — headers (From, To, Date, Subject) and decoded body
- **MSG** (Microsoft Outlook) — headers and body via `extract-msg`

## Subtitles and transcripts

- **SRT** — timing cues stripped, spoken text preserved
- **VTT** — header and timing lines stripped, transcript text preserved

## Jupyter notebooks

- **IPYNB** — Markdown cells pass through; code cells become fenced Python blocks; stream and display outputs become fenced text blocks

## Archives and repositories

- **ZIP, TAR, GZ, TGZ, BZ2** — recursively unpacked; each contained file converted individually and concatenated
- **Repositories** (`tmd repo`) — walks a directory tree and collapses source files into a single Markdown manifest

---

## Math and equations

Equations are preserved as LaTeX where the source directly encodes equation markup:

- **DOCX / PPTX**: OMML (`m:oMath`) converted to LaTeX (`$...$` and `$$...$$`)
- **ODF (ODT / ODS / ODP)**: formula sub-documents are extracted from the zip archive, MathML is parsed directly, and converted to LaTeX via `mathml-to-latex`
- **TEX**: math environments preserved verbatim
- **PDF**: math is rasterized in the binary layout and is not extracted

---

## Not supported

- **KFX** (Amazon proprietary post-KF8 format)
- **DJVU** (requires external C libraries, no pure-Python parser)
- **PAGES, NUMBERS, KEY** (Apple iWork proprietary protobuf formats)
- **DOC, XLS, PPT** (legacy binary Microsoft Office pre-2007)
- **Raster images** (PNG, JPG, GIF, BMP, TIFF) — these are accepted by the file picker but PyMuPDF produces no meaningful text output from raster-only files; do not expect usable Markdown from them
