"""Typer CLI command definitions and callbacks."""

from __future__ import annotations

import threading
import webbrowser
from pathlib import Path

import typer

from .. import __version__
from ..budget import format_prune_report, prune_to_budget
from ..delta import print_delta_summary
from ..deps import require
from ..file_selector import select_files
from ..handlers.repo import RepoConverter
from ..merger import merge_files
from ..registry import UnsupportedFormatError
from ..tokenizer import DEFAULT_ENCODING, count_raw_file_tokens, count_tokens, count_tokens_in_file, delta_percent, format_tokens
from .constants import (
    DEFAULT_MERGED_FILENAME,
    DEFAULT_OUTPUT_DIR,
    DEFAULT_POLL_INTERVAL,
    DEFAULT_SOURCE_DIR,
    DEFAULT_UI_HOST,
    DEFAULT_UI_PORT,
    DEFAULT_WATCH_SOURCE,
    EXIT_CODE_ERROR,
)
from .convert_runner import convert_impl
from .theme import OrderGroup, console
from .utils import (
    _convert_kwargs,
    _default_extensions,
    _default_source,
    _find_free_port,
    _parse_extensions,
    _resolve_output_dir,
)

app = typer.Typer(
    cls=OrderGroup,
    help="Convert files to token-efficient Markdown for LLM prompts.",
    no_args_is_help=False,
    add_completion=False,
    rich_markup_mode="rich",
    options_metavar="",
    context_settings={"help_option_names": []},
)


@app.callback(invoke_without_command=True)
def _main(
    ctx: typer.Context,
    version: bool = typer.Option(False, "--version", "--v", "-v", hidden=True),
    help_opt: bool = typer.Option(False, "--help", "-h", hidden=True),
) -> None:
    """Convert files to token-efficient Markdown for LLM prompts."""
    if help_opt:
        console.print(ctx.get_help())
        raise typer.Exit()
    if version:
        typer.echo(f"tmd {__version__}")
        raise typer.Exit()
    if ctx.invoked_subcommand is None:
        source = _default_source()
        convert_impl(source=str(source), output=str(source.parent / DEFAULT_OUTPUT_DIR))


@app.command("version")
def version_cmd() -> None:
    """Show version and exit. (Doesn't accept ARGS)"""
    typer.echo(f"tmd {__version__}")
    raise typer.Exit()


@app.command("help")
def help_cmd(ctx: typer.Context) -> None:
    """Show this message and exit. (Doesn't accept ARGS)"""
    if ctx.parent:
        console.print(ctx.parent.get_help())
    else:
        console.print(ctx.get_help())
    raise typer.Exit()


@app.command()
def convert(
    source: str = typer.Argument(DEFAULT_SOURCE_DIR, help="Directory, file, or glob pattern."),
    output: str = typer.Option(DEFAULT_OUTPUT_DIR, "-o", "--output", help="Output directory."),
    loc: str | None = typer.Option(
        None,
        "--loc",
        help="Output location. Bare --loc or '' writes to current dir '.', or specify folder (e.g. --loc=outputs).",
    ),
    recursive: bool = typer.Option(False, "-r", "--recursive", help="Recurse into subdirectories."),
    extensions: str = typer.Option(_default_extensions, "-e", "--extensions", help="Comma-separated extensions filter."),
    strip_headers_footers: bool = typer.Option(False, "--strip-headers-footers", help="Strip running headers and footers from each page."),
    write_images: bool = typer.Option(False, "--write-images", help="Extract embedded images to disk."),
    image_path: str | None = typer.Option(None, "--image-path", help="Custom directory for extracted images."),
    pages: str | None = typer.Option(None, "--pages", help="Comma-separated zero-based page indices (e.g. '0,1,4')."),
    clip: bool = typer.Option(False, "--clip", help="Copy combined Markdown output to clipboard."),
    merge: bool = typer.Option(False, "-m", "--merge", help="Merge all converted files into a single unified Markdown document."),
    budget: int | None = typer.Option(None, "-b", "--budget", help="Prune output to fit a hard token budget limit."),
) -> None:
    """Convert files to Markdown."""
    convert_impl(
        source=source,
        output=output,
        loc=loc,
        recursive=recursive,
        extensions=extensions,
        strip_headers_footers=strip_headers_footers,
        write_images=write_images,
        image_path=image_path,
        pages=pages,
        clip=clip,
        merge=merge,
        budget=budget,
    )





