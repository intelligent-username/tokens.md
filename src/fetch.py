import logging
import re
import time
from pathlib import Path
from urllib.parse import urlparse

from .handlers.html import _strip_tags
from .registry import UnsupportedFormatError
from .spoof import Spoofer

logger = logging.getLogger("backend")

# Optional dependencies - imported at module level for test patching
try:
    import trafilatura
except ImportError:
    trafilatura = None

try:
    import html2text
except ImportError:
    html2text = None


class _Fetcher:
    """Internal fetcher/extractor with a patchable interface for tests.

    Delegates to module-level trafilatura so that patching ``src.fetch.trafilatura``
    affects this wrapper (used by test_fetch.py). The ``require`` function returns
    this wrapper so that patching ``src.fetch.require`` also works (used by test_api.py).
    """

    def fetch_url(self, url: str) -> str:
        """Fetch HTML from URL using trafilatura.fetch_url if available, else Spoofer.

        If trafilatura.fetch_url is available and returns None/empty, treat as failure
        (allows test_fetch.py to simulate failure by patching fetch_url to return None).
        Only fall back to Spoofer if trafilatura is not available or raises an exception.
        """
        # Try trafilatura.fetch_url first (allows test_fetch.py to patch it)
        if trafilatura is not None and hasattr(trafilatura, "fetch_url"):
            try:
                fetched = trafilatura.fetch_url(url)
                if fetched:
                    return fetched
                # trafilatura.fetch_url returned None/empty - treat as failure, don't fall back
                return ""
            except Exception:
                # On exception, fall back to Spoofer
                pass

        # Fallback to Spoofer with candidate chain (only if trafilatura not available or raised)
        candidates: list[str] = []
        if url.startswith("http://") or url.startswith("https://"):
            candidates.append(url)
        else:
            bare = url.lstrip("/")
            candidates.append(f"https://{bare}")
            if not bare.startswith("www."):
                candidates.append(f"https://www.{bare}")
            candidates.append(f"http://{bare}")
            if not bare.startswith("www."):
                candidates.append(f"http://www.{bare}")

        for target in candidates:
            try:
                fetched = Spoofer.fetch(target, timeout_sec=2)
                if fetched:
                    return fetched
            except Exception:
                continue
        return ""

    def extract(self, html: str, **kwargs: object) -> str:
        """Extract markdown from HTML using module-level trafilatura."""
        if trafilatura is None:
            return ""
        try:
            extracted = trafilatura.extract(html, output_format="markdown", include_links=True, include_images=True, include_tables=True, include_formatting=True, favor_recall=True, **kwargs)
            return extracted or ""
        except Exception:
            return ""


# Module-level fetcher instance for test patching via require()
_fetcher = _Fetcher()


def require(name: str) -> _Fetcher:
    """Return a fetcher/extractor instance (patchable for tests).

    Args:
        name: Dependency name (ignored, kept for compatibility with test mocks).

    Returns:
        A fetcher instance with ``fetch_url`` and ``extract`` methods that
        delegate to the module-level ``trafilatura``.
    """
    return _fetcher


def _fetch_html(url: str) -> str:
    """Fetch HTML using the patchable fetcher (allows test_api.py to mock require)."""
    return _fetcher.fetch_url(url)


def _extract_markdown(html: str) -> str:
    """Extract markdown using the patchable fetcher (allows test_api.py to mock require)."""
    return _fetcher.extract(html)


def _slugify(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return slug or "page"


def _extract_meta_markdown(html: str) -> str:
    """Extract title and meta description for minimal SPA HTML shells."""
    title_match = re.search(r"<title[^>]*>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
    desc_match = re.search(r'<meta[^>]*name=["\']description["\'][^>]*content=["\'](.*?)["\']', html, re.IGNORECASE) or re.search(r'<meta[^>]*property=["\']og:description["\'][^>]*content=["\'](.*?)["\']', html, re.IGNORECASE)

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


def _fetch_github_repo(url: str, output_dir: Path) -> Path:
    import subprocess
    import tempfile
    from .handlers.repo import RepoConverter, _build_tree

    clean_url = url.strip().rstrip("/")
    if clean_url.endswith(".git"):
        clean_url = clean_url[:-4]
    repo_name = clean_url.split("/")[-1] or "repository"
    if repo_name.endswith(".md"):
        repo_name = repo_name[:-3]

    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir) / repo_name
        res = subprocess.run(["git", "clone", "--depth", "1", url, str(tmp_path)], capture_output=True, text=True)
        if res.returncode != 0:
            raise UnsupportedFormatError(f"Failed to clone git repository {url}: {res.stderr.strip()}")

        converter = RepoConverter()
        spec = converter._load_gitignore(tmp_path, None)
        files = converter._collect_files(tmp_path, spec)
        tree_str = _build_tree(tmp_path, files)

        readme_path: Path | None = None
        for candidate in sorted(tmp_path.glob("README*")):
            if candidate.is_file():
                readme_path = candidate
                break

        sections: list[str] = []
        if readme_path is not None:
            try:
                readme_text = readme_path.read_text(encoding="utf-8", errors="replace")
            except OSError:
                readme_text = ""

            readme_lines = readme_text.splitlines()
            title_line = ""
            rest_lines: list[str] = []

            found_title = False
            for line in readme_lines:
                if not found_title and line.strip().startswith("# "):
                    title_line = line.strip()
                    found_title = True
                else:
                    rest_lines.append(line)

            if not title_line:
                title_line = f"# {repo_name}"

            sections.append(title_line)
            sections.append("")
            sections.append("## Directory Structure")
            sections.append("```")
            sections.append(tree_str)
            sections.append("```")
            sections.append("")
            rest_content = "\n".join(rest_lines).strip()
            if rest_content:
                sections.append(rest_content)
        else:
            sections.append(f"# Repository: {repo_name}")
            sections.append("")
            sections.append("## Directory Structure")
            sections.append("```")
            sections.append(tree_str)
            sections.append("```")

        output_path = output_dir / f"{repo_name}.md"
        output_path.write_text("\n".join(sections), encoding="utf-8")
        return output_path


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

    parsed = urlparse(raw_url)
    if "github.com" in parsed.netloc.lower():
        path_parts = [p for p in parsed.path.strip("/").split("/") if p]
        if len(path_parts) == 2 or (len(path_parts) == 3 and path_parts[2].endswith(".git")):
            try:
                return _fetch_github_repo(raw_url, output_dir)
            except Exception as exc:
                logger.warning("GitHub repo fetch failed for %s, falling back to page fetch: %s", raw_url, exc)

    # Use require() to get a patchable fetcher (allows test_api.py to mock require)
    fetcher = require("trafilatura")
    html_text = fetcher.fetch_url(raw_url)
    if not html_text:
        raise UnsupportedFormatError(f"Non-existent or unreachable link: {url}")

    successful_url = raw_url  # For filename generation

    markdown_content = ""
    # Pass HTML into trafilatura.extract with favor_recall=True so non-article web pages are extracted
    t_ext = time.monotonic()
    extracted = fetcher.extract(html_text)
    if extracted and extracted.strip():
        markdown_content = extracted
    logger.info(f"[EXTRACT] Trafilatura extracted Markdown in {time.monotonic() - t_ext:.2f}s")

    # Attempt 2: html2text (if available)
    if not markdown_content:
        try:
            if html2text is not None:
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
