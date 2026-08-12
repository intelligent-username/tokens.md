"""Per-format readers. Each class turns one file format into a :class:`Document`."""

from .adapter import ReaderConverter
from .base import Reader
from .docx import DocxReader
from .ebook import Azw3Reader, Azw4Reader
from .eml import EmlReader
from .ipynb import IpynbReader
from .markdown import MarkdownReader
from .msg import MsgReader
from .odf import OdfReader
from .pptx import PptxReader
from .rtf import RtfReader
from .subtitle import SubtitleReader
from .tex import TexReader
from .xlsx import XlsxReader

__all__ = ["Reader", "ReaderConverter", "DocxReader", "PptxReader", "XlsxReader", "OdfReader", "RtfReader", "MsgReader", "EmlReader", "Azw3Reader", "Azw4Reader", "SubtitleReader", "TexReader", "IpynbReader", "MarkdownReader"]
