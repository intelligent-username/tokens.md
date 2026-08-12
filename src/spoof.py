"""Standalone Spoofer class engine for tokens.md fetching."""

from __future__ import annotations

from collections.abc import Callable

try:
    import urllib3

    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
except Exception:
    pass

from .spoof_support.constants import DEFAULT_TIMEOUT_SEC
from .spoof_support.decompress import decompress_body
from .spoof_support.fetchers import fetch_via_curl_cffi, fetch_via_requests, fetch_via_urllib
from .spoof_support.headers import get_headers, spoof_android, spoof_ios, spoof_linux, spoof_macos, spoof_selector, spoof_windows


class Spoofer:
    """Device-specific request metadata and TLS fingerprint spoofing engine."""

    @staticmethod
    def spoof_ios(user_agent: str | None = None) -> dict[str, str]:
        return spoof_ios(user_agent)

    @staticmethod
    def spoof_android(user_agent: str | None = None) -> dict[str, str]:
        return spoof_android(user_agent)

    @staticmethod
    def spoof_macos(user_agent: str | None = None) -> dict[str, str]:
        return spoof_macos(user_agent)

    @staticmethod
    def spoof_linux(user_agent: str | None = None) -> dict[str, str]:
        return spoof_linux(user_agent)

    @staticmethod
    def spoof_windows(user_agent: str | None = None) -> dict[str, str]:
        return spoof_windows(user_agent)

    @staticmethod
    def spoof_selector(user_agent: str | None = None) -> Callable[[str | None], dict[str, str]]:
        return spoof_selector(user_agent)

    @staticmethod
    def get_headers(user_agent: str | None = None) -> dict[str, str]:
        return get_headers(user_agent)

    @staticmethod
    def decompress_body(data: bytes, content_encoding: str = "") -> str:
        return decompress_body(data, content_encoding)

    @staticmethod
    def fetch_via_curl_cffi(target_url: str, headers: dict[str, str], timeout_sec: float) -> str | None:
        return fetch_via_curl_cffi(target_url, headers, timeout_sec)

    @staticmethod
    def fetch_via_requests(target_url: str, headers: dict[str, str], timeout_sec: float) -> str | None:
        return fetch_via_requests(target_url, headers, timeout_sec)

    @staticmethod
    def fetch_via_urllib(target_url: str, headers: dict[str, str], timeout_sec: float) -> str | None:
        return fetch_via_urllib(target_url, headers, timeout_sec)

    @staticmethod
    def fetch(target_url: str, timeout_sec: float = DEFAULT_TIMEOUT_SEC, user_agent: str | None = None) -> str | None:
        headers = get_headers(user_agent)
        res = fetch_via_curl_cffi(target_url, headers, timeout_sec)
        if res:
            return res
        res = fetch_via_requests(target_url, headers, timeout_sec)
        if res:
            return res
        return fetch_via_urllib(target_url, headers, timeout_sec)
