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


def _run_cmd(cmd: list[str], cwd: Path, env: dict[str, str] | None = None) -> tuple[int, str, str]:
    """Execute a command and return (exit_code, stdout, stderr)."""
    executable_cmd = list(cmd)
    if os.name == "nt" and executable_cmd[0] in {"npm", "npx"}:
        executable_cmd[0] = f"{executable_cmd[0]}.cmd"

    try:
        res = subprocess.run(
            executable_cmd,
            cwd=str(cwd),
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            env=env,
        )
        return res.returncode, res.stdout, res.stderr
    except Exception as exc:
        return 1, "", str(exc)


def _run_backend_tests() -> tuple[int, str, str]:
    """Run pytest with coverage, storing temp .coverage in scripts/tests/temp/. Returns (exit_code, stdout, stderr)."""
    TEMP_DIR.mkdir(parents=True, exist_ok=True)
    cov_file = TEMP_DIR / ".coverage"

    env = os.environ.copy()
    env["COVERAGE_FILE"] = str(cov_file)

    cmd = [sys.executable, "-m", "pytest", "--tb=short", "-q"]
    code, out, err = _run_cmd(cmd, ROOT_DIR, env=env)
    return code, out, err


def _run_frontend_tests() -> tuple[int, str, str]:
    """Run vitest --run --coverage. Returns (exit_code, stdout, stderr)."""
    if not FRONTEND_DIR.exists():
        return 0, "", ""
    npm = "npm.cmd" if os.name == "nt" else "npm"
    cmd = [npm, "run", "test:coverage"]
    code, out, err = _run_cmd(cmd, FRONTEND_DIR)
    return code, out, err


def _parse_coverage_pct(output: str) -> str | None:
    """Extract an overall coverage percentage from pytest-cov or vitest coverage output."""
    clean = _strip_ansi(output)

    for line in clean.splitlines():
        m = re.search(r"^TOTAL\s+\d+\s+\d+.*?(\d+)%", line)
        if m:
            return f"{m.group(1)}%"

    for line in clean.splitlines():
        m = re.match(r"\s*All files\s*\|\s*([\d.]+)\s*\|", line)
        if m:
            return f"{float(m.group(1)):.0f}%"

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


def run_tests(verbose: bool = False) -> int:
    """Run backend + frontend test suites in parallel with live progress bars and print coverage summary."""
    console.print("\n[bold]Running test suites in parallel…[/bold]\n")

    be_res: list[tuple[int, str, str] | None] = [None]
    fe_res: list[tuple[int, str, str] | None] = [None]

    try:
        with Progress(
            SpinnerColumn(spinner_name="dots"),
            TextColumn("{task.description}"),
            BarColumn(bar_width=22, style="dim", complete_style="bold green"),
            TaskProgressColumn(),
            console=console,
            transient=False,
        ) as progress:
            t_be = progress.add_task("[bold cyan]⟳[/bold cyan] [bright_white]Backend (pytest)[/bright_white]", total=100)
            t_fe = progress.add_task("[bold cyan]⟳[/bold cyan] [bright_white]Frontend (vitest)[/bright_white]", total=100)

            def _ticker_be():
                step = 10
                while be_res[0] is None and step < 90:
                    time.sleep(0.1)
                    if be_res[0] is not None:
                        break
                    step += 5
                    progress.update(t_be, completed=step)

            def _ticker_fe():
                step = 10
                while fe_res[0] is None and step < 90:
                    time.sleep(0.1)
                    if fe_res[0] is not None:
                        break
                    step += 5
                    progress.update(t_fe, completed=step)

            with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
                executor.submit(_ticker_be)
                executor.submit(_ticker_fe)
                f_be = executor.submit(_run_backend_tests)
                f_fe = executor.submit(_run_frontend_tests)
                be_res[0] = f_be.result()
                fe_res[0] = f_fe.result()

            be_code, be_out, be_err = be_res[0]  # type: ignore[misc]
            fe_code, fe_out, fe_err = fe_res[0]  # type: ignore[misc]

            be_combined = be_out + "\n" + be_err
            fe_combined = fe_out + "\n" + fe_err

            be_pct = _parse_coverage_pct(be_combined)
            fe_pct = _parse_coverage_pct(fe_combined)

            be_icon = "[bold green]✓[/bold green]" if be_code == 0 else "[bold red]✗[/bold red]"
            fe_icon = "[bold green]✓[/bold green]" if fe_code == 0 else "[bold red]✗[/bold red]"

            be_desc = f"{be_icon} [bright_white]Backend (pytest)[/bright_white] [dim cyan]({be_pct or 'n/a'})[/dim cyan]"
            fe_desc = f"{fe_icon} [bright_white]Frontend (vitest)[/bright_white] [dim cyan]({fe_pct or 'n/a'})[/dim cyan]"

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

        overall = max(be_code, fe_code)
        if overall != 0:
            console.print("[bold red]One or more test suites failed.[/bold red]")
            if not verbose:
                console.print("▫ Run [bold cyan]tmd test -v[/bold cyan] for full output.")
        else:
            console.print("[bold green]✓ All tests passed.[/bold green]")

        return overall
    finally:
        _cleanup_coverage_files()


def main() -> None:
    parser = argparse.ArgumentParser(description="Parallel test runner with live progress bars.")
    parser.add_argument("-v", "--v", "--verbose", dest="verbose", action="store_true", help="Show full test output.")
    args = parser.parse_args()
    sys.exit(run_tests(verbose=args.verbose))


if __name__ == "__main__":
    main()
