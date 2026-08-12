"""Tests for the clipboard wrapper."""

from __future__ import annotations

from unittest.mock import patch

import pytest

from src.clipboard import copy_to_clipboard


def test_copy_to_clipboard_calls_pyperclip() -> None:
    with patch("src.clipboard.pyperclip.copy") as mock_copy:
        copy_to_clipboard("hello")
    mock_copy.assert_called_once_with("hello")


def test_copy_to_clipboard_raises_on_failure() -> None:
    with patch("src.clipboard.pyperclip.copy", side_effect=Exception("no backend")):
        with pytest.raises(RuntimeError):
            copy_to_clipboard("hello")
