"""Node-by-node OMML to LaTeX converter functions."""

from __future__ import annotations

from xml.etree import ElementTree as ET

from .constants import ACCENTS, DELIM_ESCAPES, NARY_OPERATORS, OMML_NS
from .xml_utils import _bool_val, _child, _m, _text_of


def _convert(node: ET.Element | None) -> str:
    """Convert a child element to LaTeX, or ``""`` when absent."""
    return _convert_children(node) if node is not None else ""


def _convert_children(node: ET.Element) -> str:
    parts: list[str] = []
    for child in node:
        tag = child.tag
        if tag == _m("r"):
            parts.append(_text_of(child))
        elif tag == _m("sSup"):
            base, sup = _child(child, "e"), _child(child, "sup")
            base_latex = _convert(base)
            sup_latex = _convert(sup)
            if len(base_latex) > 1 or (base_latex and not base_latex.isalnum()):
                base_latex = f"{{{base_latex}}}"
            if len(sup_latex) > 1 or (sup_latex and not sup_latex.isalnum()):
                sup_latex = f"{{{sup_latex}}}"
            parts.append(f"{base_latex}^{sup_latex}")
        elif tag == _m("sSub"):
            base, sub = _child(child, "e"), _child(child, "sub")
            base_latex = _convert(base)
            sub_latex = _convert(sub)
            if len(base_latex) > 1 or (base_latex and not base_latex.isalnum()):
                base_latex = f"{{{base_latex}}}"
            if len(sub_latex) > 1 or (sub_latex and not sub_latex.isalnum()):
                sub_latex = f"{{{sub_latex}}}"
            parts.append(f"{base_latex}_{sub_latex}")
        elif tag == _m("sSubSup"):
            base = _child(child, "e")
            sub = _child(child, "sub")
            sup = _child(child, "sup")
            base_latex = _convert(base)
            sub_latex = _convert(sub)
            sup_latex = _convert(sup)
            if len(base_latex) > 1 or (base_latex and not base_latex.isalnum()):
                base_latex = f"{{{base_latex}}}"
            if len(sub_latex) > 1 or (sub_latex and not sub_latex.isalnum()):
                sub_latex = f"{{{sub_latex}}}"
            if len(sup_latex) > 1 or (sup_latex and not sup_latex.isalnum()):
                sup_latex = f"{{{sup_latex}}}"
            parts.append(f"{base_latex}_{sub_latex}^{sup_latex}")
        elif tag == _m("f"):
            num, den = _child(child, "num"), _child(child, "den")
            parts.append(f"\\frac{{{_convert(num)}}}{{{_convert(den)}}}")
        elif tag == _m("rad"):
            deg, e = _child(child, "deg"), _child(child, "e")
            if deg is not None and _convert(deg):
                parts.append(f"\\sqrt[{_convert(deg)}]{{{_convert(e)}}}")
            else:
                parts.append(f"\\sqrt{{{_convert(e)}}}")
        elif tag == _m("d"):
            parts.append(_delimiter(child))
        elif tag == _m("nary"):
            parts.append(_nary(child))
        elif tag == _m("func"):
            parts.append(_func(child))
        elif tag == _m("acc"):
            parts.append(_acc(child))
        elif tag == _m("bar"):
            parts.append(_bar(child))
        elif tag == _m("limLow"):
            parts.append(_limit(child, above=False))
        elif tag == _m("limUpp"):
            parts.append(_limit(child, above=True))
        elif tag == _m("groupChr"):
            parts.append(_group_chr(child))
        elif tag == _m("eqArr"):
            parts.append(_eq_arr(child))
        else:
            parts.append((child.text or "") + _convert_children(child))
    return "".join(parts)


def _nary(node: ET.Element) -> str:
    """m:nary -> \\sum / \\int / \\prod with limits."""
    pr = node.find(_m("naryPr"))
    chr_val = ""
    sub_hide = False
    sup_hide = False
    if pr is not None:
        chr_el = pr.find(_m("chr"))
        if chr_el is not None:
            chr_val = chr_el.get(f"{{{OMML_NS}}}val") or ""
        sub_hide = _bool_val(pr.find(_m("subHide")))
        sup_hide = _bool_val(pr.find(_m("supHide")))
    op = NARY_OPERATORS.get(chr_val, chr_val or "\\int")
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


def _acc(node: ET.Element) -> str:
    """m:acc -> accent command over the base, e.g. ``\\hat{x}``."""
    e = _child(node, "e")
    base = _convert(e)
    pr = node.find(_m("accPr"))
    chr_val = "\u0302"
    if pr is not None:
        chr_el = pr.find(_m("chr"))
        if chr_el is not None:
            chr_val = chr_el.get(f"{{{OMML_NS}}}val") or "\u0302"
    accent = ACCENTS.get(chr_val, chr_val)
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
            pos = (pos_el.get(f"{{{OMML_NS}}}val") or "bot").lower()
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
            chr_val = chr_el.get(f"{{{OMML_NS}}}val") or "\u23df"
    if chr_val in ("\u23de", "\u23e0"):
        return f"\\overbrace{{{base}}}"
    if chr_val in ("\u23df", "\u23e1"):
        return f"\\underbrace{{{base}}}"
    return base


def _eq_arr(node: ET.Element) -> str:
    """m:eqArr -> rows joined with ``\\\\``."""
    rows = [_convert(e) for e in node.findall(_m("e"))]
    return " \\\\ ".join(rows)


def _delimiter(node: ET.Element) -> str:
    """m:d -> ``\\left...\\right`` with the declared begin/end characters."""
    pr = node.find(_m("dPr"))
    beg = "("
    end = ")"
    if pr is not None:
        beg_el = pr.find(_m("begChr"))
        if beg_el is not None:
            beg = beg_el.get(f"{{{OMML_NS}}}val") or "("
        end_el = pr.find(_m("endChr"))
        if end_el is not None:
            end = end_el.get(f"{{{OMML_NS}}}val") or ")"
    inner = _convert_children(node)
    return f"\\left{DELIM_ESCAPES.get(beg, beg)}{inner}\\right{DELIM_ESCAPES.get(end, end)}"


def _func(node: ET.Element) -> str:
    """m:func -> function name applied to its argument."""
    fname = node.find(_m("fName"))
    e = _child(node, "e")
    name = _convert(fname)
    arg = _convert(e)
    return f"{name}\\left({arg}\\right)"
