"""ODF (ODT/ODS/ODP) reader backed by odfpy with MathML-to-LaTeX extraction.

Paragraph and heading structure comes from odfpy's element walk.
Embedded formula objects (draw:frame -> draw:object -> content.xml) are
extracted directly from the zip archive, converted from MathML to LaTeX
via mathml-to-latex, and spliced in as RawMarkdown blocks at the position
they occurred in the document.

Namespace handling is defensive: element matching is done by local-name and
namespace URI so both unprefixed default-namespace files and older
prefixed (math:math) exports are handled correctly.
"""

from __future__ import annotations

import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

from ..deps import require
from ..engine.model import Document, Heading, Paragraph, RawMarkdown
from .base import Reader

ODF_EXTENSIONS = frozenset({".odt", ".ods", ".odp"})

# ODF XML namespaces
_NS_DRAW = "urn:oasis:names:tc:opendocument:xmlns:drawing:1.0"
_NS_XLINK = "http://www.w3.org/1999/xlink"
_NS_MATHML = "http://www.w3.org/1998/Math/MathML"

_DRAW_OBJECT = f"{{{_NS_DRAW}}}object"
_DRAW_FRAME = f"{{{_NS_DRAW}}}frame"


def _local(tag: str) -> str:
    return tag.split("}")[-1] if "}" in tag else tag


def _is_mathml_root(element: ET.Element) -> bool:
    local = _local(element.tag)
    if local != "math":
        return False
    ns = element.tag[1 : element.tag.index("}")] if "{" in element.tag else ""
    return ns == _NS_MATHML or ns == ""


def _extract_formula_map(odf_path: Path) -> dict[str, str]:
    """Return {object_folder_name: latex_string} for every embedded formula.

    Each ODF formula lives in its own sub-document folder inside the zip.
    Embedded objects that are not MathML formulas (charts, spreadsheets) are
    silently skipped. Returns an empty dict if mathml-to-latex is not installed
    so the reader continues working without math extraction.
    """
    try:
        MathMLToLaTeX = require(  # type: ignore[attr-defined]
            "mathml_to_latex", "ODF math extraction"
        ).MathMLToLaTeX
    except Exception:
        return {}

    formulas: dict[str, str] = {}
    converter = MathMLToLaTeX()

    try:
        with zipfile.ZipFile(odf_path) as zf:
            names = set(zf.namelist())
            root = ET.fromstring(zf.read("content.xml"))
            for obj_el in root.iter(_DRAW_OBJECT):
                href = obj_el.get(f"{{{_NS_XLINK}}}href", "")
                folder = href.lstrip("./").rstrip("/")
                math_path = f"{folder}/content.xml"
                if math_path not in names:
                    continue
                math_root = ET.fromstring(zf.read(math_path))
                if not _is_mathml_root(math_root):
                    continue
                mathml_str = ET.tostring(math_root, encoding="unicode")
                try:
                    latex = converter.convert(mathml_str)
                except Exception:
                    latex = ""
                if latex:
                    formulas[folder] = latex
    except (zipfile.BadZipFile, KeyError, ET.ParseError):
        pass

    return formulas


def _odfpy_frame_folder(frame_node: object) -> str | None:
    """Return the object folder href from a draw:frame odfpy element, or None.

    Uses odfpy's own childNodes / attributes API — no XML serialization.
    """
    # odfpy Element: .childNodes is a list, .attributes is a dict of
    # (namespace, localname) -> value tuples.
    for child in getattr(frame_node, "childNodes", []):
        qname = getattr(child, "qname", None)
        if qname is None:
            continue
        # qname is (namespace_uri, local_name)
        ns, local = qname if isinstance(qname, tuple) and len(qname) == 2 else (None, None)
        if ns == _NS_DRAW and local == "object":
            attrs = getattr(child, "attributes", {})
            href = attrs.get((_NS_XLINK, "href"), "")
            folder = href.lstrip("./").rstrip("/")
            if folder:
                return folder
    return None


def _odfpy_has_only_frame(para_node: object) -> bool:
    """True if the paragraph's only meaningful child is a draw:frame.

    Used to choose block ($$) vs inline ($) math rendering.
    """
    children = getattr(para_node, "childNodes", [])
    non_empty = [c for c in children if getattr(c, "data", "").strip() or getattr(c, "qname", None) is not None]
    if len(non_empty) != 1:
        return False
    only = non_empty[0]
    qname = getattr(only, "qname", None)
    if not isinstance(qname, tuple) or len(qname) != 2:
        return False
    ns, local = qname
    return ns == _NS_DRAW and local == "frame"


class OdfReader(Reader):
    extensions = ODF_EXTENSIONS
    name = "odf"

    def read(self, input_path: Path) -> Document:
        require("odf", "ODF conversion")  # odfpy
        from odf import teletype
        from odf import text as odftext
        from odf.opendocument import load

        formula_map = _extract_formula_map(input_path)

        doc_obj = load(str(input_path))
        result = Document()
        body = doc_obj.body

        def _process_paragraph(node: object, level: int | None = None) -> None:
            plain = teletype.extractText(node).strip()  # type: ignore[arg-type]

            # Look for draw:frame children that reference a known formula.
            formulas_found: list[tuple[bool, str]] = []  # (is_block, latex)
            if formula_map:
                for frame in getattr(node, "childNodes", []):
                    qname = getattr(frame, "qname", None)
                    if not isinstance(qname, tuple) or len(qname) != 2:
                        continue
                    ns, local = qname
                    if ns != _NS_DRAW or local != "frame":
                        continue
                    folder = _odfpy_frame_folder(frame)
                    if folder and folder in formula_map:
                        is_block = _odfpy_has_only_frame(node)
                        formulas_found.append((is_block, formula_map[folder]))

            if formulas_found:
                if plain:
                    if level is not None:
                        result.add(Heading(text=plain, level=level))
                    else:
                        result.add(Paragraph(plain))
                for is_block, latex in formulas_found:
                    if is_block:
                        result.add(RawMarkdown(f"$$\n{latex}\n$$"))
                    else:
                        result.add(RawMarkdown(f"${latex}$"))
            elif plain:
                if level is not None:
                    result.add(Heading(text=plain, level=level))
                else:
                    result.add(Paragraph(plain))

        for node in body.getElementsByType(odftext.P):
            _process_paragraph(node, level=None)

        for node in body.getElementsByType(odftext.H):
            try:
                lvl = int(node.getAttribute("outlinelevel") or 1)
            except (TypeError, ValueError):
                lvl = 1
            _process_paragraph(node, level=lvl)

        return result