@app.command()
def watch(
    source: str = typer.Option(DEFAULT_WATCH_SOURCE, "-s", "--source", help="Hot folder to monitor."),
    output: str = typer.Option(DEFAULT_OUTPUT_DIR, "-o", "--output", help="Output directory for converted files."),
    loc: str | None = typer.Option(
        None,
        "--loc",
        help="Output location. Bare --loc or '' writes to current dir '.', or specify folder (e.g. --loc=outputs).",
    ),
    poll_interval: float = typer.Option(DEFAULT_POLL_INTERVAL, "--poll-interval", help="Stability wait in seconds."),
    clip: bool = typer.Option(False, "--clip", help="Copy converted text to clipboard automatically."),
    once: bool = typer.Option(False, "--once", help="Process existing files and exit."),
    strip_headers_footers: bool = typer.Option(False, "--strip-headers-footers", help="Strip running headers and footers from each page."),
    write_images: bool = typer.Option(False, "--write-images", help="Extract embedded images to disk."),
    image_path: str | None = typer.Option(None, "--image-path", help="Custom directory for extracted images."),
    pages: str | None = typer.Option(None, "--pages", help="Comma-separated zero-based page indices."),
) -> None:
    """Watch a folder and convert new files automatically."""
    require("watchdog", "tmd watch")
    from ..watcher import run_watcher

    kwargs = _convert_kwargs(strip_headers_footers, write_images, image_path, pages)
    output_dir = _resolve_output_dir(output, loc)
    run_watcher(
        Path(source),
        output_dir,
        poll_interval=poll_interval,
        clip=clip,
        once=once,
        extensions=_parse_extensions(_default_extensions()),
        **kwargs,
    )


@app.command()
def fetch(
    url: str = typer.Argument(..., help="URL to fetch."),
    output: str = typer.Option(DEFAULT_OUTPUT_DIR, "-o", "--output", help="Output directory for saved Markdown article."),
    loc: str | None = typer.Option(
        None,
        "--loc",
        help="Output location. Bare --loc or '' writes to current dir '.', or specify folder (e.g. --loc=outputs).",
    ),
) -> None:
    """Fetch a web page and save clean article Markdown."""
    from ..fetch import fetch_url

    output_dir = _resolve_output_dir(output, loc)
    try:
        out = fetch_url(url, output_dir)
        console.print(f"[green]Fetched[/green] {url} -> {out.name}")
    except UnsupportedFormatError as exc:
        console.print(f"[red]Error[/red] {exc}")
        raise typer.Exit(code=EXIT_CODE_ERROR)


@app.command()
def repo(
    directory: str = typer.Argument(..., help="Repository directory path or Git URL (e.g. '.' or 'https://github.com/user/repo')."),
    output: str = typer.Option(DEFAULT_OUTPUT_DIR, "-o", "--output", help="Output directory for generated manifest."),
    loc: str | None = typer.Option(
        None,
        "--loc",
        help="Output location. Bare --loc or '' writes to current dir '.', or specify folder (e.g. --loc=outputs).",
    ),
    exclude: list[str] = typer.Option([], "--exclude", help="Extra gitignore patterns."),
    full: bool = typer.Option(False, "-f", "--full", help="Include full source code contents for all repository files."),
) -> None:
    """Collapse a repository into a single Markdown manifest."""
    output_dir = _resolve_output_dir(output, loc)
    try:
        out = RepoConverter().convert(directory, output_dir, exclude=exclude, full=full)
        tokens = count_tokens_in_file(out)
        console.print(f"[green]Repo manifest[/green] -> {out} [dim cyan]({format_tokens(tokens)} tokens)[/dim cyan]")
    except Exception as exc:
        console.print(f"[red]Error[/red] {exc}")
        raise typer.Exit(code=EXIT_CODE_ERROR)


@app.command()
def merge(
    source: str = typer.Argument(..., help="Directory, file, or glob pattern."),
    output: str = typer.Option(DEFAULT_MERGED_FILENAME, "-o", "--output", help="Output Markdown filename."),
    loc: str | None = typer.Option(
        None,
        "--loc",
        help="Output location. Bare --loc or '' writes to current dir '.', or specify folder (e.g. --loc=outputs).",
    ),
    recursive: bool = typer.Option(False, "-r", "--recursive", help="Recurse into subdirectories."),
    budget: int | None = typer.Option(None, "--budget", help="Hard token budget limit."),
    encoding: str = typer.Option(DEFAULT_ENCODING, "--encoding", help="tiktoken encoding for token counting."),
    no_convert: bool = typer.Option(False, "--no-convert", help="Use raw file contents without converting first."),
    dedup: bool = typer.Option(False, "--dedup", help="Remove exact duplicate lines while preserving order."),
    no_toc: bool = typer.Option(False, "--no-toc", help="Skip generating Table of Contents header."),
    delta: bool = typer.Option(False, "--delta", help="Print token savings delta summary after merging."),
) -> None:
    """Merge selected files into one master Markdown document."""
    files = select_files(source, extensions=_parse_extensions(_default_extensions()), recursive=recursive)
    if not files:
        typer.echo(f"No matching files found in {source}.")
        raise typer.Exit(code=EXIT_CODE_ERROR)

    if loc is not None:
        out_dir = _resolve_output_dir(output, loc)
        filename = Path(output).name if (output and output != DEFAULT_MERGED_FILENAME) else DEFAULT_MERGED_FILENAME
        output_path = out_dir / filename
    else:
        output_path = Path(output)
        output_path.parent.mkdir(parents=True, exist_ok=True)

    include_tokens = budget is not None or delta
    merge_files(files, output_path, no_convert=no_convert, dedup=dedup, toc=not no_toc, encoding=encoding, include_tokens=include_tokens)

    if budget is not None:
        result = prune_to_budget(output_path.read_text(encoding="utf-8"), budget, encoding)
        output_path.write_text(result.content, encoding="utf-8")
        console.print(format_prune_report(result, budget, encoding))

    total_source = sum(count_raw_file_tokens(f, encoding) for f in files)
    merged_text = output_path.read_text(encoding="utf-8", errors="replace")
    total_target = count_tokens(merged_text, encoding)
    saved_tokens = max(0, total_source - total_target)
    pct = delta_percent(total_source, total_target)

    console.print(
        f"[green]Merged[/green] {len(files)} file(s) -> {output_path.name} [dim cyan](output ≈ {format_tokens(total_target)} tokens | saved ≈ {format_tokens(saved_tokens)} tokens [{pct:+.1f}%])[/dim cyan]"
    )


