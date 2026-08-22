#!/usr/bin/env python3
"""Parallel test runner for tokens.md backend (pytest) and frontend (vitest).

Runs both test suites in parallel with live progress bars and prints a unified coverage summary table.
Exit code is non-zero if any suite fails.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import os
import re
import shutil
import subprocess
import sys
import time
from collections.abc import Callable
from pathlib import Path

from rich.console import Console
from rich.progress import BarColumn, Progress, SpinnerColumn, TaskProgressColumn, TextColumn

ROOT_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = ROOT_DIR / "frontend"
TEMP_ROOT = ROOT_DIR / "temp"
TEMP_DIR = TEMP_ROOT / "tests"

console = Console(soft_wrap=False)


def _strip_ansi(text: str) -> str:
    """Strip ANSI color and formatting escape codes from text."""
    return re.sub(r"\x1b\[[0-9;]*[a-zA-Z]", "", text)


def _run_streaming_cmd(cmd: list[str], cwd: Path, env: dict[str, str] | None = None, on_line: Callable[[str], None] | None = None) -> tuple[int, str, str]:
    """Execute a command, streaming stdout lines in real time to a callback."""
    executable_cmd = list(cmd)
    if os.name == "nt" and executable_cmd[0] in {"npm", "npx", "pnpm"}:
        executable_cmd[0] = f"{executable_cmd[0]}.cmd"

    stdout_lines: list[str] = []
    stderr_lines: list[str] = []

    try:
        import threading

        proc = subprocess.Popen(executable_cmd, cwd=str(cwd), stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding="utf-8", errors="replace", env=env, bufsize=1)

        def _read_stream(stream, accumulator, is_stdout=True):
            if stream is None:
                return
            for line in iter(stream.readline, ""):
                accumulator.append(line)
                if is_stdout and on_line is not None:
                    on_line(line)
            stream.close()

        t_out = threading.Thread(target=_read_stream, args=(proc.stdout, stdout_lines, True))
        t_err = threading.Thread(target=_read_stream, args=(proc.stderr, stderr_lines, False))
        t_out.start()
        t_err.start()
        t_out.join()
        t_err.join()
        proc.wait()

        return proc.returncode, "".join(stdout_lines), "".join(stderr_lines)
    except Exception as exc:
        return 1, "", str(exc)


def _run_backend_tests(on_progress: Callable[[int], None] | None = None, on_finished: Callable[[int, str | None], None] | None = None, coverage: bool = False) -> tuple[int, str, str]:
    """Run pytest with live streaming progress updates."""
    TEMP_DIR.mkdir(parents=True, exist_ok=True)
    cov_file = TEMP_DIR / ".coverage"

    env = os.environ.copy()
    env["COVERAGE_FILE"] = str(cov_file)
    env["PYTHONUNBUFFERED"] = "1"

    total_tests = 256
    completed_tests = 0

    if coverage:
        cmd = [sys.executable, "-u", "-m", "pytest", "--cov=src", "--cov=backend", "--cov-report=", "--tb=short", "-v"]
    else:
        cmd = [sys.executable, "-u", "-m", "pytest", "--tb=short", "-v"]

    def _handle_line(line: str) -> None:
        nonlocal completed_tests
        if on_progress is None:
            return
        clean = _strip_ansi(line)
        m = re.search(r"\[\s*(\d+)%\]", clean)
        if m:
            on_progress(min(99, int(m.group(1))))
        elif "PASSED" in clean or "FAILED" in clean or "SKIPPED" in clean:
            completed_tests += 1
            pct = min(99, int((completed_tests / total_tests) * 100))
            on_progress(pct)

    code, out, err = _run_streaming_cmd(cmd, ROOT_DIR, env=env, on_line=_handle_line)
    if on_finished is not None:
        pct = _parse_coverage_pct(out + "\n" + err) if coverage else None
        on_finished(code, pct)
    return code, out, err


def _run_frontend_tests(on_progress: Callable[[int, str | None], None] | None = None, on_finished: Callable[[int, str | None], None] | None = None, coverage: bool = False) -> tuple[int, str, str]:
    """Run vitest unit tests followed by vitest E2E workflow tests with live streaming progress updates."""
    if not FRONTEND_DIR.exists():
        if on_finished is not None:
            on_finished(0, "n/a")
        return 0, "", ""

    env = os.environ.copy()
    env["CI"] = "1"
    env["FORCE_COLOR"] = "1"
    env["VITE_CONFIG_NATIVE_IGNORE_WARNING"] = "true"

    runner_bin = "pnpm" if shutil.which("pnpm") else "npm"

    # 1. Unit tests (0-50% of progress)
    unit_files = [p for p in FRONTEND_DIR.glob("lib/**/__tests__/**/*.test.ts") if "node_modules" not in p.parts and ".next" not in p.parts]
    total_unit = max(1, len(unit_files))
    completed_unit = 0

    def _handle_unit_line(line: str) -> None:
        nonlocal completed_unit
        if on_progress is None:
            return
        clean = _strip_ansi(line)
        if re.search(r"[✓❯×]\s+.*\.test\.ts", clean):
            completed_unit += 1
            pct = min(50, int((completed_unit / total_unit) * 50))
            on_progress(pct, "unit")

    unit_cmd = [runner_bin, "run", "test:coverage"] if coverage else [runner_bin, "run", "test"]
    unit_code, unit_out, unit_err = _run_streaming_cmd(unit_cmd, FRONTEND_DIR, env=env, on_line=_handle_unit_line)

    # 2. E2E tests (50-99% of progress)
    e2e_dir = FRONTEND_DIR / "e2e"
    e2e_files = list(e2e_dir.glob("**/*.test.ts")) if e2e_dir.exists() else []
    total_e2e = max(1, len(e2e_files))
    completed_e2e = 0

    def _handle_e2e_line(line: str) -> None:
        nonlocal completed_e2e
        if on_progress is None:
            return
        clean = _strip_ansi(line)
        if re.search(r"[✓❯×]\s+.*\.test\.ts", clean):
            completed_e2e += 1
            pct = min(99, 50 + int((completed_e2e / total_e2e) * 49))
            on_progress(pct, "e2e")

    e2e_cmd = [runner_bin, "run", "test:e2e"]
    e2e_code, e2e_out, e2e_err = _run_streaming_cmd(e2e_cmd, FRONTEND_DIR, env=env, on_line=_handle_e2e_line)

    code = max(unit_code, e2e_code)
    combined_out = unit_out + ("\n=== Frontend E2E Tests ===\n" + e2e_out if e2e_out else "")
    combined_err = unit_err + ("\n" + e2e_err if e2e_err else "")

    if on_finished is not None:
        pct = _parse_coverage_pct(unit_out + "\n" + unit_err) if coverage else None
        on_finished(code, pct)

    return code, combined_out, combined_err


def _parse_coverage_pct(output: str) -> str | None:
    """Extract an overall coverage percentage from pytest-cov or vitest coverage output."""
    clean = _strip_ansi(output)

    # 1. Direct summary line: "Total Coverage: 76%"
    m = re.search(r"Total Coverage:\s*(\d+)%", clean, re.IGNORECASE)
    if m:
        return f"{m.group(1)}%"

    # 2. Pytest-cov classic table TOTAL row
    m = re.search(r"\bTOTAL\s+\d+\s+\d+\s+(\d+)%", clean)
    if m:
        return f"{m.group(1)}%"

    for line in clean.splitlines():
        m = re.search(r"\bTOTAL\b.*?(\d+)%", line)
        if m:
            return f"{m.group(1)}%"

    # 3. Vitest coverage table: "All files | 97.06 | ..."
    for line in clean.splitlines():
        m = re.match(r"\s*All files\s*\|\s*([\d.]+)\s*\|", line)
        if m:
            return f"{float(m.group(1)):.0f}%"

    # 4. Vitest summary block: "Lines : 97.06%"
    for line in clean.splitlines():
        m = re.search(r"Lines\s*:\s*([\d.]+)%", line, re.IGNORECASE)
        if m:
            return f"{float(m.group(1)):.0f}%"

    return None


def _cleanup_coverage_files() -> None:
    """Clean up temporary coverage files and directories after test execution."""
    for cov_path in [TEMP_DIR / ".coverage", ROOT_DIR / ".coverage"]:
        if cov_path.exists():
            try:
                cov_path.unlink()
            except OSError:
                pass

    if TEMP_ROOT.exists():
        try:
            shutil.rmtree(TEMP_ROOT, ignore_errors=True)
        except OSError:
            pass


def run_tests(verbose: bool = False, coverage: bool = False) -> int:
    """Run backend + frontend test suites in parallel with live progress bars, falling back to sequential on single-core systems."""
    start_time = time.perf_counter()
    cores = os.cpu_count() or 1
    can_parallelize = cores > 1

    if can_parallelize:
        console.print("\n[bold]Running test suites in parallel…[/bold]\n")
    else:
        console.print("\n[bold]Running test suites sequentially (single-core environment)…[/bold]\n")

    try:
        with Progress(SpinnerColumn(spinner_name="dots"), TextColumn("{task.description}"), BarColumn(bar_width=22, style="dim", complete_style="bold green"), TaskProgressColumn(), console=console, transient=False) as progress:
            t_be = progress.add_task("[bold cyan]⟳[/bold cyan] [bright_white]Backend (pytest)[/bright_white]", total=100)
            t_fe = progress.add_task("[bold cyan]⟳[/bold cyan] [bright_white]Frontend (vitest)[/bright_white]", total=100)

            def _update_be(pct: int) -> None:
                progress.update(t_be, completed=pct)
                progress.refresh()

            def _update_fe(pct: int, phase: str | None = None) -> None:
                desc = "[bold cyan]⟳[/bold cyan] [bright_white]Frontend (e2e)[/bright_white]" if phase == "e2e" else "[bold cyan]⟳[/bold cyan] [bright_white]Frontend (vitest)[/bright_white]"
                progress.update(t_fe, completed=pct, description=desc)
                progress.refresh()

            def _finish_be(code: int, pct: str | None) -> None:
                icon = "[bold green]✓[/bold green]" if code == 0 else "[bold red]✗[/bold red]"
                cov_str = f" [dim cyan]({pct})[/dim cyan]" if (coverage and pct) else ""
                desc = f"{icon} [bright_white]Backend (pytest)[/bright_white]{cov_str}"
                progress.update(t_be, completed=100, description=desc)
                progress.refresh()

            def _finish_fe(code: int, pct: str | None) -> None:
                icon = "[bold green]✓[/bold green]" if code == 0 else "[bold red]✗[/bold red]"
                cov_str = f" [dim cyan]({pct})[/dim cyan]" if (coverage and pct) else ""
                desc = f"{icon} [bright_white]Frontend (vitest)[/bright_white]{cov_str}"
                progress.update(t_fe, completed=100, description=desc)
                progress.refresh()

            if can_parallelize:
                try:
                    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
                        f_be = executor.submit(_run_backend_tests, _update_be, _finish_be, coverage)
                        f_fe = executor.submit(_run_frontend_tests, _update_fe, _finish_fe, coverage)
                        concurrent.futures.wait([f_be, f_fe])
                        be_code, be_out, be_err = f_be.result()
                        fe_code, fe_out, fe_err = f_fe.result()
                except Exception:
                    be_code, be_out, be_err = _run_backend_tests(_update_be, _finish_be, coverage)
                    fe_code, fe_out, fe_err = _run_frontend_tests(_update_fe, _finish_fe, coverage)
            else:
                be_code, be_out, be_err = _run_backend_tests(_update_be, _finish_be, coverage)
                fe_code, fe_out, fe_err = _run_frontend_tests(_update_fe, _finish_fe, coverage)

            be_combined = be_out + "\n" + be_err
            fe_combined = fe_out + "\n" + fe_err

            be_icon = "[bold green]✓[/bold green]" if be_code == 0 else "[bold red]✗[/bold red]"
            fe_icon = "[bold green]✓[/bold green]" if fe_code == 0 else "[bold red]✗[/bold red]"

            if coverage:
                be_pct = _parse_coverage_pct(be_combined)
                fe_pct = _parse_coverage_pct(fe_combined)
                be_desc = f"{be_icon} [bright_white]Backend (pytest)[/bright_white] [dim cyan]({be_pct or 'n/a'})[/dim cyan]"
                fe_desc = f"{fe_icon} [bright_white]Frontend (vitest)[/bright_white] [dim cyan]({fe_pct or 'n/a'})[/dim cyan]"
            else:
                be_desc = f"{be_icon} [bright_white]Backend (pytest)[/bright_white]"
                fe_desc = f"{fe_icon} [bright_white]Frontend (vitest)[/bright_white]"

            progress.update(t_be, completed=100, description=be_desc)
            progress.update(t_fe, completed=100, description=fe_desc)

        console.print()

        if verbose:
            if be_combined.strip():
                console.print("[bold]=== Backend test output ===[/bold]")
                console.print(be_combined.strip())
            if fe_combined.strip():
                console.print("\n[bold]=== Frontend test output ===[/bold]")
                console.print(fe_combined.strip())

        elapsed = time.perf_counter() - start_time
        overall = max(be_code, fe_code)
        if overall != 0:
            console.print(f"[bold red]One or more test suites failed in {elapsed:.2f}s.[/bold red]")
            if not verbose:
                console.print("▫ Run [bold cyan]tmd test -v[/bold cyan] for full output.")
        else:
            console.print(f"[bold green]✓ All tests passed in {elapsed:.2f}s.[/bold green]")

        return overall
    finally:
        _cleanup_coverage_files()


def main() -> None:
    parser = argparse.ArgumentParser(description="Parallel test runner with live progress bars.")
    parser.add_argument("-v", "--v", "--verbose", dest="verbose", action="store_true", help="Show full test output.")
    parser.add_argument("--cov", "--coverage", dest="coverage", action="store_true", help="Run with test coverage.")
    args = parser.parse_args()
    sys.exit(run_tests(verbose=args.verbose, coverage=args.coverage))


if __name__ == "__main__":
    main()
