"""Thin, safe wrapper around pyperclip for copying text to the clipboard."""

from __future__ import annotations

from .deps import require


def copy_to_clipboard(text: str) -> None:
    """Copy ``text`` to the system clipboard.

    Raises ``RuntimeError`` if no clipboard backend is available on this
    platform. The ``pyperclip`` import is isolated here so the rest of the
    tool works even when the clipboard is unavailable.
    """
    pyperclip = require("pyperclip", "clipboard")

    try:
        pyperclip.copy(text)
    except pyperclip.PyperclipException as exc:
        raise RuntimeError(
            "Clipboard is not available on this platform. "
            "Install xclip/xsel (Linux) or use a supported desktop session."
        ) from exc