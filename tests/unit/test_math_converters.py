"""Unit tests for MathML and OMML math converters."""

from __future__ import annotations

from src.math_converters.mathml import mathml_to_latex
from src.math_converters.omml import omml_to_latex


def test_mathml_basic_nodes() -> None:
    # mrow, mi, mn, mo
    xml = "<mrow><mi>x</mi><mo>+</mo><mn>2</mn></mrow>"
    assert mathml_to_latex(xml) == "x+2"


def test_mathml_fractions() -> None:
    xml = "<mfrac><mn>1</mn><mi>x</mi></mfrac>"
    assert mathml_to_latex(xml) == r"\frac{1}{x}"


def test_mathml_sub_sup_msubsup() -> None:
    sup = "<msup><mi>x</mi><mn>2</mn></msup>"
    assert mathml_to_latex(sup) == "{x}^{2}"

    sub = "<msub><mi>a</mi><mi>i</mi></msub>"
    assert mathml_to_latex(sub) == "{a}_{i}"

    subsup = "<msubsup><mi>x</mi><mn>0</mn><mn>2</mn></msubsup>"
    assert mathml_to_latex(subsup) == "{x}_{0}^{2}"


def test_mathml_roots() -> None:
    sqrt = "<msqrt><mi>x</mi></msqrt>"
    assert mathml_to_latex(sqrt) == r"\sqrt{x}"

    mroot = "<mroot><mi>x</mi><mn>3</mn></mroot>"
    assert mathml_to_latex(mroot) == r"\sqrt[3]{x}"


def test_mathml_matrix() -> None:
    xml = "<mtable><mtr><mtd><mn>1</mn></mtd><mtd><mn>2</mn></mtd></mtr><mtr><mtd><mn>3</mn></mtd><mtd><mn>4</mn></mtd></mtr></mtable>"
    latex = mathml_to_latex(xml)
    assert r"\begin{matrix}" in latex
    assert r"1 & 2 \\" in latex
    assert r"\end{matrix}" in latex


def test_mathml_invalid_fallback() -> None:
    bad_xml = "<invalid>unclosed"
    assert "```mathml" in mathml_to_latex(bad_xml)


# ==============================================================================
# OMML Tests
# ==============================================================================

def test_omml_basic_run() -> None:
    omml = """
    <m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">
      <m:r><m:t>x + y</m:t></m:r>
    </m:oMath>
    """
    assert omml_to_latex(omml) == "x + y"


def test_omml_fraction() -> None:
    omml = """
    <m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">
      <m:f>
        <m:num><m:r><m:t>a</m:t></m:r></m:num>
        <m:den><m:r><m:t>b</m:t></m:r></m:den>
      </m:f>
    </m:oMath>
    """
    assert omml_to_latex(omml) == r"\frac{a}{b}"


def test_omml_sub_sup() -> None:
    omml_sup = """
    <m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">
      <m:sSup>
        <m:e><m:r><m:t>x</m:t></m:r></m:e>
        <m:sup><m:r><m:t>2</m:t></m:r></m:sup>
      </m:sSup>
    </m:oMath>
    """
    assert omml_to_latex(omml_sup) == "x^2"

    omml_sub = """
    <m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">
      <m:sSub>
        <m:e><m:r><m:t>a</m:t></m:r></m:e>
        <m:sub><m:r><m:t>i</m:t></m:r></m:sub>
      </m:sSub>
    </m:oMath>
    """
    assert omml_to_latex(omml_sub) == "a_i"


def test_omml_radicals() -> None:
    omml_sqrt = """
    <m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">
      <m:rad>
        <m:deg/>
        <m:e><m:r><m:t>x</m:t></m:r></m:e>
      </m:rad>
    </m:oMath>
    """
    assert omml_to_latex(omml_sqrt) == r"\sqrt{x}"

    omml_nroot = """
    <m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">
      <m:rad>
        <m:deg><m:r><m:t>3</m:t></m:r></m:deg>
        <m:e><m:r><m:t>x</m:t></m:r></m:e>
      </m:rad>
    </m:oMath>
    """
    assert omml_to_latex(omml_nroot) == r"\sqrt[3]{x}"


def test_omml_delimiters() -> None:
    omml_delim = """
    <m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">
      <m:d>
        <m:dPr>
          <m:begChr m:val="("/>
          <m:endChr m:val=")"/>
        </m:dPr>
        <m:e><m:r><m:t>x + 1</m:t></m:r></m:e>
      </m:d>
    </m:oMath>
    """
    assert omml_to_latex(omml_delim) == r"\left(x + 1\right)"


def test_omml_matrix() -> None:
    omml_matrix = """
    <m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">
      <m:m>
        <m:mr>
          <m:e><m:r><m:t>1</m:t></m:r></m:e>
          <m:e><m:r><m:t>2</m:t></m:r></m:e>
        </m:mr>
        <m:mr>
          <m:e><m:r><m:t>3</m:t></m:r></m:e>
          <m:e><m:r><m:t>4</m:t></m:r></m:e>
        </m:mr>
      </m:m>
    </m:oMath>
    """
    latex = omml_to_latex(omml_matrix)
    assert r"\begin{matrix}" in latex
    assert r"1 & 2 \\" in latex
    assert r"\end{matrix}" in latex


def test_omml_eq_arr() -> None:
    omml_eqarr = """
    <m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">
      <m:eqArr>
        <m:e><m:r><m:t>x + 1</m:t></m:r></m:e>
        <m:e><m:r><m:t>y = 2</m:t></m:r></m:e>
      </m:eqArr>
    </m:oMath>
    """
    assert omml_to_latex(omml_eqarr) == r"x + 1 \\ y = 2"


def test_omml_accents() -> None:
    omml_acc = """
    <m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">
      <m:acc>
        <m:accPr><m:chr m:val="̂"/></m:accPr>
        <m:e><m:r><m:t>x</m:t></m:r></m:e>
      </m:acc>
    </m:oMath>
    """
    assert omml_to_latex(omml_acc) == r"\hat{x}"
