"""Intermediate representation document model."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, List, Optional


@dataclass
class Heading:
    text: str
    level: int = 1


@dataclass
class Paragraph:
    text: str


@dataclass
class CodeBlock:
    text: str
    language: Optional[str] = None


@dataclass
class Quote:
    text: str


@dataclass
class Table:
    rows: List[List[str]] = field(default_factory=list)
    header: Optional[List[str]] = None


@dataclass
class ListItem:
    text: str
    level: int = 0
    ordered: bool = False


@dataclass
class Image:
    alt: str
    path: str


@dataclass
class HorizontalRule:
    pass


@dataclass
class RawMarkdown:
    text: str


@dataclass
class Document:
    title: Optional[str] = None
    blocks: List[Any] = field(default_factory=list)

    def add(self, block: Any) -> None:
        """Add any block element to the document."""
        self.blocks.append(block)

    def add_heading(self, text: str, level: int = 1) -> None:
        self.blocks.append(Heading(text, level))

    def add_paragraph(self, text: str) -> None:
        if text.strip():
            self.blocks.append(Paragraph(text))

    def add_code_block(self, text: str, language: Optional[str] = None) -> None:
        self.blocks.append(CodeBlock(text, language))

    def add_quote(self, text: str) -> None:
        self.blocks.append(Quote(text))

    def add_table(self, rows: List[List[str]], header: Optional[List[str]] = None) -> None:
        self.blocks.append(Table(rows=rows, header=header))

    def add_list_item(self, text: str, level: int = 0, ordered: bool = False) -> None:
        self.blocks.append(ListItem(text, level, ordered))

    def add_image(self, alt: str, path: str) -> None:
        self.blocks.append(Image(alt, path))

    def add_hr(self) -> None:
        self.blocks.append(HorizontalRule())

    def add_raw_markdown(self, text: str) -> None:
        self.blocks.append(RawMarkdown(text))