@app.command(hidden=True)
def delta(
    source: str = typer.Argument(..., help="Directory, file, or glob pattern."),
    output: str = typer.Option(DEFAULT_OUTPUT_DIR, "-o", "--output", help="Directory containing converted .md files."),
    loc: str | None = typer.Option(
        None,
        "--loc",
        help="Output location. Bare --loc or '' writes to current dir '.', or specify folder (e.g. --loc=outputs).",
    ),
    encoding: str = typer.Option(DEFAULT_ENCODING, "--encoding", help="tiktoken encoding for token counting."),
) -> None:
    """Print a token delta summary for converted files."""
    files = select_files(source, extensions=_parse_extensions(_default_extensions()))
    if not files:
        typer.echo(f"No matching files found in {source}.")
        raise typer.Exit(code=EXIT_CODE_ERROR)
    output_dir = _resolve_output_dir(output, loc)
    outputs = [output_dir / f"{path.stem}.md" for path in files]
    print_delta_summary(files, outputs, encoding)


@app.command()
def ui(
    host: str = typer.Option(DEFAULT_UI_HOST, "--host", help="Bind address (0.0.0.0 for LAN)."),
    port: int = typer.Option(DEFAULT_UI_PORT, "--port", help="Port; auto-increments if busy."),
    browser: bool = typer.Option(True, "--no-browser", help="Do not auto-open the browser."),
) -> None:
    """Launch the local web UI (API + built frontend)."""
    require("fastapi", "tmd ui")
    require("uvicorn", "tmd ui")

    import uvicorn

    from backend.app import create_app
    from backend.config import Settings

    chosen = _find_free_port(host, port)
    settings = Settings(host=host, port=chosen)
    _ = create_app(settings)

    target_url = f"http://{host}:{chosen}"

    if browser:
        threading.Timer(1.0, lambda: webbrowser.open(target_url)).start()
    console.print(f"[green]tokens.md UI[/green] -> {target_url} (API: http://{host}:{chosen}/api, docs: http://{host}:{chosen}/docs)")
    uvicorn.run("backend.app:create_app", factory=True, host=host, port=chosen, log_level="info", reload=True)


@app.command(hidden=True)
def lint(
    fix: bool = typer.Option(False, "--fix", help="Automatically fix linter and formatting errors."),
    verbose: bool = typer.Option(False, "-v", "--v", "--verbose", help="Show detailed verbose linter outputs."),
) -> None:
    """Hidden developer command: run linter script."""
    import subprocess
    import sys

    script_path = Path("scripts/lint.py")
    if not script_path.exists():
        console.print("[yellow]Developer scripts (scripts/lint.py) are only available in repository checkouts.[/yellow]")
        raise typer.Exit(code=EXIT_CODE_ERROR)
    cmd = [sys.executable, str(script_path)]
    if fix:
        cmd.append("--fix")
    if verbose:
        cmd.append("-v")
    res = subprocess.run(cmd)
    if res.returncode != 0:
        raise typer.Exit(code=EXIT_CODE_ERROR)


@app.command(hidden=True)
def test(
    verbose: bool = typer.Option(False, "-v", "--v", "--verbose", help="Show detailed test outputs."),
) -> None:
    """Hidden developer command: run test runner script."""
    import subprocess
    import sys

    script_path = Path("scripts/test.py")
    if not script_path.exists():
        console.print("[yellow]Developer scripts (scripts/test.py) are only available in repository checkouts.[/yellow]")
        raise typer.Exit(code=EXIT_CODE_ERROR)
    cmd = [sys.executable, str(script_path)]
    if verbose:
        cmd.append("-v")
    res = subprocess.run(cmd)
    if res.returncode != 0:
        raise typer.Exit(code=EXIT_CODE_ERROR)




