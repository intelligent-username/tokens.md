"""Section splitting, density scoring, and TextRank NLP helpers."""

from __future__ import annotations

import re

from ..deps import require
from ..tokenizer import count_tokens
from .constants import BOILERPLATE_PATTERNS, HEADING_RE, STOPWORDS
from .models import _Section


def _is_boilerplate(line: str) -> bool:
    return any(pattern.match(line) for pattern in BOILERPLATE_PATTERNS)


def _split_sections(text: str) -> list[_Section]:
    """Split ``text`` into heading-delimited sections."""
    sections: list[_Section] = []
    for line in text.splitlines():
        if HEADING_RE.match(line):
            sections.append(_Section(heading=line, body=[]))
        elif sections:
            sections[-1].body.append(line)
        else:
            sections.append(_Section(heading="", body=[line]))
    return sections


def _rebuild(sections: list[_Section]) -> str:
    """Join sections back into a single markdown string."""
    parts: list[str] = []
    for s in sections:
        if s.heading:
            parts.append(s.heading)
        parts.extend(s.body)
    return "\n".join(parts)


def _density(section: _Section, encoding: str) -> float:
    """unique_nonstopword_terms / total_tokens for a section."""
    text = "\n".join([section.heading] + section.body)
    tokens = count_tokens(text, encoding)
    if tokens == 0:
        return 0.0
    terms = re.findall(r"[A-Za-z0-9]+", text.lower())
    unique = {t for t in terms if t not in STOPWORDS}
    return len(unique) / tokens


def _textrank_prune(text: str, keep_ratio: float) -> str:
    """Prune ``text`` to ~``keep_ratio`` of its sentences via TextRank."""
    try:
        require("sumy", "budget pruning")
        from sumy.nlp.stemmers import Stemmer
        from sumy.nlp.tokenizers import Tokenizer
        from sumy.parsers.plaintext import PlaintextParser
        from sumy.summarizers.text_rank import TextRankSummarizer
        from sumy.utils import get_stop_words

        language = "english"
        parser = PlaintextParser.from_string(text, Tokenizer(language))
        sentences = list(parser.document.sentences)
        if not sentences:
            return text
        keep_n = max(1, round(len(sentences) * keep_ratio))
        summarizer = TextRankSummarizer(Stemmer(language))
        summarizer.stop_words = get_stop_words(language)
        ranked = summarizer(parser.document, keep_n)
        ranked_texts = {str(s) for s in ranked}
        ordered = [str(s) for s in sentences if str(s) in ranked_texts]
        return " ".join(ordered)
    except (Exception, BaseException):
        lines = [line for line in text.splitlines() if line.strip()]
        if not lines:
            return text
        keep_n = max(1, round(len(lines) * keep_ratio))
        return "\n".join(lines[:keep_n])
