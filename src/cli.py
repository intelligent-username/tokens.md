"""Unified ``tmd`` command-line interface.

Subcommands: ``convert``, ``clip``, ``watch``, ``fetch``, ``repo``, ``merge``,
``delta``. Bare ``tmd`` runs ``convert`` with defaults for backward
compatibility.
"""

from __future__ import annotations

import threading
import webbrowser
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any, List, Optional, Sequence

import typer
from rich.console import Console
from rich.progress import (
    BarColumn,
    MofNCompleteColumn,
    Progress,
    SpinnerColumn,
    TaskProgressColumn,
    TextColumn,
    TimeRemainingColumn,
)

from . import __version__
from .budget import format_prune_report, prune_to_budget
from .delta import print_delta_summary
from .deps import MissingDependencyError, require
from .file_selector import select_files
from .handlers.repo import RepoConverter
from .merger import merge_files
from .registry import DEFAULT_REGISTRY, UnsupportedFormatError, convert_file
from .tokenizer import (
    DEFAULT_ENCODING,
    count_raw_file_tokens,
    count_tokens,
    delta_percent,
    format_tokens,
)

app = typer.Typer(
    help=(
        "Convert files to token-efficient Markdown for LLM prompts.\n\n"
        'Example: tmd convert . --loc="out"               # Converts all supported files in the current repository into markdown and writes to out/ folder'
    ),
    no_args_is_help=False,
    add_completion=False,
)
console = Console()


def _default_extensions() -> str:
    return ", ".join(sorted(ext.lstrip(".") for ext in DEFAULT_REGISTRY.extensions()))


def _parse_extensions(value: str) -> Sequence[str]:
    result: list[str] = []
    for raw in value.split(","):
        part = raw.strip()
        if part:
            result.append(part if part.startswith(".") else f".{part}")
    return result


def _convert_kwargs(
    strip_headers_footers: bool,
    write_images: bool,
    image_path: Optional[str],
    pages: Optional[str],
) -> dict[str, Any]:
    kwargs: dict[str, Any] = {
        "strip_headers_footers": strip_headers_footers,
        "write_images": write_images,
    }
    if image_path:
        kwargs["image_path"] = image_path
    if pages:
        kwargs["pages"] = [int(p.strip()) for p in pages.split(",") if p.strip()]
    return kwargs


def _default_source() -> Path:
    """Resolve the default input dir relative to the project root.

    Mirrors the original ``main.py``: prefer ``in/``, fall back to ``input/``,
    else create ``in/``. This lets ``python src/main.py`` (and bare ``tmd``)
    work from any directory.
    """
    root = Path(__file__).resolve().parent.parent
    in_dir = root / "in"
    input_dir = root / "input"
    if in_dir.exists():
        return in_dir
    if input_dir.exists():
        return input_dir
    in_dir.mkdir(exist_ok=True)
    return in_dir


@app.callback(invoke_without_command=True)
def _main(
    ctx: typer.Context,
    version: bool = typer.Option(False, "--version", help="Show version and exit."),
) -> None:
    """Convert files to token-efficient Markdown for LLM prompts.

    Example: tmd convert . --loc="out"               # Converts all supported files in the current repository into markdown and writes to out/ folder
    """
    if version:
        typer.echo(f"tmd {__version__}")
        raise typer.Exit()
    if ctx.invoked_subcommand is None:
        source = _default_source()
        convert_impl(source=str(source), output=str(source.parent / "output"))


def _resolve_output_dir(output: str, loc: Optional[str] = None) -> Path:
    """Resolve destination directory from --output or --loc option.

    Bare --loc, --loc="", or --loc="." resolves to current directory '.'.
    --loc="outputs" resolves to directory 'outputs/'.
    If --loc is omitted, falls back to output.
    """
    if loc is not None:
        target = "." if (loc.strip() == "" or loc == ".") else loc
    else:
        target = output
    p = Path(target)
    p.mkdir(parents=True, exist_ok=True)
    return p


