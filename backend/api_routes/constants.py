"""Constants for backend API routes."""

from __future__ import annotations

# HTTP Status Codes
HTTP_BAD_REQUEST = 400
HTTP_FORBIDDEN = 403
HTTP_NOT_FOUND = 404
HTTP_PAYLOAD_TOO_LARGE = 413
HTTP_UNPROCESSABLE_ENTITY = 422

# Error Code Identifiers
ERR_LOCAL_PATHS_DISABLED = "local_paths_disabled"
ERR_LOCAL_PATHS_DISALLOWED = "local_paths_disallowed"
ERR_TOO_LARGE = "too_large"
ERR_BAD_REQUEST = "bad_request"
ERR_UNSUPPORTED_FORMAT = "unsupported_format"
ERR_NOT_FOUND = "not_found"

# Buffer & Chunk Sizes
COPY_BUFFER_SIZE = 1024 * 1024
BYTES_PER_MB = 1024 * 1024
