"""XML parsing and navigation helpers for OMML nodes."""

from __future__ import annotations

from xml.etree import ElementTree as ET

from .constants import OMML_NS


def _m(tag: str) -> str:
    """Return the Clark-notation tag for an OMML element name."""
    return f"{{{OMML_NS}}}{tag}"


def _text_of(node: ET.Element) -> str:
    """Concatenated m:t text of a run."""
    return "".join(t.text or "" for t in node.iter(_m("t")))


def _child(node: ET.Element, tag: str) -> ET.Element | None:
    return node.find(_m(tag))


def _bool_val(node: ET.Element | None) -> bool:
    """Read an OMML boolean property (``m:val`` of "1"/"true"/"on")."""
    if node is None:
        return False
    val = (node.get(f"{{{OMML_NS}}}val") or "").lower()
    return val in ("1", "true", "on")
