# Supported formats

`tokens.md` converts documents to Markdown through registered reader and converter pipelines:

- Structured parsing into semantic intermediate document blocks (`Heading`, `Paragraph`, `Table`, `CodeBlock`, `ListItem`, `Image`, etc.)
- Normalization (table alignment, heading hierarchies, math equations)
- Written plainly as token-efficient, LLM-optimized Markdown.

---

## Documents

- **DOCX** (Microsoft Word): headings, paragraphs, lists, tables, and OMML equations converted to LaTeX (`$...$` inline, `$$...$$` display).
- **PPTX** (Microsoft PowerPoint): slide titles, body shapes, bullet points, speaker notes, and OMML equations converted to LaTeX.
- **ODT** (LibreOffice Writer): headings, paragraphs, and MathML formula sub-documents converted to LaTeX via `odfpy`.
- **ODS** (LibreOffice Calc): multi-sheet cell contents and tables via `odfpy`.
- **ODP** (LibreOffice Impress): slide headings, text frames, and speaker notes via `odfpy`.
- **RTF** (Rich Text Format): text extracted cleanly via control word stripping (`striprtf`).

## Spreadsheets

- **XLSX** (Microsoft Excel): sheet headers, formatted data rows, and grid tables via `openpyxl`.
- **CSV** (Comma-Separated Values): tabular data converted to standard Markdown tables.

## E-books and fixed layouts

- **PDF**: text, headers/footers, multi-column layouts, tables, and optional image extraction via `pymupdf4llm` (with pure `pymupdf` fallback).
- **EPUB**: chapter text, headings, and document structure via PyMuPDF.
- **MOBI**: text, chapters, and table of contents unpacked via `mobi` and PyMuPDF.
- **XPS / OXPS**: fixed document text extraction via PyMuPDF.
- **FB2** (FictionBook): text and section extraction via PyMuPDF.
- **AZW3** (Amazon Kindle KF8): extracted via `mobi` package, HTML/EPUB chapters parsed with TOC heading mappings.
- **AZW4** (Amazon Kindle PDF wrapper): delegated to the PyMuPDF PDF engine.
- **CBZ**: comic book archives parsed and inspected via PyMuPDF.

## Plain text and code

- **TXT / LOG**: plain text streams preserved cleanly.
- **TEX**: LaTeX sectioning commands parsed, math environments (`equation`, `align`, `$$`) preserved verbatim.
- **MD / MARKDOWN / MDX**: native pass-through without destructive re-formatting.
- **HTML / HTM**: article text extraction, navigation/boilerplate stripping via `trafilatura`.

## Structured data and configuration

- **JSON**: formatted and highlighted in a fenced ````json```` code block.
- **XML**: pretty-printed in a fenced ````xml```` code block.
- **YAML / YML**: preserved in a fenced ````yaml```` code block.
- **TOML**: preserved in a fenced ````toml```` code block.
- **INI**: preserved in a fenced ````ini```` code block.

## Email and messages

- **EML** (Standard Email): headers (From, To, Cc, Date, Subject) and decoded plaintext/HTML body via Python stdlib `email`.
- **MSG** (Microsoft Outlook): sender, recipients, timestamps, subject, and body via `extract-msg`.

## Subtitles and transcripts

- **SRT** (SubRip Subtitles): timing codes and subtitle indices stripped, continuous speech transcript preserved.
- **VTT** (WebVTT): header, cue timings, and positioning directives stripped, transcript text preserved.

## Jupyter notebooks

- **IPYNB**: Markdown cells preserved as Markdown; code cells converted to fenced ````python```` blocks; stdout, stderr, and output data converted to fenced text blocks.

## Archives and repositories

- **ZIP, TAR, GZ, TGZ, BZ2**: recursively unpacked; each contained document converted individually and combined.
- **Repositories** (`tmd repo`): traverses repository tree respecting `.gitignore` rules, generates an ASCII directory tree and collapses source files into a single manifest.

---

## Math and equations

Equations are preserved as standard LaTeX where the source directly encodes equation markup:

- **DOCX / PPTX**: OMML (`m:oMath`, `m:oMathPara`) parsed and converted to LaTeX (fractions, exponents, radicals, matrices, brackets, accents).
- **ODF (ODT / ODS / ODP)**: MathML formula objects parsed and converted to LaTeX (fractions, roots, sub/sup, matrices).
- **TEX**: Math environments preserved verbatim.
- **PDF**: Rasterized equations in binary layout are not OCR'd; text equations are extracted as text.

---

## Not supported by design

- **KFX** (Amazon proprietary DRM-locked post-KF8 format).
- **DJVU** (Requires external binary C libraries; no pure-Python reader).
- **PAGES, NUMBERS, KEY** (Apple iWork proprietary protobuf bundle formats).
- **DOC, XLS, PPT** (Legacy binary Microsoft Office 97-2003 formats; convert to modern DOCX/XLSX/PPTX first).
- **Raster-only images** (PNG, JPG, GIF, BMP, TIFF without text streams).