def convert_impl(
    source: str = "input",
    output: str = "output",
    loc: Optional[str] = None,
    recursive: bool = False,
    extensions: Optional[str] = None,
    strip_headers_footers: bool = False,
    write_images: bool = False,
    image_path: Optional[str] = None,
    pages: Optional[str] = None,
    clip: bool = False,
) -> None:
    """Convert files to Markdown.

    Plain logic function so it can be called directly (e.g. from the bare
    ``tmd`` callback) without Typer's ``OptionInfo`` defaults.
    """
    output_dir = _resolve_output_dir(output, loc)
    files = select_files(
        source,
        extensions=_parse_extensions(
            extensions if extensions is not None else _default_extensions()
        ),
        recursive=recursive,
    )
    if not files:
        typer.echo(f"No matching files found in {source!r}.")
        raise typer.Exit(code=1)

    kwargs = _convert_kwargs(strip_headers_footers, write_images, image_path, pages)

    with Progress(
        SpinnerColumn(spinner_name="dots"),
        TextColumn("{task.description}"),
        BarColumn(bar_width=20, style="dim white", complete_style="green"),
        TaskProgressColumn(),
        console=console,
        transient=False,
    ) as progress:
        task_map = {
            path: progress.add_task(f"[cyan]Converting[/cyan] {path.name}", total=100)
            for path in files
        }

        def _convert_file_worker(path: Path):
            t_id = task_map[path]
            progress.update(t_id, completed=10, description=f"[cyan]Converting[/cyan] {path.name}")
            try:
                progress.update(t_id, completed=40)
                out = convert_file(path, output_dir, **kwargs)
                progress.update(t_id, completed=85)
                markdown = out.read_text(encoding="utf-8", errors="replace")
                source_tokens = count_raw_file_tokens(path)
                target_tokens = count_tokens(markdown, DEFAULT_ENCODING)

                desc = (
                    f"[green]Converted[/green] {path.name} -> {out.name} "
                    f"({format_tokens(source_tokens)} -> {format_tokens(target_tokens)} tokens)"
                )
                progress.update(t_id, completed=100, description=desc)
                return (path, out, markdown, source_tokens, target_tokens, None)
            except UnsupportedFormatError as exc:
                desc = f"[yellow]Skipped[/yellow] {path.name}: {exc}"
                progress.update(t_id, completed=100, description=desc)
                return (path, None, None, 0, 0, exc)

        with ThreadPoolExecutor() as executor:
            future_map = {
                executor.submit(_convert_file_worker, path): path for path in files
            }
            results_dict = {}
            for future in as_completed(future_map):
                res = future.result()
                results_dict[res[0]] = res

    results = [results_dict[path] for path in files]

    failures = 0
    converted_count = 0
    combined: list[str] = []
    total_source = 0
    total_target = 0
    for path, out, markdown, source_tokens, target_tokens, exc in results:
        if exc is not None:
            failures += 1
        elif out is not None and markdown is not None:
            combined.append(markdown)
            converted_count += 1
            total_source += source_tokens
            total_target += target_tokens

    if clip and combined:
        from .clipboard import copy_to_clipboard

        copy_to_clipboard("\n\n".join(combined))
        console.print(f"[cyan]Copied[/cyan] {len(combined)} file(s) to clipboard.")

    if converted_count:
        pct = delta_percent(total_source, total_target)
        console.print(
            f"[bold]TOTAL[/bold] ({format_tokens(total_source)} tokens) -> "
            f"({format_tokens(total_target)} tokens) [{pct:+.1f}%]"
        )

    if failures:
        raise typer.Exit(code=1)


@app.command()
def convert(
    source: str = typer.Argument("input", help="Directory, file, or glob pattern."),
    output: str = typer.Option("output", "-o", "--output", help="Output directory."),
    loc: Optional[str] = typer.Option(
        None,
        "--loc",
        flag_value="",
        help="Output location. Bare --loc or '' writes to current dir '.', or specify folder (e.g. --loc=outputs).",
    ),
    recursive: bool = typer.Option(False, "-r", "--recursive", help="Recurse into subdirectories."),
    extensions: str = typer.Option(
        _default_extensions, "-e", "--extensions", help="Comma-separated extensions."
    ),
    strip_headers_footers: bool = typer.Option(False, "--strip-headers-footers"),
    write_images: bool = typer.Option(False, "--write-images"),
    image_path: Optional[str] = typer.Option(None, "--image-path"),
    pages: Optional[str] = typer.Option(None, "--pages", help="Comma-separated zero-based page indices."),
    clip: bool = typer.Option(False, "--clip", help="Copy combined markdown to clipboard."),
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
    )


