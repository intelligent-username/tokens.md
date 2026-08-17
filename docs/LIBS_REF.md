# Document-Format Library API Reference

Source-of-truth notes for the reader implementations (DocxReader, PptxReader, XlsxReader, OdfReader, RtfReader, MsgReader, Azw3Reader) and their test fixtures. Compiled from each project's official documentation and, where the official docs don't cover a pattern, from the maintainers' own GitHub repos.

## Corrections to check against the existing plan

- **`mobi.extract()` returns a 2-tuple, not 3.** The official signature is `tempdir, filepath = mobi.extract(path)`. There is no separate `html` return value: `filepath` points to whichever file the mobi unpacked to (epub, html, or pdf depending on type), and the caller opens it. The plan's assumption of a 3-tuple `(tempdir, filepath, html)` is wrong. See the Azw3Reader section below.
- **Neither python-docx nor python-pptx read or convert embedded math.** `Font.math` (docx) only flags a run as "math content," and PowerPoint shapes containing an equation report `has_text_frame = False` even though the XML has text in it (confirmed on both projects' own issue trackers). Any math/LaTeX handling has to be built by hand against the raw `m:oMath` XML. Details and the exact tags to look for are in each library's section and in the combined **Math and LaTeX** section at the end.
- **python-docx has a higher-level alternative to the manual `iterchildren()` walk**: `Document.iter_inner_content()` and `_Cell.iter_inner_content()` already do the "walk paragraphs and tables in document order" job. Worth using instead of hand-rolling it, unless you need to also catch element types those methods skip.

---

## 1. python-docx (`pip install python-docx`)

Current docs: python-docx 1.2.0 (python-docx.readthedocs.io).

### Basic write/read API

```python
from docx import Document

document = Document()  # or Document('existing.docx')
document.add_heading("Title", 0)  # level 0 = "Title" style
document.add_heading("Section", level=1)  # level 1-9 -> "Heading {level}"
p = document.add_paragraph("Some text.")
p.add_run(" bold bit").bold = True
document.save("out.docx")
```

`add_heading(text='', level=1)` raises `ValueError` if `level` is outside **0-9** (not 1-6). `level=0` sets the "Title" style; `level=1` (or omitted) sets "Heading 1"; otherwise it sets "Heading {level}".

### Paragraph style API

`paragraph.style` returns a `ParagraphStyle` object, not a string. The style name is `paragraph.style.name`. This is exactly how heading level is inferred from an existing document:

```python
for para in document.paragraphs:
    if para.style.name.startswith("Heading"):
        level = int(para.style.name.split()[-1])  # "Heading 2" -> 2
```

`para.style.name` for an unstyled paragraph returns the document's default paragraph style (usually "Normal"), never `None`.

### Low-level body iteration (paragraphs + tables, in document order)

python-docx's `document.paragraphs` and `document.tables` are separate flat lists and lose interleaving order. To walk the body in actual document order, iterate the raw XML children of the document body and construct proxy objects from them. The python-docx maintainer posted this exact pattern on the project's own issue tracker:

```python
from docx import Document
from docx.document import Document as _Document
from docx.oxml.text.paragraph import CT_P
from docx.oxml.table import CT_Tbl
from docx.table import _Cell, Table, _Row
from docx.text.paragraph import Paragraph


def iter_block_items(parent):
    if isinstance(parent, _Document):
        parent_elm = parent.element.body
    elif isinstance(parent, _Cell):
        parent_elm = parent._tc
    elif isinstance(parent, _Row):
        parent_elm = parent._tr
    else:
        raise ValueError("something's not right")

    for child in parent_elm.iterchildren():
        if isinstance(child, CT_P):
            yield Paragraph(child, parent)
        elif isinstance(child, CT_Tbl):
            yield Table(child, parent)


doc = Document("test.docx")
for block in iter_block_items(doc):
    if isinstance(block, Paragraph):
        print(block.text)
    else:
        print(block.style.name)
```

`document.element` is the attribute that exposes the underlying `CT_Document` oxml element; `.body` is its body child. `Table`'s and `Paragraph`'s constructors both take `(oxml_element, parent)`, e.g. `Table(tbl: CT_Tbl, parent)` and (by the same pattern) `Paragraph(p: CT_P, parent)`.

**Simpler built-in alternative**, if you don't need cells/rows granularity: `Document.iter_inner_content() -> Iterator[Paragraph | Table]` and `_Cell.iter_inner_content()` ship in current python-docx and do the same document-order walk internally, without the manual isinstance dance.

### Table API

```python
for table in document.tables:  # or from iter_block_items above
    for row in table.rows:  # _Rows: len(), iteration, indexing, slicing
        for cell in row.cells:  # _Cell objects
            text = cell.text  # whole-cell text, all paragraphs joined
```

`table.cell(row_idx, col_idx)` gets a single cell directly; `(0, 0)` is top-left. `cell.text` is settable (replaces all cell content with one paragraph/run) and readable (concatenates all paragraphs in the cell). `_Cell.paragraphs` and `_Cell.tables` (nested tables) are also available, and `_Cell.iter_inner_content()` walks both in order.

**Gotcha**: `_Row.cells` is not guaranteed to be the same length across rows. Word lets a row start late or end early (merged/irregular tables), tracked via `_Row.grid_cols_before` / `grid_cols_after`. If you're building a rectangular matrix from `row.cells`, account for these or misaligned columns will result.

### Style name reference

Confirmed exact built-in paragraph style names shipped in the default template (`user/styles-understanding.html`). Note this goes to **Heading 9**, not 6:

```
Normal, Body Text, Body Text 2, Body Text 3, Caption,
Heading 1, Heading 2, Heading 3, Heading 4, Heading 5, Heading 6, Heading 7, Heading 8, Heading 9,
Intense Quote, List, List 2, List 3,
List Bullet, List Bullet 2, List Bullet 3,
List Continue, List Continue 2, List Continue 3,
List Number, List Number 2, List Number 3,
List Paragraph, Macro Text, No Spacing, Quote, Subtitle, TOCHeading, Title
```

A style only shows up in a saved `.docx` once it's actually applied to something at least once; unused built-in styles are "latent" and not written to `styles.xml`. If your fixture applies a style, it will be present; if you never used it, it won't be, even though Word would show it as available.

### Why the fixture needs a valid `[Content_Types].xml`

A `.docx` is an OPC (Open Packaging Conventions) zip package. `docx.Document()` opens the package, looks up the main document part, and checks its declared content type:

```python
document_part = Package.open(docx).main_document_part
if document_part.content_type != CT.WML_DOCUMENT_MAIN:
    raise ValueError(f"file '{docx}' is not a Word file, content type is '{document_part.content_type}'")
```

That content type comes from `[Content_Types].xml`, which maps each part path to a MIME-like type via `<Override>` elements. A minimal valid one needs, at least:

```xml
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml"
    ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>
```

If a hand-built fixture is missing this file, or the Override for `/word/document.xml`, `Document()` raises before your reader code even runs. python-docx's own test fixtures include a full example at `tests/test_files/expanded_docx/[Content_Types].xml` in the project repo. Use it as a template rather than writing one from scratch.

### Math (for the LaTeX plan)

See the combined **Math and LaTeX** section at the end. Short version: `Font.math` is a write-side boolean flag only, python-docx does not parse or expose `m:oMath` content through any high-level property, and the project's own issue tracker (#320, #1011) confirms this is not supported. `Paragraph.text` and `Run.text` silently skip math zones entirely; they aren't `<w:t>` elements.

**Source:** python-docx.readthedocs.io (quickstart, user/documents, user/styles-understanding, api/document, api/text, api/table); github.com/python-openxml/python-docx (issue #650, #320, #1011).

---

## 2. python-pptx (`pip install python-pptx`)

Current docs: python-pptx 1.0.0 (python-pptx.readthedocs.io).

### Basic API

```python
from pptx import Presentation

prs = Presentation()  # or Presentation('existing.pptx')
for slide in prs.slides:
    for shape in slide.shapes:
        if not shape.has_text_frame:
            continue
        for paragraph in shape.text_frame.paragraphs:
            for run in paragraph.runs:
                print(run.text)
```

That extraction loop is python-pptx's own documented example for "extract all text from slides," and it's exactly the shape a PptxReader needs. `shape.has_text_frame` is required before touching `.text_frame`: not all shapes have one (pictures, for instance), and, as noted below, shapes containing an equation report `False` here too even though they have text.

`slide.shapes.title` returns the title placeholder shape, or `None` if the slide's layout has no title placeholder.

### Speaker notes

```python
if slide.has_notes_slide:
    text = slide.notes_slide.notes_text_frame.text
```

**Gotcha**: accessing `slide.notes_slide` directly *creates* a notes slide if one doesn't exist yet. This is documented, intentional behavior (matches Word's lazy-creation-of-parts pattern). Always check `has_notes_slide` first if you're reading and don't want to mutate the file. `notes_text_frame` itself can also be `None` on a notes slide whose body placeholder was deleted, so check for that too.

### Fixture building

```python
from pptx import Presentation
from pptx.util import Inches, Pt

prs = Presentation()
blank_layout = prs.slide_layouts[6]  # index 6 is the blank layout in the default template
slide = prs.slides.add_slide(blank_layout)

txBox = slide.shapes.add_textbox(Inches(1), Inches(1), Inches(4), Inches(1))
tf = txBox.text_frame
tf.text = "First paragraph"
p = tf.add_paragraph()
p.text = "Second paragraph"
p.font.bold = True

prs.save("test.pptx")
```

**Gotcha**: `slide_layouts[6]` (blank) has **no title placeholder**. If a fixture combines `slide_layouts[6]` with `slide.shapes.title.text = "..."`, `shapes.title` is `None` and that line raises `AttributeError`. Use `slide_layouts[5]` (title only) or `[1]` (title + content) if the fixture needs both a title and a blank canvas for other shapes, or add a textbox instead of relying on the title placeholder on a blank layout.

For tables (if the fixture needs one): `shapes.add_table(rows, cols, left, top, width, height).table`, then `table.cell(r, c).text = "..."`.

### Math situation (equations break shape enumeration, not just text extraction)

Confirmed directly on python-pptx's own issue tracker (#947): a shape containing an equation returns `has_text_frame` behavior that makes text extraction fail via the normal path, even though `shape.part.blob` (raw XML) has the text right there. Related PR discussion (#706) explains why: PowerPoint frequently wraps equation-bearing shapes (and anything else added by a newer PowerPoint version than the base schema, including a table that contains an equation) inside `<mc:AlternateContent>` markup-compatibility branches. A naive `for shape in slide.shapes` walk can miss content nested in one of these branches entirely, since it never appears as a normal top-level shape. If math-in-tables matters for the reader, the shape tree walk needs to also branch into `mc:AlternateContent` / `mc:Choice` elements and pick the first (newest-version) choice.

**Source:** python-pptx.readthedocs.io (user/quickstart, user/notes, api/slides, dev/analysis/sld-notes-slide); github.com/scanny/python-pptx (issues #947, #706).

---

## 3. openpyxl (`pip install openpyxl`)

Current docs: openpyxl 3.1.4 (openpyxl.readthedocs.io).

### Reading

```python
from openpyxl import load_workbook

wb = load_workbook("file.xlsx", read_only=True, data_only=True)
for ws in wb.worksheets:
    for row in ws.iter_rows(values_only=True):
        print(row)  # tuple of cell values, not Cell objects
```

`load_workbook` flags, full signature and defaults:

| Flag | Default | Effect |
|---|---|---|
| `read_only` | `False` | Much less memory, faster; disables some features (charts, images, worksheet copying). Cannot copy worksheets from a read-only workbook. |
| `data_only` | `False` | `True` returns the last-calculated cached value for formula cells instead of the formula string. If the file was never opened in Excel, cached values may not exist and you'll get `None`. |
| `keep_vba` | `False` | Preserves VBA project content (still not editable) when re-saving `.xlsm`. |
| `keep_links` | `True` | Preserves cached data from external-workbook references. |
| `rich_text` | `False` | Preserves rich-text (mixed formatting) runs within a cell. |

`wb.worksheets` is a list of `Worksheet` objects (as opposed to `wb.sheetnames`, which is just the name strings). Both exist; iterating `for sheet in wb` also works and yields the same objects as `.worksheets`.

`ws.iter_rows(min_row=, max_row=, min_col=, max_col=, values_only=True)`: with `values_only=True`, each yielded row is a plain tuple of cell values (not `Cell` objects), which is what you want for a values-only markdown table dump. Without it, you get `Cell` objects and need `.value` on each.

**Gotcha**: openpyxl "does currently not read all possible items in an Excel file" per its own docs; shapes are explicitly called out as one of the things lost on a load-then-resave round trip.

### Fixture building

```python
from openpyxl import Workbook

wb = Workbook()
ws = wb.active  # workbook always starts with one sheet
ws.append(["Fruit", "2011", "2012"])  # header row
for row in data:  # data: list of lists/tuples
    ws.append(row)
wb.save("fixture.xlsx")
```

`ws.append()` takes a list/tuple/range/generator (appended left to right starting at column A) or a dict keyed by column letter/number. `Workbook.create_sheet(title, index)` adds additional sheets if the fixture needs more than one.

**Source:** openpyxl.readthedocs.io (tutorial, usage, api/openpyxl.reader.excel, api/openpyxl.worksheet.worksheet).

---

## 4. odfpy (`pip install odfpy`)

Docs are sparse/dated on the official side; behavior below is confirmed against the maintainers' own test suite (eea/odfpy on GitHub, the actively maintained fork).

### Reading

```python
from odf.opendocument import load
from odf import text, teletype

doc = load("file.odt")
for para in doc.body.getElementsByType(text.P):
    print(teletype.extractText(para))

for heading in doc.body.getElementsByType(text.H):
    level = heading.getAttribute("outlinelevel")
    print(level, teletype.extractText(heading))
```

`doc.body` is confirmed to exist and to be an `office:body` element (`d.body.isInstanceOf(office.Body)`, from odfpy's own test suite). `getElementsByType(class)` is recursive from wherever you call it, so `doc.getElementsByType(...)` (called on the document root) and `doc.body.getElementsByType(...)` return the same paragraphs and headings in a normal file. Scoping to `.body` just avoids matching anything odd living outside the body. There generally isn't anything there, so either works; `.body` is the more precise habit.

`teletype.extractText(node)` is the correct way to pull text out of a paragraph or heading element: it walks child text nodes and correctly expands whitespace-significant elements (`text:s` repeated-space, `text:tab`, `text:line-break`) into real `" "`, `\t`, `\n` characters. Calling `str(node)` or reading `.firstChild` directly will silently drop or mangle that whitespace.

`getAttribute("outlinelevel")` reads back the heading level. It returns a **string** (`"1"`, `"2"`, ...), not an int. Cast it if you need to compare numerically. This mirrors the constructor kwarg name (`outlinelevel=1`), which is itself stored in the XML as `text:outline-level`.

### Fixture building

```python
from odf.opendocument import OpenDocumentText
from odf.text import H, P

textdoc = OpenDocumentText()
textdoc.text.addElement(H(outlinelevel=1, text="Heading 1"))
textdoc.text.addElement(P(text="Hello World!"))
textdoc.text.addElement(H(outlinelevel=2, text="Heading 2"))
textdoc.save("TEST.odt")  # .odt extension appended automatically if omitted
```

Note the import shape is `from odf.text import H, P`, then bare `H(...)` / `P(...)`, not a `Text.H(...)` namespace object as one might guess from the module name. Content is added via `textdoc.text.addElement(...)` (the `.text` attribute, specific to `OpenDocumentText`), which is a sibling concept to `.body` used on the read side. Both point into the same document; `.text` is just the more specific handle a text document exposes for its content root.

**Source:** github.com/eea/odfpy (tests/testload.py, tests/testtypes.py, tests/testwhitespace.py, wiki/Introduction, manual/buildmanual.py).

---

## 5. striprtf (`pip install striprtf`)

One function.

```python
from striprtf.striprtf import rtf_to_text

text = rtf_to_text(rtf_string)
# text = rtf_to_text(rtf_string, encoding="latin-1")   # override default cp1252
# text = rtf_to_text(rtf_string, errors="ignore")      # relax on decode errors
```

Takes an already-decoded RTF **string** (not bytes, not a file path), so read the file yourself first (`open(path, encoding=...).read()` or handle bytes/encoding manually since RTF's own codepage control words affect this). `encoding` only applies when the RTF itself doesn't declare a codepage. No class, no options object, just the one function.

**Source:** pypi.org/project/striprtf, github.com/joshy/striprtf.

---

## 6. extract-msg (`pip install extract-msg`)

Docs: msg-extractor.readthedocs.io.

```python
import extract_msg

msg = extract_msg.Message("file.msg")
subject = msg.subject
sender = msg.sender
to = msg.to
date = msg.date
body = msg.body  # plain-text body
msg.close()
```

All confirmed attributes: `.subject`, `.sender`, `.to`, `.cc`, `.bcc`, `.date`, `.body` (plain text), `.htmlBody` / `.rtfBody` (also available if you want the richer body instead of plain text). `.close()` releases the underlying OLE compound-file handle. The library's own internal routing code (`open_msg.py`) calls it explicitly when re-dispatching to a more specific message subclass, so it's a real resource-release step, not a no-op. Call it in a `finally` block, or use the object as a context manager if the version you pin supports it.

**Source:** msg-extractor.readthedocs.io (extract_msg package reference, message_base module source).

---

## 7. mobi, for Azw3Reader (`pip install mobi`)

GitHub: iscc/mobi (fork of KindleUnpack packaged as a library). This is the one item flagged for verification, and verification changes the plan:

```python
import mobi

tempdir, filepath = mobi.extract("book.azw3")
# tempdir: directory the archive was unpacked into
# filepath: path to a single file, either .epub, .html, or .pdf depending on the source
```

**This is a 2-tuple, not 3.** There is no third `html` return value. `filepath`'s extension depends on what kind of mobi/azw3 was unpacked. An older-format book typically unpacks to HTML directly, while a newer KF8-only book can unpack to something else. Azw3Reader needs to branch on `filepath`'s suffix (or sniff content) rather than assume HTML unconditionally. If it is HTML, read it with your existing HTML-handling code; if it's already EPUB or PDF, that's a different code path (EPUB is itself a zip of HTML/XHTML files; PDF would go through the existing `pymupdf4llm` wrapper).

The docs also explicitly warn: **the library does not clean up `tempdir`**, that's the caller's responsibility (`shutil.rmtree(tempdir)` once you're done reading `filepath` and any sibling image files it references).

**Source:** github.com/iscc/mobi (README), pypi.org/project/mobi.

---

## 8. pytest fixtures (`pip install pytest`)

```python
import pytest


@pytest.fixture
def sample_docx(tmp_path):
    path = tmp_path / "sample.docx"
    # ... build the file at `path` ...
    return path
```

`tmp_path` is a built-in function-scoped fixture. It returns a `pathlib.Path` pointing at a fresh temporary directory unique to that test. Pytest auto-cleans these after retaining a few runs, so the directory doesn't vanish the instant the test ends. No setup needed, just add `tmp_path` as a parameter.

For stubbing something like a clipboard call in a test:

```python
def test_copies_to_clipboard(monkeypatch):
    calls = []
    monkeypatch.setattr("pyperclip.copy", lambda text: calls.append(text))
    do_the_thing_that_copies("hello")
    assert calls == ["hello"]
```

`monkeypatch.setattr(target, name, value, raising=True)` (or the single-string dotted-path form shown above) patches the attribute for the duration of the test only; it's automatically undone at teardown, no manual restore needed. `raising=True` (the default) means it errors loudly if the target attribute doesn't already exist, catching typos in the patch target instead of silently doing nothing.

**Source:** docs.pytest.org (how-to/monkeypatch, _pytest.monkeypatch reference).

---

## Math and LaTeX: the plan

Both formats store equations the same way underneath: an `<m:oMath>` (or `<m:oMathPara>` for a block/display equation) element in the namespace `http://schemas.openxmlformats.org/officeDocument/2006/math`. That's OMML (Office Math Markup Language). The job is: find these elements, convert each to a LaTeX string, and drop it into the output markdown wrapped in `$$...$$` (or `$...$` for inline) at the exact point it occurred. One converter function, shared by both readers.

Where to find the element in each format:

- **docx**: `<m:oMath>` sits directly inside a run's content, alongside regular `<w:r>` runs, as a paragraph child. Walk the paragraph's children with lxml, and where you'd normally read `<w:t>` text, check for `m:oMath` / `m:oMathPara` first.
- **pptx**: same `<m:oMath>` element, wrapped one layer deeper inside `<a14:m>` (namespace `http://schemas.microsoft.com/office/drawing/2010/main`), which is itself commonly nested in an `<mc:AlternateContent>` compatibility branch. Walking the shape tree, when you hit an `mc:AlternateContent`, take the first `mc:Choice` (the newest-version branch, where the real content lives) instead of skipping it.

Neither python-docx's `Run.text` nor python-pptx's `text_frame` surfaces `oMath` content on its own, since it isn't a `<w:t>`-style plain-text run. That's not a blocker. It just means the math extraction step lives in your own XML walk (which you're already writing, for the paragraph/table ordering) rather than being handed to you by `.text`. Drop in a check for the math namespace at the same point you're already iterating runs, and pull the LaTeX from there instead of skipping it.

**Fastest path to shipping this**: don't hand-write the OMML→LaTeX node mapping from scratch.

- `docxlatex` (`pip install docxlatex`) already does exactly this for docx: point it at the file, get `.equations` back as a list of ready LaTeX strings, delimiters configurable (`doc.inline_delimiter = "$"`, `doc.block_delimiter = "$$"`, which is exactly the format you want). One real caveat: it's most reliable on equations saved in Word's "linear" format rather than "professional" (2D) format. If source documents were authored the normal way, run a quick pass in Word/LibreOffice's Equation tab to batch-convert a test corpus, or test directly against real source files before assuming it needs that step.
- `docx-equation` (github.com/zlqm/docx-equation) is a smaller, directly-readable reference implementation of the `m:oMath` → LaTeX node mapping (`m:sSup`, `m:sSub`, `m:f`, `m:rad`, `m:nary`, `m:d`, etc.), useful to crib from or vendor a trimmed copy of even if `docxlatex` isn't used wholesale.
- For pptx, there's no equivalent maintained package to just install. The mapping logic is identical once the `m:oMath` element is located (same tags, same namespace), so the docx-side converter reaches pptx for free once the `a14:m` / `AlternateContent` unwrapping is in place. `pypptx-with-oxml` (a python-pptx fork) already did this unwrapping and is worth reading as a reference for the exact traversal, even if the reader ends up using its own lighter version instead of taking on the fork as a dependency.

Net: one shared `oMath_element_to_latex(element) -> str` function, called from both readers at the point each hits the math namespace, output spliced into the markdown as `$$...$$`. Straightforward, not a wall.

---

## ODF math extraction: MathML -> LaTeX

### How ODF stores formulas

A formula in Writer/Calc/Impress is an embedded sub-document, not inline markup. In the paragraph XML, a `<draw:frame>` contains a `<draw:object>` pointing at a folder inside the zip archive:

```xml
<text:p text:style-name="Formula">
  <draw:frame draw:name="Object1" text:anchor-type="as-char">
    <draw:object xlink:href="./Object 1" xlink:type="simple"/>
    <draw:image xlink:href="./ObjectReplacements/Object 1"/>
  </draw:frame>
</text:p>
```

`draw:object`'s `xlink:href` (`./Object 1`) is a folder inside the zip. Inside it is the formula's own `content.xml`. The `draw:image` sibling is a rendered fallback for viewers that cannot handle embedded objects; it contains no math and should be ignored.

Real formula `content.xml` (from a real LibreOffice/Google Docs export, `x^2`):

```xml
<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">
  <semantics>
    <msup><mi>x</mi><mn>2</mn></msup>
    <annotation encoding="StarMath 5.0">{x} ^ {2}</annotation>
  </semantics>
</math>
```

Two important details:

1. **The structural MathML (`msup`, `mfrac`, `msqrt`, `mtable`, etc.) is the authoritative source.** LibreOffice writes proper MathML alongside a `<annotation encoding="StarMath 5.0">` string for its own round-tripping. Convert MathML directly; don't parse the StarMath annotation.
2. **Namespace prefix varies by ODF/LibreOffice version.** Most exports use an unprefixed default namespace. Older files use a `math:` prefix on every element. Match by local-name and namespace URI, not by a hardcoded prefix string.

### Implementation: `mathml-to-latex` (Path B, pure Python)

```bash
pip install mathml-to-latex>=1.0
```

`mathml-to-latex` (MIT licensed, pure Python) exposes one class:

```python
from mathml_to_latex.converter import MathMLToLaTeX

latex = MathMLToLaTeX().convert(mathml_string)
```

It handles the full common presentation MathML tag set: `msup`, `msub`, `mfrac`, `msqrt`, `mtable`/`mtr`/`mtd`, `mfenced`, `mo`, `mi`, `mn`.

**Do not use** `latex2mathml` for this; it converts the opposite direction (LaTeX into MathML).

### Extraction function

```python
import zipfile
from xml.etree import ElementTree as ET

DRAW_NS = "urn:oasis:names:tc:opendocument:xmlns:drawing:1.0"
XLINK_NS = "http://www.w3.org/1999/xlink"
MATHML_NS = "http://www.w3.org/1998/Math/MathML"


def extract_odf_formulas(odt_path: str) -> dict[str, str]:
    """Return {object_folder: latex_string} for every embedded formula."""
    from mathml_to_latex.converter import MathMLToLaTeX

    formulas = {}
    converter = MathMLToLaTeX()
    with zipfile.ZipFile(odt_path) as z:
        root = ET.fromstring(z.read("content.xml"))
        draw_object_tag = f"{{{DRAW_NS}}}object"
        for obj in root.iter(draw_object_tag):
            href = obj.get(f"{{{XLINK_NS}}}href", "")
            folder = href.lstrip("./").rstrip("/")
            math_path = f"{folder}/content.xml"
            if math_path not in z.namelist():
                continue
            math_root = ET.fromstring(z.read(math_path))
            # Match by local-name + namespace (handles prefixed and default-ns forms)
            local = math_root.tag.split("}")[-1] if "}" in math_root.tag else math_root.tag
            if local != "math":
                continue
            mathml_str = ET.tostring(math_root, encoding="unicode")
            formulas[folder] = converter.convert(mathml_str)
    return formulas
```

### Inline vs. block

- **Block** (`$$...$$`): the `draw:frame` is the only child of its paragraph (no flanking text), or the `<math>` root has `display="block"`.
- **Inline** (`$...$`): the frame appears within a paragraph that also has surrounding text.

### Fallback

If `mathml-to-latex` fails on a particular formula, `py-asciimath` (`pip install py-asciimath`) uses the mmltex XSLT stylesheet as an alternative conversion path with the same input/output shape.

### Sources

- ODF formula frame structure: LibreOffice/OpenOffice mailing list archives and a real exported example from the `jgm/pandoc` issue tracker (#5602)
- Pandoc ODT MathML support: `jgm/pandoc` PR #5606 (merged)
- `mathml-to-latex`: pypi.org/project/mathml-to-latex (v1.0, Nov 2024)
- `py-asciimath`: pypi.org/project/py-asciimath, github.com/belerico/py_asciimath
