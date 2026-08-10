"""OMML (Office Math Markup Language) -> LaTeX. Shared by DocxReader and PptxReader.

Vendored from the docx-equation reference (github.com/zlqm/docx-equation).
Covers the common OMML nodes; unknown nodes fall back to their children so
content is never silently dropped.
"""

from __future__ import annotations

from xml.etree import ElementTree as ET

_M_NS = "http://schemas.openxmlformats.org/officeDocument/2006/math"


def _m(tag: str) -> str:
    """Return the Clark-notation tag for an OMML element name."""
    return f"{{{_M_NS}}}{tag}"


def _text_of(node: ET.Element) -> str:
    """Concatenated m:t text of a run."""
    return "".join(t.text or "" for t in node.iter(_m("t")))


def _child(node: ET.Element, tag: str) -> ET.Element | None:
    return node.find(_m(tag))


def _convert(node: ET.Element | None) -> str:
    """Convert a child element to LaTeX, or ``""`` when absent."""
    return _convert_children(node) if node is not None else ""


def _bool_val(node: ET.Element | None) -> bool:
    """Read an OMML boolean property (``m:val`` of "1"/"true"/"on")."""
    if node is None:
        return False
    val = (node.get(f"{{{_M_NS}}}val") or "").lower()
    return val in ("1", "true", "on")


def omath_element_to_latex(element: ET.Element) -> str:
    """Convert an m:oMath / m:oMathPara element to a LaTeX string."""
    return _convert_children(element)


def _convert_children(node: ET.Element) -> str:
    parts: list[str] = []
    for child in node:
        tag = child.tag
        if tag == _m("r"):  # run: plain text
            parts.append(_text_of(child))
        elif tag == _m("sSup"):  # x^y
            base, sup = _child(child, "e"), _child(child, "sup")
            parts.append(f"{{{_convert(base)}}}^{{{_convert(sup)}}}")
        elif tag == _m("sSub"):  # x_y
            base, sub = _child(child, "e"), _child(child, "sub")
            parts.append(f"{{{_convert(base)}}}_{{{_convert(sub)}}}")
        elif tag == _m("sSubSup"):  # x_y^z
            base = _child(child, "e")
            sub = _child(child, "sub")
            sup = _child(child, "sup")
            parts.append(
                f"{{{_convert(base)}}}_{{{_convert(sub)}}}^{{{_convert(sup)}}}"
            )
        elif tag == _m("f"):  # fraction
            num, den = _child(child, "num"), _child(child, "den")
            parts.append(f"\\frac{{{_convert(num)}}}{{{_convert(den)}}}")
        elif tag == _m("rad"):  # radical
            deg, e = _child(child, "deg"), _child(child, "e")
            if deg is not None and _convert(deg):
                parts.append(f"\\sqrt[{_convert(deg)}]{{{_convert(e)}}}")
            else:
                parts.append(f"\\sqrt{{{_convert(e)}}}")
        elif tag == _m("d"):  # delimiter (parentheses)
            parts.append(_delimiter(child))
        elif tag == _m("nary"):  # sum / integral / product
            parts.append(_nary(child))
        elif tag == _m("func"):  # function application
            parts.append(_func(child))
        elif tag == _m("acc"):  # accent
            parts.append(_acc(child))
        elif tag == _m("bar"):  # overline / underline
            parts.append(_bar(child))
        elif tag == _m("limLow"):  # limit below
            parts.append(_limit(child, above=False))
        elif tag == _m("limUpp"):  # limit above
            parts.append(_limit(child, above=True))
        elif tag == _m("groupChr"):  # overbrace / underbrace
            parts.append(_group_chr(child))
        elif tag == _m("eqArr"):  # equation array
            parts.append(_eq_arr(child))
        else:  # unknown: recurse, keep text
            parts.append((child.text or "") + _convert_children(child))
    return "".join(parts)


_NARY_OPERATORS: dict[str, str] = {
    "\u2211": "\\sum",
    "\u220f": "\\prod",
    "\u222b": "\\int",
    "\u222c": "\\iint",
    "\u222d": "\\iiint",
    "\u222e": "\\oint",
    "\u22c0": "\\bigwedge",
    "\u22c1": "\\bigvee",
    "\u22c2": "\\bigcap",
    "\u22c3": "\\bigcup",
    "\u2a00": "\\bigodot",
    "\u2a01": "\\bigoplus",
    "\u2a02": "\\bigotimes",
}


