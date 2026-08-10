"""Format-agnostic intermediate document model.

Readers produce a :class:`Document`; the :class:`MarkdownRenderer` turns it into
Markdown. This separation is the heart of the SOLID design: readers never know
about Markdown syntax, and the renderer never knows about file formats.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Union


@dataclass
class Heading:
    """A structural heading. ``level`` is 1..6 (1 = top)."""

    text: str
    level: int = 1


@dataclass
class Paragraph:
    text: str


@dataclass
class Quote:
    text: str


@dataclass
class CodeBlock:
    text: str
    language: str = ""


@dataclass
class Table:
    """A rectangular table. ``header`` is the first row; ``rows`` are the rest."""

    header: list[str] = field(default_factory=list)
    rows: list[list[str]] = field(default_factory=list)


@dataclass
class ListItem:
    text: str
    ordered: bool = False
    level: int = 0


@dataclass
class Image:
    """A reference to an image. ``path`` may be a file path or URL."""

    path: str
    alt: str = ""


@dataclass
class HorizontalRule:
    pass


@dataclass
class RawMarkdown:
    """Escape hatch for content already in Markdown (e.g. HTML passthrough)."""

    text: str


#: Any single block in a document.
Block = Union[
    Heading,
    Paragraph,
    Quote,
    CodeBlock,
    Table,
    ListItem,
    Image,
    HorizontalRule,
    RawMarkdown,
]


@dataclass
class Document:
    """An ordered sequence of blocks plus optional metadata."""

    blocks: list[Block] = field(default_factory=list)
    title: str = ""
    metadata: dict[str, str] = field(default_factory=dict)

    def add(self, block: Block) -> None:
        self.blocks.append(block)