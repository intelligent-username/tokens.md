"""Best-effort converter for structured / plain-text data files."""

from __future__ import annotations

import csv
import json
import xml.dom.minidom
import xml.parsers.expat
from pathlib import Path

from ..registry import Converter, UnsupportedFormatError

STRUCTURED_EXTENSIONS = frozenset(
    {".json", ".xml", ".csv", ".yaml", ".yml", ".toml", ".ini", ".log"}
)


def _as_json(path: Path) -> str:
    data = json.loads(path.read_text(encoding="utf-8"))
    return "```json\n" + json.dumps(data, indent=2, ensure_ascii=False) + "\n```"


def _as_xml(path: Path) -> str:
    try:
        dom = xml.dom.minidom.parseString(path.read_bytes())
        pretty = dom.toprettyxml()
    except Exception:
        pretty = path.read_text(encoding="utf-8", errors="replace")
    return "```xml\n" + pretty + "\n```"


def _as_csv(path: Path) -> str:
    with path.open(encoding="utf-8", newline="") as handle:
        rows = list(csv.reader(handle))
    if not rows:
        raise UnsupportedFormatError(f"No rows found in {path.name}")
    header = rows[0]
    lines = ["| " + " | ".join(header) + " |", "|" + "|".join("---" for _ in header) + "|"]
    for row in rows[1:]:
        lines.append("| " + " | ".join(row) + " |")
    return "\n".join(lines)


def _as_fenced(path: Path, lang: str) -> str:
    text = path.read_text(encoding="utf-8", errors="replace")
    return f"```{lang}\n{text}\n```"


class StructuredConverter(Converter):
    """Converts JSON / XML / CSV / YAML / TOML / INI / LOG to Markdown."""

    extensions = STRUCTURED_EXTENSIONS
    name = "structured"

    def convert(self, input_path: Path, output_dir: Path, **kwargs: object) -> Path:
        output_dir.mkdir(parents=True, exist_ok=True)
        suffix = input_path.suffix.lower()
        try:
            if suffix == ".json":
                content = _as_json(input_path)
            elif suffix == ".xml":
                content = _as_xml(input_path)
            elif suffix == ".csv":
                content = _as_csv(input_path)
            elif suffix == ".log":
                content = input_path.read_text(encoding="utf-8", errors="replace")
            elif suffix in {".yaml", ".yml"}:
                content = _as_fenced(input_path, "yaml")
            elif suffix == ".toml":
                content = _as_fenced(input_path, "toml")
            elif suffix == ".ini":
                content = _as_fenced(input_path, "ini")
            else:  # pragma: no cover - registry guarantees the extension
                raise UnsupportedFormatError(f"Unsupported structured format {suffix}")
        except (ValueError, json.JSONDecodeError, xml.parsers.expat.ExpatError) as exc:
            raise UnsupportedFormatError(
                f"Could not parse {input_path.name}: {exc}"
            ) from exc

        output_path = output_dir / f"{input_path.stem}.md"
        output_path.write_text(content, encoding="utf-8")
        return output_path