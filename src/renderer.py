"""Render a :class:`Document` into Markdown. Shared by every reader-backed converter."""

from __future__ import annotations

from .model import (
    CodeBlock,
    Document,
    Heading,
    HorizontalRule,
    Image,
    ListItem,
    Paragraph,
    Quote,
    Table,
)


class MarkdownRenderer:
    """Turns a :class:`Document` into a single Markdown string."""

    def render(self, document: Document) -> str:
        parts: list[str] = []
        if document.title:
            parts.append(f"# {document.title}")
            parts.append("")
        for block in document.blocks:
            rendered = self._render_block(block)
            if rendered:
                parts.append(rendered)
        return "\n\n".join(parts).strip() + "\n"

    def _render_block(self, block: object) -> str:
        if isinstance(block, Heading):
            return f"{'#' * block.level} {block.text}"
        if isinstance(block, Paragraph):
            return block.text
        if isinstance(block, Quote):
            return "\n".join(f"> {line}" for line in block.text.splitlines())
        if isinstance(block, CodeBlock):
            lang = block.language or ""
            return f"```{lang}\n{block.text}\n```"
        if isinstance(block, Table):
            return self._render_table(block)
        if isinstance(block, ListItem):
            marker = "1." if block.ordered else "-"
            indent = "  " * block.level
            return f"{indent}{marker} {block.text}"
        if isinstance(block, Image):
            return f"![{block.alt}]({block.path})"
        if isinstance(block, HorizontalRule):
            return "---"
        return str(block)  # RawMarkdown and any future block types

    @staticmethod
    def _render_table(table: Table) -> str:
        if not table.header and not table.rows:
            return ""
        header = table.header or ([""] * len(table.rows[0]) if table.rows else [])
        lines = ["| " + " | ".join(header) + " |"]
        lines.append("|" + "|".join("---" for _ in header) + "|")
        for row in table.rows:
            lines.append("| " + " | ".join(row) + " |")
        return "\n".join(lines)