"""XML Namespace and Operator Mapping Tables for OMML to LaTeX Conversion."""

from __future__ import annotations

OMML_NS = "http://schemas.openxmlformats.org/officeDocument/2006/math"

NARY_OPERATORS: dict[str, str] = {
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

ACCENTS: dict[str, str] = {"\u0300": "\\grave", "\u0301": "\\acute", "\u0302": "\\hat", "\u0303": "\\tilde", "\u0304": "\\bar", "\u0305": "\\bar", "\u0306": "\\breve", "\u0307": "\\dot", "\u0308": "\\ddot", "\u030c": "\\check", "\u20d7": "\\vec"}

DELIM_ESCAPES: dict[str, str] = {"{": "\\{", "}": "\\}"}