@app.command()
def clip(
    source: str = typer.Argument(..., help="File or directory to convert."),
    write: bool = typer.Option(False, "--write", help="Also save .md files to output."),
    output: str = typer.Option("output", "-o", "--output"),
    loc: Optional[str] = typer.Option(
        None,
        "--loc",
        flag_value="",
        help="Output location. Bare --loc or '' writes to current dir '.', or specify folder (e.g. --loc=outputs).",
    ),
    strip_headers_footers: bool = typer.Option(False, "--strip-headers-footers"),
    write_images: bool = typer.Option(False, "--write-images"),
    image_path: Optional[str] = typer.Option(None, "--image-path"),
    pages: Optional[str] = typer.Option(None, "--pages"),
) -> None:
    """Convert on the fly and copy Markdown to the clipboard."""
    from .clipboard import copy_to_clipboard
    from .merger import resolve_to_markdown

    source_path = Path(source)
    if source_path.is_file():
        paths = [source_path]
    else:
        paths = select_files(source_path, extensions=_parse_extensions(_default_extensions()))
    if not paths:
        typer.echo(f"No matching files found in {source}.")
        raise typer.Exit(code=1)

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
        raise typer.Exit(code=1)

    combined = "\n\n".join(parts)
    copy_to_clipboard(combined)
    console.print(
        f"[cyan]Copied[/cyan] {len(combined)} chars / {len(combined.splitlines())} lines to clipboard."
    )


@app.command()
def watch(
    source: str = typer.Option("inbox", "-s", "--source", help="Hot folder to monitor."),
    output: str = typer.Option("output", "-o", "--output"),
    loc: Optional[str] = typer.Option(
        None,
        "--loc",
        flag_value="",
        help="Output location. Bare --loc or '' writes to current dir '.', or specify folder (e.g. --loc=outputs).",
    ),
    poll_interval: float = typer.Option(2.0, "--poll-interval", help="Stability wait in seconds."),
    clip: bool = typer.Option(False, "--clip"),
    once: bool = typer.Option(False, "--once", help="Process existing files and exit."),
    strip_headers_footers: bool = typer.Option(False, "--strip-headers-footers"),
    write_images: bool = typer.Option(False, "--write-images"),
    image_path: Optional[str] = typer.Option(None, "--image-path"),
    pages: Optional[str] = typer.Option(None, "--pages"),
) -> None:
    """Watch a folder and convert new files automatically."""
    require("watchdog", "tmd watch")
    from .watcher import run_watcher

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
    output: str = typer.Option("output", "-o", "--output"),
    loc: Optional[str] = typer.Option(
        None,
        "--loc",
        flag_value="",
        help="Output location. Bare --loc or '' writes to current dir '.', or specify folder (e.g. --loc=outputs).",
    ),
) -> None:
    """Fetch a web page and save clean article Markdown."""
    from .fetch import fetch_url

    output_dir = _resolve_output_dir(output, loc)
    try:
        out = fetch_url(url, output_dir)
        console.print(f"[green]Fetched[/green] {url} -> {out.name}")
    except UnsupportedFormatError as exc:
        console.print(f"[red]Error[/red] {exc}")
        raise typer.Exit(code=1)


@app.command()
def repo(
    directory: str = typer.Argument(..., help="Repository directory."),
    output: str = typer.Option("output", "-o", "--output"),
    loc: Optional[str] = typer.Option(
        None,
        "--loc",
        flag_value="",
        help="Output location. Bare --loc or '' writes to current dir '.', or specify folder (e.g. --loc=outputs).",
    ),
    exclude: List[str] = typer.Option([], "--exclude", help="Extra gitignore patterns."),
) -> None:
    """Collapse a repository into a single Markdown manifest."""
    output_dir = _resolve_output_dir(output, loc)
    out = RepoConverter().convert(Path(directory), output_dir, exclude=exclude)
    console.print(f"[green]Repo manifest[/green] -> {out.name}")


