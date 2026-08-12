"""EML reader using the stdlib email package (no extra dependency)."""

from __future__ import annotations

import email
from email import policy
from pathlib import Path

from ..engine.model import Document, Heading, Paragraph
from .base import Reader


class EmlReader(Reader):
    extensions = frozenset({".eml"})
    name = "eml"

    def read(self, input_path: Path) -> Document:
        msg = email.message_from_bytes(
            input_path.read_bytes(), policy=policy.default
        )
        doc = Document()
        subject = str(msg.get("Subject", "") or "")
        doc.add(Heading(text=subject or "(no subject)", level=1))
        doc.add(Paragraph(f"**From:** {msg.get('From', '')}"))
        doc.add(Paragraph(f"**To:** {msg.get('To', '')}"))
        doc.add(Paragraph(f"**Date:** {msg.get('Date', '')}"))
        body = msg.get_body(preferencelist=("plain", "html"))
        text = body.get_content() if body else ""
        for line in (l.strip() for l in text.splitlines()):
            if line:
                doc.add(Paragraph(line))
        return doc