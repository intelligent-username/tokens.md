"""OMML (Office Math Markup Language) -> LaTeX engine (re-exported from src.math_converters)."""

from __future__ import annotations

from xml.etree import ElementTree as ET
from .omml_support.converters import _convert_children


def omath_element_to_latex(element: ET.Element) -> str:
    """Convert an m:oMath / m:oMathPara element to a LaTeX string."""
    return _convert_children(element)


__all__ = ["omath_element_to_latex"]
