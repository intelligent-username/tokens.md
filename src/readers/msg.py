"""Outlook .msg reader backed by extract_msg.

Emits the subject as a heading, then the sender/recipients/date metadata and
the plain-text body.
"""

from __future__ import annotations

from pathlib import Path

from ..deps import require
from ..engine.model import Document, Heading, Paragraph
from .base import Reader


class MsgReader(Reader):
    """Read .msg files into a :class:`Document`."""

    extensions = frozenset({".msg"})
    name = "msg"

    def read(self, input_path: Path) -> Document:
        extract_msg = require("extract_msg", "MSG conversion")
        try:
            message = extract_msg.Message(str(input_path))
            try:
                result = Document()
                subject = (message.subject or "").strip()
                if subject:
                    result.add(Heading(text=subject, level=1))
                sender = (message.sender or "").strip()
                if sender:
                    result.add(Paragraph(f"**From:** {sender}"))
                to = (message.to or "").strip()
                if to:
                    result.add(Paragraph(f"**To:** {to}"))
                date = (message.date or "").strip()
                if date:
                    result.add(Paragraph(f"**Date:** {date}"))
                body = (message.body or "").strip()
                if body:
                    for line in body.splitlines():
                        line = line.strip()
                        if line:
                            result.add(Paragraph(line))
                return result
            finally:
                message.close()
        except Exception:
            result = Document()
            for line in input_path.read_text(encoding="utf-8", errors="replace").splitlines():
                if line.strip():
                    result.add(Paragraph(line.strip()))
            return result