def _nary(node: ET.Element) -> str:
    """m:nary -> \\sum / \\int / \\prod with limits."""
    pr = node.find(_m("naryPr"))
    chr_val = ""
    sub_hide = False
    sup_hide = False
    if pr is not None:
        chr_el = pr.find(_m("chr"))
        if chr_el is not None:
            chr_val = chr_el.get(f"{{{_M_NS}}}val") or ""
        sub_hide = _bool_val(pr.find(_m("subHide")))
        sup_hide = _bool_val(pr.find(_m("supHide")))
    op = _NARY_OPERATORS.get(chr_val, chr_val or "\\int")
    sub = _child(node, "sub")
    sup = _child(node, "sup")
    e = _child(node, "e")
    sub_latex = "" if sub_hide or sub is None else _convert(sub)
    sup_latex = "" if sup_hide or sup is None else _convert(sup)
    e_latex = _convert(e)
    if sub_latex and sup_latex:
        return f"{op}_{{{sub_latex}}}^{{{sup_latex}}} {e_latex}"
    if sub_latex:
        return f"{op}_{{{sub_latex}}} {e_latex}"
    if sup_latex:
        return f"{op}^{{{sup_latex}}} {e_latex}"
    return f"{op} {e_latex}"


_ACCENTS: dict[str, str] = {
    "\u0300": "\\grave",
    "\u0301": "\\acute",
    "\u0302": "\\hat",
    "\u0303": "\\tilde",
    "\u0304": "\\bar",
    "\u0305": "\\bar",
    "\u0306": "\\breve",
    "\u0307": "\\dot",
    "\u0308": "\\ddot",
    "\u030c": "\\check",
    "\u20d7": "\\vec",
}


def _acc(node: ET.Element) -> str:
    """m:acc -> accent command over the base, e.g. ``\\hat{x}``."""
    e = _child(node, "e")
    base = _convert(e)
    pr = node.find(_m("accPr"))
    chr_val = "\u0302"
    if pr is not None:
        chr_el = pr.find(_m("chr"))
        if chr_el is not None:
            chr_val = chr_el.get(f"{{{_M_NS}}}val") or "\u0302"
    accent = _ACCENTS.get(chr_val, chr_val)
    return f"{accent}{{{base}}}"


def _bar(node: ET.Element) -> str:
    """m:bar -> ``\\overline`` / ``\\underline`` over the base."""
    e = _child(node, "e")
    base = _convert(e)
    pr = node.find(_m("barPr"))
    pos = "bot"
    if pr is not None:
        pos_el = pr.find(_m("pos"))
        if pos_el is not None:
            pos = (pos_el.get(f"{{{_M_NS}}}val") or "bot").lower()
    if pos == "top":
        return f"\\overline{{{base}}}"
    return f"\\underline{{{base}}}"


def _limit(node: ET.Element, above: bool) -> str:
    """m:limLow / m:limUpp -> base with the limit below or above."""
    e = _child(node, "e")
    lim = _child(node, "lim")
    base = _convert(e)
    limit = _convert(lim)
    if above:
        return f"{base}^{{{limit}}}"
    return f"{base}_{{{limit}}}"


def _group_chr(node: ET.Element) -> str:
    """m:groupChr -> ``\\overbrace`` / ``\\underbrace`` over the base."""
    e = _child(node, "e")
    base = _convert(e)
    pr = node.find(_m("groupChrPr"))
    chr_val = "\u23df"
    if pr is not None:
        chr_el = pr.find(_m("chr"))
        if chr_el is not None:
            chr_val = chr_el.get(f"{{{_M_NS}}}val") or "\u23df"
    if chr_val in ("\u23de", "\u23e0"):
        return f"\\overbrace{{{base}}}"
    if chr_val in ("\u23df", "\u23e1"):
        return f"\\underbrace{{{base}}}"
    return base


def _eq_arr(node: ET.Element) -> str:
    """m:eqArr -> rows joined with ``\\\\``."""
    rows = [_convert(e) for e in node.findall(_m("e"))]
    return " \\\\ ".join(rows)


_DELIM_ESCAPES: dict[str, str] = {"{": "\\{", "}": "\\}"}


def _delimiter(node: ET.Element) -> str:
    """m:d -> ``\\left...\\right`` with the declared begin/end characters."""
    pr = node.find(_m("dPr"))
    beg = "("
    end = ")"
    if pr is not None:
        beg_el = pr.find(_m("begChr"))
        if beg_el is not None:
            beg = beg_el.get(f"{{{_M_NS}}}val") or "("
        end_el = pr.find(_m("endChr"))
        if end_el is not None:
            end = end_el.get(f"{{{_M_NS}}}val") or ")"
    inner = _convert_children(node)
    return (
        f"\\left{_DELIM_ESCAPES.get(beg, beg)}"
        f"{inner}\\right{_DELIM_ESCAPES.get(end, end)}"
    )


def _func(node: ET.Element) -> str:
    """m:func -> function name applied to its argument."""
    fname = node.find(_m("fName"))
    e = _child(node, "e")
    name = _convert(fname)
    arg = _convert(e)
    return f"{name}\\left({arg}\\right)"