import logging
import re
import time
from pathlib import Path
from urllib.parse import urlparse

from .handlers.html import _strip_tags
from .registry import UnsupportedFormatError
from .spoof import Spoofer

logger = logging.getLogger("backend")


def _slugify(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return slug or "page"


def _extract_meta_markdown(html: str) -> str:
    """Extract title and meta description for minimal SPA HTML shells."""
    title_match = re.search(r"<title[^>]*>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
    desc_match = re.search(r'<meta[^>]*name=["\']description["\'][^>]*content=["\'](.*?)["\']', html, re.IGNORECASE) or \
                 re.search(r'<meta[^>]*property=["\']og:description["\'][^>]*content=["\'](.*?)["\']', html, re.IGNORECASE)

    parts: list[str] = []
    if title_match:
        t = re.sub(r"\s+", " ", title_match.group(1)).strip()
        if t:
            parts.append(f"## {t}")
    if desc_match:
        d = re.sub(r"\s+", " ", desc_match.group(1)).strip()
        if d:
            parts.append(d)

    return "\n\n".join(parts)


def fetch_url(url: str, output_dir: Path, **kwargs: object) -> Path:
    """Download ``url`` and write clean article Markdown into ``output_dir``.

    Automatically prepends https:// if missing, and tries https:// then http://
    with a strict timeout per attempt before reporting an unreachable link.
    """
    t_total = time.monotonic()
    raw_url = url.strip()
    if not raw_url:
        raise UnsupportedFormatError("Non-existent or unreachable link")

    output_dir.mkdir(parents=True, exist_ok=True)

    # Build candidate chain:
    # 1. https://{input}      (always first — most common)
    # 2. https://www.{input}   (some sites only respond on www subdomain)
    # 3. http://{input}        (fallback if HTTPS fails entirely)
    # 4. http://www.{input}    (last resort)
    # Each candidate follows 301/302 redirects internally.
    # Only advance to the next candidate on hard failure (timeout, DNS, connection error).
    candidates: list[str] = []
    if raw_url.startswith("http://") or raw_url.startswith("https://"):
        candidates.append(raw_url)
    else:
        bare = raw_url.lstrip("/")
        candidates.append(f"https://{bare}")
        if not bare.startswith("www."):
            candidates.append(f"https://www.{bare}")
        candidates.append(f"http://{bare}")
        if not bare.startswith("www."):
            candidates.append(f"http://www.{bare}")

    html_text = ""
    successful_url = ""
    user_agent = str(kwargs.get("user_agent")) if kwargs.get("user_agent") else None
    for target in candidates:
        try:
            fetched = Spoofer.fetch(target, timeout_sec=2, user_agent=user_agent)
            if fetched:
                html_text = fetched
                successful_url = target
                break
        except Exception:
            continue

    if not html_text:
        raise UnsupportedFormatError(f"Non-existent or unreachable link: {url}")

    markdown_content = ""
    # Pass HTML into trafilatura.extract with favor_recall=True so non-article web pages are extracted
    t_ext = time.monotonic()
    try:
        import trafilatura
        extracted = trafilatura.extract(
            html_text,
            output_format="markdown",
            include_links=True,
            include_images=True,
            include_tables=True,
            include_formatting=True,
            favor_recall=True,
        )
        if extracted and extracted.strip():
            markdown_content = extracted
    except Exception:
        pass
    logger.info(f"[EXTRACT] Trafilatura extracted Markdown in {time.monotonic() - t_ext:.2f}s")

    # Attempt 2: html2text (if available)
    if not markdown_content:
        try:
            import html2text
            h = html2text.HTML2Text()
            h.ignore_links = False
            h.ignore_images = False
            h.ignore_tables = False
            h.body_width = 0
            converted = h.handle(html_text)
            if converted and converted.strip():
                markdown_content = converted
        except Exception:
            pass

    # Attempt 3: Tag stripper fallback if extraction returns empty
    if not markdown_content and html_text:
        markdown_content = _strip_tags(html_text)

    # Attempt 4: Meta tags fallback for SPA / JavaScript-rendered HTML shells
    if not markdown_content.strip() and html_text:
        markdown_content = _extract_meta_markdown(html_text)

    if not markdown_content.strip():
        raise UnsupportedFormatError(f"No text could be extracted from {url}")

    t_conv = time.monotonic()
    parsed = urlparse(successful_url)
    host = parsed.netloc.lower() or "page"
    path_parts = [p for p in parsed.path.strip("/").split("/") if p]

    if "github.com" in host and len(path_parts) >= 2:
        repo_name = f"{path_parts[0]}/{path_parts[1]}"
        header = f"# Repository [{repo_name}]({successful_url})\n\n"
        filename = f"{_slugify(repo_name)}.md"
    else:
        header = f"# {parsed.netloc or 'page'}\n\n> Source: {successful_url}\n\n"
        filename = f"{_slugify(parsed.netloc or 'page')}.md"

    output_path = output_dir / filename
    output_path.write_text(header + markdown_content, encoding="utf-8")
    logger.info(f"[CONVERT MD] Formatted & saved '{output_path.name}' in {time.monotonic() - t_conv:.3f}s")
    logger.info(f"[FETCH SUCCESS] '{url}' -> '{output_path.name}' (TOTAL TIME: {time.monotonic() - t_total:.2f}s)")
    return output_path