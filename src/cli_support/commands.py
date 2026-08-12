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
from ..tokenizer import DEFAULT_ENCODING, count_raw_file_tokens, count_tokens, delta_percent, format_tokens
from .constants import DEFAULT_MERGED_FILENAME, DEFAULT_OUTPUT_DIR, DEFAULT_POLL_INTERVAL, DEFAULT_SOURCE_DIR, DEFAULT_UI_HOST, DEFAULT_UI_PORT, DEFAULT_WATCH_SOURCE, EXIT_CODE_ERROR
from .convert_runner import convert_impl
from .theme import OrderGroup, console
from .utils import _convert_kwargs, _default_extensions, _default_source, _find_free_port, _parse_extensions, _resolve_output_dir

app = typer.Typer(cls=OrderGroup, help="Convert files to token-efficient Markdown for LLM prompts.", no_args_is_help=False, add_completion=False, rich_markup_mode="rich", options_metavar="", context_settings={"help_option_names": []})


@app.callback(invoke_without_command=True)
def _main(ctx: typer.Context, version: bool = typer.Option(False, "--version", "--v", "-v", hidden=True), help_opt: bool = typer.Option(False, "--help", "-h", hidden=True)) -> None:
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
    loc: str | None = typer.Option(None, "--loc", help="Output location. Bare --loc or '' writes to current dir '.', or specify folder (e.g. --loc=outputs)."),
    recursive: bool = typer.Option(False, "-r", "--recursive", help="Recurse into subdirectories."),
    extensions: str = typer.Option(_default_extensions, "-e", "--extensions", help="Comma-separated extensions."),
    strip_headers_footers: bool = typer.Option(False, "--strip-headers-footers"),
    write_images: bool = typer.Option(False, "--write-images"),
    image_path: str | None = typer.Option(None, "--image-path"),
    pages: str | None = typer.Option(None, "--pages", help="Comma-separated zero-based page indices."),
    clip: bool = typer.Option(False, "--clip", help="Copy combined markdown to clipboard."),
) -> None:
    """Convert files to Markdown."""
    convert_impl(source=source, output=output, loc=loc, recursive=recursive, extensions=extensions, strip_headers_footers=strip_headers_footers, write_images=write_images, image_path=image_path, pages=pages, clip=clip)


@app.command()
def clip(
    source: str = typer.Argument(..., help="File or directory to convert."),
    write: bool = typer.Option(False, "--write", help="Also save .md files to output."),
    output: str = typer.Option(DEFAULT_OUTPUT_DIR, "-o", "--output"),
    loc: str | None = typer.Option(None, "--loc", help="Output location. Bare --loc or '' writes to current dir '.', or specify folder (e.g. --loc=outputs)."),
    strip_headers_footers: bool = typer.Option(False, "--strip-headers-footers"),
    write_images: bool = typer.Option(False, "--write-images"),
    image_path: str | None = typer.Option(None, "--image-path"),
    pages: str | None = typer.Option(None, "--pages"),
) -> None:
    """Convert on the fly and copy Markdown to the clipboard."""
    from ..clipboard import copy_to_clipboard
    from ..merger import resolve_to_markdown

    source_path = Path(source)
    if source_path.is_file():
        paths = [source_path]
    else:
        paths = select_files(source_path, extensions=_parse_extensions(_default_extensions()))
    if not paths:
        typer.echo(f"No matching files found in {source}.")
        raise typer.Exit(code=EXIT_CODE_ERROR)

    kwargs = _convert_kwargs(strip_headers_footers, write_images, image_path, pages)
    parts: list[str] = []
    for path in paths:
        try:
            parts.append(resolve_to_markdown(path, **kwargs))
        except UnsupportedFormatError as exc:
            console.print(f"[yellow]Skipped[/yellow] {path.name}: {exc}")
            continue
        if write:
            output_dir = _resolve_output_dir(output, loc)
            (output_dir / f"{path.stem}.md").write_text(parts[-1], encoding="utf-8")

    if not parts:
        raise typer.Exit(code=EXIT_CODE_ERROR)

    combined = "\n\n".join(parts)
    copy_to_clipboard(combined)
    console.print(f"[cyan]Copied[/cyan] {len(combined)} chars / {len(combined.splitlines())} lines to clipboard.")


@app.command()
def watch(
    source: str = typer.Option(DEFAULT_WATCH_SOURCE, "-s", "--source", help="Hot folder to monitor."),
    output: str = typer.Option(DEFAULT_OUTPUT_DIR, "-o", "--output"),
    loc: str | None = typer.Option(None, "--loc", help="Output location. Bare --loc or '' writes to current dir '.', or specify folder (e.g. --loc=outputs)."),
    poll_interval: float = typer.Option(DEFAULT_POLL_INTERVAL, "--poll-interval", help="Stability wait in seconds."),
    clip: bool = typer.Option(False, "--clip"),
    once: bool = typer.Option(False, "--once", help="Process existing files and exit."),
    strip_headers_footers: bool = typer.Option(False, "--strip-headers-footers"),
    write_images: bool = typer.Option(False, "--write-images"),
    image_path: str | None = typer.Option(None, "--image-path"),
    pages: str | None = typer.Option(None, "--pages"),
) -> None:
    """Watch a folder and convert new files automatically."""
    require("watchdog", "tmd watch")
    from ..watcher import run_watcher

    kwargs = _convert_kwargs(strip_headers_footers, write_images, image_path, pages)
    output_dir = _resolve_output_dir(output, loc)
    run_watcher(Path(source), output_dir, poll_interval=poll_interval, clip=clip, once=once, extensions=_parse_extensions(_default_extensions()), **kwargs)


