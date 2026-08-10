"""MathML -> LaTeX for ODF formulas. Self-contained, stdlib-only, best-effort."""

from __future__ import annotations

from xml.etree import ElementTree as ET


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]  # strip the MathML namespace


def _node_to_latex(el: ET.Element) -> str:
    name = _local(el.tag)
    if name in ("mi", "mn", "mo", "mtext", "ms"):
        return (el.text or "").strip()
    if name == "mrow":
        return "".join(_node_to_latex(c) for c in el)
    if name == "mfrac":
        num, den = list(el)
        return r"\frac{%s}{%s}" % (_node_to_latex(num), _node_to_latex(den))
    if name == "msup":
        base, sup = list(el)
        return "{%s}^{%s}" % (_node_to_latex(base), _node_to_latex(sup))
    if name == "msub":
        base, sub = list(el)
        return "{%s}_{%s}" % (_node_to_latex(base), _node_to_latex(sub))
    if name == "msubsup":
        base, sub, sup = list(el)
        return "{%s}_{%s}^{%s}" % tuple(_node_to_latex(x) for x in (base, sub, sup))
    if name == "msqrt":
        return r"\sqrt{%s}" % "".join(_node_to_latex(c) for c in el)
    if name == "mroot":
        base, index = list(el)
        return r"\sqrt[%s]{%s}" % (_node_to_latex(index), _node_to_latex(base))
    if name == "mspace":
        return " "
    if name in (
        "mstyle",
        "mover",
        "munder",
        "munderover",
        "semantics",
        "annotation",
        "annotation-xml",
    ):
        return "".join(_node_to_latex(c) for c in el)
    if name == "mtable":
        rows = [
            " & ".join(_node_to_latex(mtd) for mtd in mtr) + r" \\" for mtr in el
        ]
        return r"\begin{matrix}" + "\n" + "\n".join(rows) + "\n" + r"\end{matrix}"
    # Unknown node: keep children + text, never raise, never drop.
    return "".join(_node_to_latex(c) for c in el) + (el.text or "")


def mathml_to_latex(mathml: str) -> str:
    """Convert a MathML fragment to LaTeX, or return a fenced raw fallback."""
    try:
        latex = _node_to_latex(ET.fromstring(mathml)).strip()
        if latex:
            return latex
    except Exception:
        pass
    # Fallback: never lose the equation.
    return f"```mathml\n{mathml}\n```"