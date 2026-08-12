"""Execution engine for file conversion with multithreaded progress monitoring."""

from __future__ import annotations

import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import typer
from rich.progress import BarColumn, Progress, SpinnerColumn, TaskProgressColumn, TextColumn

from ..file_selector import select_files
from ..registry import UnsupportedFormatError, convert_file
from ..tokenizer import DEFAULT_ENCODING, count_raw_file_tokens, count_tokens, delta_percent, format_tokens
from .constants import EXIT_CODE_ERROR, PROGRESS_BAR_COMPLETE_STYLE, PROGRESS_BAR_STYLE
from .theme import console
from .utils import _convert_kwargs, _default_extensions, _parse_extensions, _resolve_output_dir, _truncate_desc


def convert_impl(source: str = "input", output: str = "output", loc: str | None = None, recursive: bool = False, extensions: str | None = None, strip_headers_footers: bool = False, write_images: bool = False, image_path: str | None = None, pages: str | None = None, clip: bool = False) -> None:
    """Convert files to Markdown."""
    output_dir = _resolve_output_dir(output, loc)
    files = select_files(source, extensions=_parse_extensions(extensions if extensions is not None else _default_extensions()), recursive=recursive)
    if not files:
        typer.echo(f"No matching files found in {source!r}.")
        raise typer.Exit(code=EXIT_CODE_ERROR)

    kwargs = _convert_kwargs(strip_headers_footers, write_images, image_path, pages)

    with Progress(SpinnerColumn(spinner_name="dots"), TextColumn("{task.description}"), BarColumn(bar_width=22, style=PROGRESS_BAR_STYLE, complete_style=PROGRESS_BAR_COMPLETE_STYLE), TaskProgressColumn(), console=console, transient=False) as progress:
        task_map = {}
        for path in files:
            label = _truncate_desc(f"Converting {path.name}", 44)
            task_map[path] = progress.add_task(f"[bold cyan]⟳[/bold cyan] [bright_white]{label}[/bright_white]", total=100)

        def _convert_file_worker(path: Path):
            t_id = task_map[path]
            stop_event = threading.Event()

            def _smooth_ticker():
                step = 10
                while not stop_event.is_set() and step < 90:
                    stop_event.wait(0.1)
                    if stop_event.is_set():
                        break
                    step += 5
                    progress.update(t_id, completed=step)

            ticker = threading.Thread(target=_smooth_ticker, daemon=True)
            ticker.start()

            try:
                out = convert_file(path, output_dir, **kwargs)
                markdown = out.read_text(encoding="utf-8", errors="replace")
                source_tokens = count_raw_file_tokens(path)
                target_tokens = count_tokens(markdown, DEFAULT_ENCODING)

                stop_event.set()
                ticker.join(timeout=0.2)

                flow_str = _truncate_desc(f"Converted {path.name} -> {out.name}", 44)
                tok_str = f"({format_tokens(source_tokens)} → {format_tokens(target_tokens)} tokens)"
                desc = f"[bold green]✓[/bold green] [bright_white]{flow_str}[/bright_white] [dim cyan]{tok_str}[/dim cyan]"
                progress.update(t_id, completed=100, description=desc)
                return (path, out, markdown, source_tokens, target_tokens, None)
            except UnsupportedFormatError as exc:
                stop_event.set()
                ticker.join(timeout=0.2)
                err_str = _truncate_desc(f"Skipped {path.name}", 44)
                desc = f"[bold yellow]⚠[/bold yellow] [yellow]{err_str}[/yellow] [dim]{exc}[/dim]"
                progress.update(t_id, completed=100, description=desc)
                return (path, None, None, 0, 0, exc)

        with ThreadPoolExecutor() as executor:
            future_map = {executor.submit(_convert_file_worker, path): path for path in files}
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
    for _path, out, markdown, source_tokens, target_tokens, exc in results:
        if exc is not None:
            failures += 1
        elif out is not None and markdown is not None:
            combined.append(markdown)
            converted_count += 1
            total_source += source_tokens
            total_target += target_tokens

    if clip and combined:
        from ..clipboard import copy_to_clipboard

        copy_to_clipboard("\n\n".join(combined))
        console.print(f"[cyan]Copied[/cyan] {len(combined)} file(s) to clipboard.")

    if converted_count:
        pct = delta_percent(total_source, total_target)
        console.print(f"[bold]TOTAL[/bold] ({format_tokens(total_source)} tokens) -> ({format_tokens(total_target)} tokens) [{pct:+.1f}%]")

    if failures:
        raise typer.Exit(code=EXIT_CODE_ERROR)