@app.command()
def fetch(url: str = typer.Argument(..., help="URL to fetch."), output: str = typer.Option(DEFAULT_OUTPUT_DIR, "-o", "--output"), loc: str | None = typer.Option(None, "--loc", help="Output location. Bare --loc or '' writes to current dir '.', or specify folder (e.g. --loc=outputs).")) -> None:
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
    directory: str = typer.Argument(..., help="Repository directory."),
    output: str = typer.Option(DEFAULT_OUTPUT_DIR, "-o", "--output"),
    loc: str | None = typer.Option(None, "--loc", help="Output location. Bare --loc or '' writes to current dir '.', or specify folder (e.g. --loc=outputs)."),
    exclude: list[str] = typer.Option([], "--exclude", help="Extra gitignore patterns."),
) -> None:
    """Collapse a repository into a single Markdown manifest."""
    output_dir = _resolve_output_dir(output, loc)
    out = RepoConverter().convert(Path(directory), output_dir, exclude=exclude)
    console.print(f"[green]Repo manifest[/green] -> {out.name}")


@app.command()
def merge(
    source: str = typer.Argument(..., help="Directory, file, or glob pattern."),
    output: str = typer.Option(DEFAULT_MERGED_FILENAME, "-o", "--output"),
    loc: str | None = typer.Option(None, "--loc", help="Output location. Bare --loc or '' writes to current dir '.', or specify folder (e.g. --loc=outputs)."),
    recursive: bool = typer.Option(False, "-r", "--recursive"),
    budget: int | None = typer.Option(None, "--budget", help="Hard token budget."),
    encoding: str = typer.Option(DEFAULT_ENCODING, "--encoding"),
    no_convert: bool = typer.Option(False, "--no-convert"),
    dedup: bool = typer.Option(False, "--dedup"),
    no_toc: bool = typer.Option(False, "--no-toc"),
    delta: bool = typer.Option(False, "--delta"),
) -> None:
    """Merge many files into one master Markdown document."""
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

    console.print(f"[green]Merged[/green] {len(files)} file(s) -> {output_path.name} [dim cyan](output ≈ {format_tokens(total_target)} tokens | saved ≈ {format_tokens(saved_tokens)} tokens [{pct:+.1f}%])[/dim cyan]")


@app.command()
def delta(
    source: str = typer.Argument(..., help="Directory, file, or glob pattern."),
    output: str = typer.Option(DEFAULT_OUTPUT_DIR, "-o", "--output"),
    loc: str | None = typer.Option(None, "--loc", help="Output location. Bare --loc or '' writes to current dir '.', or specify folder (e.g. --loc=outputs)."),
    encoding: str = typer.Option(DEFAULT_ENCODING, "--encoding"),
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
def ui(host: str = typer.Option(DEFAULT_UI_HOST, "--host", help="Bind address (0.0.0.0 for LAN)."), port: int = typer.Option(DEFAULT_UI_PORT, "--port", help="Port; auto-increments if busy."), browser: bool = typer.Option(True, "--no-browser", help="Do not auto-open the browser.")) -> None:
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


@app.command()
def lint(fix: bool = typer.Option(False, "--fix", help="Automatically fix linter and formatting errors."), verbose: bool = typer.Option(False, "-v", "--v", "--verbose", help="Show detailed verbose linter outputs.")) -> None:
    """Lint both Python backend (Ruff) and Next.js frontend (Prettier + ESLint)."""
    import subprocess
    import sys

    script_path = Path("scripts/lint.py")
    cmd = [sys.executable, str(script_path)]
    if fix:
        cmd.append("--fix")
    if verbose:
        cmd.append("-v")
    res = subprocess.run(cmd)
    if res.returncode != 0:
        raise typer.Exit(code=EXIT_CODE_ERROR)


@app.command()
def test(verbose: bool = typer.Option(False, "-v", "--v", "--verbose", help="Show detailed test outputs.")) -> None:
    """Run backend (pytest) and frontend (vitest) test suites in parallel with coverage summary."""
    import subprocess
    import sys

    script_path = Path("scripts/test.py")
    cmd = [sys.executable, str(script_path)]
    if verbose:
        cmd.append("-v")
    res = subprocess.run(cmd)
    if res.returncode != 0:
        raise typer.Exit(code=EXIT_CODE_ERROR)