@app.command()
def merge(
    source: str = typer.Argument(..., help="Directory, file, or glob pattern."),
    output: str = typer.Option("merged.md", "-o", "--output"),
    loc: Optional[str] = typer.Option(
        None,
        "--loc",
        flag_value="",
        help="Output location. Bare --loc or '' writes to current dir '.', or specify folder (e.g. --loc=outputs).",
    ),
    recursive: bool = typer.Option(False, "-r", "--recursive"),
    budget: Optional[int] = typer.Option(None, "--budget", help="Hard token budget."),
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
        raise typer.Exit(code=1)

    if loc is not None:
        out_dir = _resolve_output_dir(output, loc)
        filename = Path(output).name if (output and output != "merged.md") else "merged.md"
        output_path = out_dir / filename
    else:
        output_path = Path(output)
        output_path.parent.mkdir(parents=True, exist_ok=True)

    include_tokens = budget is not None or delta
    merge_files(
        files,
        output_path,
        no_convert=no_convert,
        dedup=dedup,
        toc=not no_toc,
        encoding=encoding,
        include_tokens=include_tokens,
    )

    if budget is not None:
        result = prune_to_budget(output_path.read_text(encoding="utf-8"), budget, encoding)
        output_path.write_text(result.content, encoding="utf-8")
        console.print(format_prune_report(result, budget, encoding))

    if delta:
        print_delta_summary(files, [output_path], encoding)

    console.print(f"[green]Merged[/green] {len(files)} file(s) -> {output_path.name}")


@app.command()
def delta(
    source: str = typer.Argument(..., help="Directory, file, or glob pattern."),
    output: str = typer.Option("output", "-o", "--output"),
    loc: Optional[str] = typer.Option(
        None,
        "--loc",
        flag_value="",
        help="Output location. Bare --loc or '' writes to current dir '.', or specify folder (e.g. --loc=outputs).",
    ),
    encoding: str = typer.Option(DEFAULT_ENCODING, "--encoding"),
) -> None:
    """Print a token delta summary for converted files."""
    files = select_files(source, extensions=_parse_extensions(_default_extensions()))
    if not files:
        typer.echo(f"No matching files found in {source}.")
        raise typer.Exit(code=1)
    output_dir = _resolve_output_dir(output, loc)
    outputs = [output_dir / f"{path.stem}.md" for path in files]
    print_delta_summary(files, outputs, encoding)


def _find_free_port(host: str, port: int) -> int:
    """Return ``port`` or the first free port up to ``port + 20``."""
    import socket

    for candidate in range(port, port + 21):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            try:
                sock.bind((host, candidate))
            except OSError:
                continue
        return candidate
    return port


@app.command()
def ui(
    host: str = typer.Option("127.0.0.1", "--host", help="Bind address (0.0.0.0 for LAN)."),
    port: int = typer.Option(8642, "--port", help="Port; auto-increments if busy."),
    browser: bool = typer.Option(True, "--no-browser", help="Do not auto-open the browser."),
) -> None:
    """Launch the local web UI (API + built frontend)."""
    require("fastapi", "tmd ui")
    require("uvicorn", "tmd ui")

    from backend.app import create_app
    from backend.config import Settings

    import uvicorn

    chosen = _find_free_port(host, port)
    settings = Settings(host=host, port=chosen)
    app = create_app(settings)
    
    target_url = f"http://{host}:{chosen}"

    if browser:
        threading.Timer(
            1.0, lambda: webbrowser.open(target_url)
        ).start()
    console.print(
        f"[green]tokens.md UI[/green] -> {target_url} "
        f"(API: http://{host}:{chosen}/api, docs: http://{host}:{chosen}/docs)"
    )
    uvicorn.run(
        "backend.app:create_app",
        factory=True,
        host=host,
        port=chosen,
        log_level="info",
        reload=True,
    )


def main() -> None:
    """Entry point for the ``tmd`` console script and ``python src/main.py``."""
    try:
        app()
    except MissingDependencyError as exc:
        console.print(f"[red]{exc}[/red]")
        raise SystemExit(1)


if __name__ == "__main__":
    main()