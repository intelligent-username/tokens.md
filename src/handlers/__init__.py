"""Built-in converter handlers.

Importing this package registers every built-in handler into
``src.registry.DEFAULT_REGISTRY``.
"""

from __future__ import annotations

from ..readers.adapter import ReaderConverter
from ..readers.docx import DocxReader
from ..readers.ebook import Azw3Reader, Azw4Reader
from ..readers.eml import EmlReader
from ..readers.ipynb import IpynbReader
from ..readers.markdown import MarkdownReader
from ..readers.msg import MsgReader
from ..readers.odf import OdfReader
from ..readers.pptx import PptxReader
from ..readers.rtf import RtfReader
from ..readers.subtitle import SubtitleReader
from ..readers.tex import TexReader
from ..readers.xlsx import XlsxReader
from ..registry import DEFAULT_REGISTRY
from .archive import ArchiveConverter
from .html import HtmlConverter
from .office import OfficeConverter
from .pymupdf import PymupdfConverter
from .repo import RepoConverter
from .structured import StructuredConverter
from .unsupported import UnsupportedConverter

__all__ = ["ArchiveConverter", "HtmlConverter", "OfficeConverter", "PymupdfConverter", "RepoConverter", "StructuredConverter", "UnsupportedConverter"]

DEFAULT_REGISTRY.register(ArchiveConverter())
DEFAULT_REGISTRY.register(PymupdfConverter())
DEFAULT_REGISTRY.register(HtmlConverter())
DEFAULT_REGISTRY.register(StructuredConverter())
DEFAULT_REGISTRY.register(RepoConverter())
DEFAULT_REGISTRY.register(UnsupportedConverter())

# Reader-backed converters registered for structured office, ebook, document, and text formats
DEFAULT_REGISTRY.register(ReaderConverter(DocxReader()))
DEFAULT_REGISTRY.register(ReaderConverter(PptxReader()))
DEFAULT_REGISTRY.register(ReaderConverter(XlsxReader()))
DEFAULT_REGISTRY.register(ReaderConverter(OdfReader()))
DEFAULT_REGISTRY.register(ReaderConverter(RtfReader()))
DEFAULT_REGISTRY.register(ReaderConverter(MsgReader()))
DEFAULT_REGISTRY.register(ReaderConverter(EmlReader()))
DEFAULT_REGISTRY.register(ReaderConverter(Azw3Reader()))
DEFAULT_REGISTRY.register(ReaderConverter(Azw4Reader()))
DEFAULT_REGISTRY.register(ReaderConverter(SubtitleReader()))
DEFAULT_REGISTRY.register(ReaderConverter(TexReader()))
DEFAULT_REGISTRY.register(ReaderConverter(IpynbReader()))
DEFAULT_REGISTRY.register(ReaderConverter(MarkdownReader()))
