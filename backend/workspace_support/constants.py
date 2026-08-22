"""Constants for backend session workspace management."""

from __future__ import annotations

import re
from re import Pattern

SAFE_NAME_RE: Pattern[str] = re.compile(r"[^A-Za-z0-9._ -]+")
SAFE_SESSION_ID_RE: Pattern[str] = re.compile(r"[A-Za-z0-9_-]{1,64}")
MAX_NAME_LENGTH = 120
ID_HEX_LENGTH = 12

JANITOR_CHECK_INTERVAL_SEC = 3600
SECONDS_PER_HOUR = 3600
WORKSPACE_DIR_PREFIX = "tmd-ui-"
