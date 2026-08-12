"""Constants for CLI rendering and options."""

from __future__ import annotations

# CLI Help Table Column Widths
CMD_COL_WIDTH = 28
TRUNCATE_DESC_LENGTH = 44

# Socket & Port Defaults
DEFAULT_UI_HOST = "127.0.0.1"
DEFAULT_UI_PORT = 8642
PORT_SEARCH_RANGE = 21

# Default Directories
DEFAULT_SOURCE_DIR = "input"
DEFAULT_OUTPUT_DIR = "output"
DEFAULT_MERGED_FILENAME = "merged.md"
DEFAULT_WATCH_SOURCE = "inbox"

# Watch Defaults
DEFAULT_POLL_INTERVAL = 2.0

# Exit Codes
EXIT_CODE_SUCCESS = 0
EXIT_CODE_ERROR = 1

# Progress Bar Column Style
PROGRESS_BAR_STYLE = "grey23"
PROGRESS_BAR_COMPLETE_STYLE = "bright_green"
