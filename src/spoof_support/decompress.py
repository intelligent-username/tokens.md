"""Response decompression helper functions."""

from __future__ import annotations

import gzip
import zlib


def decompress_body(data: bytes, content_encoding: str = "") -> str:
    """Decompress raw response bytes via Gzip, Deflate, Brotli, or magic bytes check."""
    enc = (content_encoding or "").lower()

    if "gzip" in enc or data.startswith(b"\x1f\x8b"):
        try:
            data = gzip.decompress(data)
        except Exception:
            pass
    elif "deflate" in enc:
        try:
            data = zlib.decompress(data, -zlib.MAX_WBITS)
        except Exception:
            pass
    elif "br" in enc:
        try:
            import brotli
            data = brotli.decompress(data)
        except Exception:
            pass

    return data.decode("utf-8", errors="replace")
