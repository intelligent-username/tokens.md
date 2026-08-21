"""Execution engine for file conversion with multithreaded progress monitoring."""

from __future__ import annotations

import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import typer
from rich.progress import BarColumn, Progress, SpinnerColumn, TaskProgressColumn, TextColumn

from ..budget import format_prune_report, prune_to_budget
from ..file_selector import select_files
from ..merger import merge_files
from ..registry import UnsupportedFormatError, convert_file
from ..tokenizer import DEFAULT_ENCODING, count_raw_file_tokens, count_tokens, delta_percent, format_tokens
from .constants import EXIT_CODE_ERROR, PROGRESS_BAR_COMPLETE_STYLE, PROGRESS_BAR_STYLE
from .theme import console
from .utils import _convert_kwargs, _default_extensions, _parse_extensions, _resolve_output_dir, _truncate_desc


def convert_impl(
    source: str | list[str] = "input",
    output: str = "output",
    loc: str | None = None,
    recursive: bool = False,
    extensions: str | None = None,
    strip_headers_footers: bool = False,
    write_images: bool = False,
    image_path: str | None = None,
    pages: str | None = None,
    clip: bool = False,
    merge: bool = False,
    budget: int | None = None,
) -> None:
    """Convert files to Markdown, with optional merging and token budgeting."""
    output_dir = Path(output) if clip else _resolve_output_dir(output, loc)
    files = select_files(source, extensions=_parse_extensions(extensions if extensions is not None else _default_extensions()), recursive=recursive)
    if not files:
        typer.echo(f"No matching files found in {source!r}.")
        raise typer.Exit(code=EXIT_CODE_ERROR)

    kwargs = _convert_kwargs(strip_headers_footers, write_images, image_path, pages)

    # When merging or copying directly to clipboard, convert into a temporary
    # directory so no files are left behind on disk.
    import tempfile

    convert_dir = tempfile.TemporaryDirectory(prefix="tmd_convert_") if (merge or clip) else None

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
                target_dir = Path(convert_dir.name) if convert_dir is not None else output_dir
                out = convert_file(path, target_dir, **kwargs)
                markdown = out.read_text(encoding="utf-8", errors="replace")

                if budget is not None and not merge:
                    result = prune_to_budget(markdown, budget, DEFAULT_ENCODING)
                    out.write_text(result.content, encoding="utf-8")
                    markdown = result.content

                source_tokens = count_raw_file_tokens(path)
                target_tokens = count_tokens(markdown, DEFAULT_ENCODING)

                stop_event.set()
                ticker.join(timeout=0.2)

                flow_str = _truncate_desc(f"Converted {path.name}", 44) if clip else _truncate_desc(f"Converted {path.name} -> {out.name}", 44)
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
    successful_paths: list[Path] = []
    converted_outputs: list[Path] = []
    for path, out, markdown, source_tokens, target_tokens, exc in results:
        if exc is not None:
            failures += 1
        elif out is not None and markdown is not None:
            combined.append(markdown)
            converted_count += 1
            total_source += source_tokens
            total_target += target_tokens
            successful_paths.append(path)
            converted_outputs.append(out)

    if merge and successful_paths:
        if clip:
            assert convert_dir is not None
            merged_path = Path(convert_dir.name) / "merged.md"
            merge_files(converted_outputs, merged_path, no_convert=True, encoding=DEFAULT_ENCODING, include_tokens=budget is not None, **kwargs)
            if budget is not None:
                result = prune_to_budget(merged_path.read_text(encoding="utf-8"), budget, DEFAULT_ENCODING)
                merged_path.write_text(result.content, encoding="utf-8")
                console.print(format_prune_report(result, budget, DEFAULT_ENCODING))

            merged_text = merged_path.read_text(encoding="utf-8", errors="replace")
            total_target = count_tokens(merged_text, DEFAULT_ENCODING)
            from ..clipboard import copy_to_clipboard

            copy_to_clipboard(merged_text)
            console.print(f"[green]Merged & copied[/green] {len(successful_paths)} file(s) to clipboard [dim cyan]({format_tokens(total_target)} tokens)[/dim cyan]")
        else:
            if output.endswith((".md", ".markdown")):
                merged_filename = Path(output).name
                merged_out_dir = _resolve_output_dir(str(Path(output).parent), loc)
                merged_path = merged_out_dir / merged_filename
            else:
                merged_path = output_dir / "merged.md"

            # Merge the already-converted .md files (no re-conversion) so the
            # intermediate files stay in the temp dir and are cleaned up below.
            merge_files(converted_outputs, merged_path, no_convert=True, encoding=DEFAULT_ENCODING, include_tokens=budget is not None, **kwargs)

            if budget is not None:
                result = prune_to_budget(merged_path.read_text(encoding="utf-8"), budget, DEFAULT_ENCODING)
                merged_path.write_text(result.content, encoding="utf-8")
                console.print(format_prune_report(result, budget, DEFAULT_ENCODING))

            merged_text = merged_path.read_text(encoding="utf-8", errors="replace")
            total_target = count_tokens(merged_text, DEFAULT_ENCODING)
            console.print(f"[green]Merged[/green] {len(successful_paths)} file(s) -> {merged_path} [dim cyan]({format_tokens(total_target)} tokens)[/dim cyan]")
    elif clip and combined:
        from ..clipboard import copy_to_clipboard

        copy_to_clipboard("\n\n".join(combined))
        console.print(f"[cyan]Copied[/cyan] {len(combined)} file(s) to clipboard.")

    if converted_count and not merge and not clip:
        pct = delta_percent(total_source, total_target)
        console.print(f"[bold]TOTAL[/bold] ({format_tokens(total_source)} tokens) -> ({format_tokens(total_target)} tokens) [{pct:+.1f}%]")

    if convert_dir is not None:
        convert_dir.cleanup()

    if failures:
        raise typer.Exit(code=EXIT_CODE_ERROR)
