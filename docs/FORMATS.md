# Supported Formats

tokens.md converts the following formats to clean Markdown. All supported formats go through the same unified pipeline: parsed to structured content, normalized to Markdown, and optimized for LLM token efficiency.

## Fully Supported

### Documents
- DOCX (Microsoft Word)
- PPTX (Microsoft PowerPoint)
- ODT (LibreOffice Writer)
- ODP (LibreOffice Impress)
- RTF (Rich Text Format)

### Spreadsheets
- XLSX (Microsoft Excel)
- ODS (LibreOffice Calc)
- CSV (Comma-Separated Values)

### E-books
- PDF (Portable Document Format)
- EPUB (Electronic Publication)
- MOBI (Mobipocket)
- XPS (XML Paper Specification)
- FB2 (FictionBook)
- AZW3 / AZW4 (Amazon Kindle)

### Media & Images
- PNG, JPG, TIF, GIF, BMP (raster images)
- SVG (Scalable Vector Graphics)
- CBZ (Comic Book Archive)

### Plain Text & Code
- TXT (plain text)
- TEX (LaTeX source)
- HTML, HTM (HyperText Markup Language)
- JSON (JavaScript Object Notation)
- XML (Extensible Markup Language)
- YAML (YAML configuration)
- TOML (configuration)
- INI (configuration files)
- LOG (log files)

### Email & Messages
- EML (Email message format)
- MSG (Microsoft Outlook)

### Subtitles & Transcripts
- SRT (SubRip subtitles)
- VTT (WebVTT subtitles)

### Code Repositories
- `tmd repo` — collapse entire directory structures into a single Markdown manifest

## Math & Equations

Equations are preserved as LaTeX wherever the source encodes them directly:

- **DOCX/PPTX** — OMML (Office Math Markup Language) converted to LaTeX
- **ODF (ODT/ODS/ODP)** — MathML converted to LaTeX
- **TEX** — LaTeX source preserved verbatim
- **PDF, images** — math is rasterized and cannot be reliably extracted

## Not Supported (By Design)

The following formats lack robust pure-Python parsers or are too proprietary to handle reliably:

- **KFX** (Amazon Kindle proprietary format)
- **DJVU** (scanned document format)
- **PAGES, NUMBERS, KEY** (Apple iWork formats)
- **DOC, XLS, PPT** (legacy binary Microsoft Office, pre-2007)
