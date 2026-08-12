"""HTTP fetch strategies for curl_cffi, requests, and urllib."""

from __future__ import annotations

import logging
import ssl
import time
import urllib.request
from urllib.parse import urlparse

from .constants import CHROME_CIPHERS, MAX_REDIRECT_HOPS
from .decompress import decompress_body

logger = logging.getLogger("backend")


def fetch_via_curl_cffi(target_url: str, headers: dict[str, str], timeout_sec: float) -> str | None:
    """Fetch using curl_cffi with 100% TLS/JA3 impersonation."""
    try:
        from curl_cffi import requests as curl_requests
        resp = curl_requests.get(
            target_url,
            headers=headers,
            impersonate="chrome120",
            timeout=int(timeout_sec),
            allow_redirects=True,
        )
        if resp.status_code == 200:
            body = decompress_body(resp.content, resp.headers.get("Content-Encoding", ""))
            if body.strip():
                return body
    except Exception:
        pass
    return None


def fetch_via_requests(target_url: str, headers: dict[str, str], timeout_sec: float) -> str | None:
    """Fetch using requests with manual redirect following to preserve spoofed headers."""
    try:
        import requests as req_lib
        session = req_lib.Session()
        session.headers.update(headers)
        session.verify = False

        url = target_url
        for _ in range(MAX_REDIRECT_HOPS):
            t_hop = time.monotonic()
            resp = session.get(
                url,
                allow_redirects=False,
                timeout=(2.0, timeout_sec),
            )
            elapsed = time.monotonic() - t_hop
            if resp.status_code in (301, 302, 303, 307, 308):
                location = resp.headers.get("Location", "")
                if not location:
                    return None
                if location.startswith("/"):
                    parsed = urlparse(url)
                    location = f"{parsed.scheme}://{parsed.netloc}{location}"
                logger.info(f"[REDIRECT {resp.status_code}] '{url}' -> '{location}' in {elapsed:.2f}s")
                url = location
                continue
            if resp.status_code == 200:
                body = decompress_body(
                    resp.content,
                    resp.headers.get("Content-Encoding", ""),
                )
                if body.strip():
                    logger.info(f"[HTTP 200 OK] '{url}' ({len(resp.content)} bytes) in {elapsed:.2f}s")
                    return body
            return None
    except Exception:
        pass
    return None


def fetch_via_urllib(target_url: str, headers: dict[str, str], timeout_sec: float) -> str | None:
    """Fetch using stdlib urllib with custom SSL ciphers and redirect header preservation."""
    try:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        try:
            ctx.set_ciphers(CHROME_CIPHERS)
        except Exception:
            pass

        class SpoofedRedirectHandler(urllib.request.HTTPRedirectHandler):
            max_redirections = MAX_REDIRECT_HOPS

            def redirect_request(self, req, fp, code, msg, req_headers, newurl):
                new_req = super().redirect_request(req, fp, code, msg, req_headers, newurl)
                if new_req:
                    for k, v in headers.items():
                        new_req.add_header(k, v)
                return new_req

        opener = urllib.request.build_opener(
            SpoofedRedirectHandler(),
            urllib.request.HTTPSHandler(context=ctx),
        )
        req = urllib.request.Request(target_url, headers=headers)
        with opener.open(req, timeout=timeout_sec) as resp:
            data = resp.read()
            body = decompress_body(data, resp.headers.get("Content-Encoding", ""))
            if body.strip():
                return body
    except Exception:
        pass
    return None
