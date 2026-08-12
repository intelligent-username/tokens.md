"""Device-specific HTTP request header generators."""

from __future__ import annotations

from typing import Callable

from .constants import (
    UA_ANDROID_DEFAULT,
    UA_IOS_DEFAULT,
    UA_LINUX_DEFAULT,
    UA_MACOS_DEFAULT,
    UA_WINDOWS_DEFAULT,
)


def spoof_ios(user_agent: str | None = None) -> dict[str, str]:
    """Spoof headers for iOS devices (iPhone / iPad / iPod)."""
    return {
        "User-Agent": (
            user_agent
            if user_agent and ("iphone" in user_agent.lower() or "ipad" in user_agent.lower())
            else UA_IOS_DEFAULT
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Upgrade-Insecure-Requests": "1",
    }


def spoof_android(user_agent: str | None = None) -> dict[str, str]:
    """Spoof headers for Android mobile devices."""
    return {
        "User-Agent": (
            user_agent
            if user_agent and "chrome" in user_agent.lower()
            else UA_ANDROID_DEFAULT
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


def spoof_macos(user_agent: str | None = None) -> dict[str, str]:
    """Spoof headers for macOS devices."""
    return {
        "User-Agent": (
            user_agent
            if user_agent and "mac" in user_agent.lower()
            else UA_MACOS_DEFAULT
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


def spoof_linux(user_agent: str | None = None) -> dict[str, str]:
    """Spoof headers for Linux / Ubuntu devices."""
    return {
        "User-Agent": (
            user_agent
            if user_agent and "linux" in user_agent.lower()
            else UA_LINUX_DEFAULT
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


def spoof_windows(user_agent: str | None = None) -> dict[str, str]:
    """Spoof headers for Windows devices."""
    return {
        "User-Agent": (
            user_agent
            if user_agent and len(user_agent) > 10
            else UA_WINDOWS_DEFAULT
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


def spoof_selector(user_agent: str | None = None) -> Callable[[str | None], dict[str, str]]:
    """Inspect user_agent string and select appropriate device-specific sub-spoof function."""
    ua = (user_agent or "").lower()

    if "iphone" in ua or "ipad" in ua or "ipod" in ua or "cpu os" in ua:
        return spoof_ios
    if "android" in ua:
        return spoof_android
    if "macintosh" in ua or "mac os" in ua or "macintel" in ua:
        return spoof_macos
    if "linux" in ua or "x11" in ua or "ubuntu" in ua:
        return spoof_linux

    return spoof_windows


def get_headers(user_agent: str | None = None) -> dict[str, str]:
    """Route to appropriate device sub-spoof method via spoof_selector."""
    target_spoofer = spoof_selector(user_agent)
    return target_spoofer(user_agent)
