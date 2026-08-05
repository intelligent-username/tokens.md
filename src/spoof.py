"""Standalone Spoofer class engine for tokens.md fetching."""

from __future__ import annotations

import gzip
import ssl
import urllib.request
import zlib
from typing import Callable

import warnings

try:
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
except Exception:
    pass

CHROME_CIPHERS = (
    "ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:"
    "ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:"
    "ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:"
    "ECDHE-RSA-AES128-SHA:ECDHE-RSA-AES256-SHA:AES128-GCM-SHA256:"
    "AES256-GCM-SHA384:AES128-SHA:AES256-SHA"
)


class Spoofer:
    """Device-specific request metadata and TLS fingerprint spoofing engine."""

    @staticmethod
    def spoof_ios(user_agent: str | None = None) -> dict[str, str]:
        """Spoof headers for iOS devices (iPhone / iPad / iPod)."""
        return {
            "User-Agent": (
                user_agent
                if user_agent and ("iphone" in user_agent.lower() or "ipad" in user_agent.lower())
                else "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3.1 Mobile/15E148 Safari/604.1"
            ),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Upgrade-Insecure-Requests": "1",
        }

    @staticmethod
    def spoof_android(user_agent: str | None = None) -> dict[str, str]:
        """Spoof headers for Android mobile devices."""
        return {
            "User-Agent": (
                user_agent
                if user_agent and "chrome" in user_agent.lower()
                else "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/UD1A.230803.041) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.119 Mobile Safari/537.36"
            ),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate",
            "Sec-Ch-Ua": '"Chromium";v="122", "Android WebView";v="122", "Not:A-Brand";v="24"',
            "Sec-Ch-Ua-Mobile": "?1",
            "Sec-Ch-Ua-Platform": '"Android"',
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Sec-Fetch-User": "?1",
            "Upgrade-Insecure-Requests": "1",
        }

    @staticmethod
    def spoof_macos(user_agent: str | None = None) -> dict[str, str]:
        """Spoof headers for macOS devices."""
        return {
            "User-Agent": (
                user_agent
                if user_agent and "mac" in user_agent.lower()
                else "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
            ),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate",
            "Sec-Ch-Ua": '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"macOS"',
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Sec-Fetch-User": "?1",
            "Upgrade-Insecure-Requests": "1",
        }

    @staticmethod
    def spoof_linux(user_agent: str | None = None) -> dict[str, str]:
        """Spoof headers for Linux / Ubuntu devices."""
        return {
            "User-Agent": (
                user_agent
                if user_agent and "linux" in user_agent.lower()
                else "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
            ),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate",
            "Sec-Ch-Ua": '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Linux"',
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Sec-Fetch-User": "?1",
            "Upgrade-Insecure-Requests": "1",
        }

    @staticmethod
    def spoof_windows(user_agent: str | None = None) -> dict[str, str]:
        """Spoof headers for Windows devices."""
        return {
            "User-Agent": (
                user_agent
                if user_agent and len(user_agent) > 10
                else "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
            ),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate",
            "Cache-Control": "max-age=0",
            "Sec-Ch-Ua": '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Windows"',
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Sec-Fetch-User": "?1",
            "Upgrade-Insecure-Requests": "1",
        }

    @staticmethod
    def spoof_selector(user_agent: str | None = None) -> Callable[[str | None], dict[str, str]]:
        """Inspect user_agent string and select appropriate device-specific sub-spoof function."""
        ua = (user_agent or "").lower()

        if "iphone" in ua or "ipad" in ua or "ipod" in ua or "cpu os" in ua:
            return Spoofer.spoof_ios
        if "android" in ua:
            return Spoofer.spoof_android
        if "macintosh" in ua or "mac os" in ua or "macintel" in ua:
            return Spoofer.spoof_macos
        if "linux" in ua or "x11" in ua or "ubuntu" in ua:
            return Spoofer.spoof_linux

        return Spoofer.spoof_windows

    @staticmethod
    def get_headers(user_agent: str | None = None) -> dict[str, str]:
        """Route to appropriate device sub-spoof method via spoof_selector."""
        target_spoofer = Spoofer.spoof_selector(user_agent)
        return target_spoofer(user_agent)

    @staticmethod
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

    @staticmethod
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
                body = Spoofer.decompress_body(resp.content, resp.headers.get("Content-Encoding", ""))
                if body.strip():
                    return body
        except Exception:
            pass
        return None

    @staticmethod
    def fetch_via_requests(target_url: str, headers: dict[str, str], timeout_sec: float) -> str | None:
        """Fetch using requests with manual redirect following to preserve spoofed headers."""
        import logging
        import time
        logger = logging.getLogger("backend")
        try:
            import requests as req_lib
            session = req_lib.Session()
            session.headers.update(headers)
            session.verify = False

            url = target_url
            for _ in range(10):  # max 10 redirect hops
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
                        from urllib.parse import urlparse
                        parsed = urlparse(url)
                        location = f"{parsed.scheme}://{parsed.netloc}{location}"
                    logger.info(f"[REDIRECT {resp.status_code}] '{url}' -> '{location}' in {elapsed:.2f}s")
                    url = location
                    continue
                if resp.status_code == 200:
                    body = Spoofer.decompress_body(
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

    @staticmethod
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
                max_redirections = 10

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
                body = Spoofer.decompress_body(data, resp.headers.get("Content-Encoding", ""))
                if body.strip():
                    return body
        except Exception:
            pass
        return None

    @staticmethod
    def fetch(target_url: str, timeout_sec: float = 3.5, user_agent: str | None = None) -> str | None:
        """Fetch raw HTML for target_url using device-matched spoofed headers."""
        headers = Spoofer.get_headers(user_agent)

        res = Spoofer.fetch_via_curl_cffi(target_url, headers, timeout_sec)
        if res:
            return res

        res = Spoofer.fetch_via_requests(target_url, headers, timeout_sec)
        if res:
            return res

        return Spoofer.fetch_via_urllib(target_url, headers, timeout_sec)
