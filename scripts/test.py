#!/usr/bin/env python3
"""Parallel test runner for tokens.md backend (pytest) and frontend (vitest).

Runs both test suites in parallel and prints a unified coverage summary table.
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
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = ROOT_DIR / "frontend"
TEMP_ROOT = ROOT_DIR / "temp"
TEMP_DIR = TEMP_ROOT / "tests"


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
    """Run backend + frontend test suites in parallel and print a coverage summary table."""
    cyan = "\033[36m"
    green = "\033[32m"
    red = "\033[31m"
    yellow = "\033[33m"
    bold = "\033[1m"
    reset = "\033[0m"
    dim = "\033[2m"

    print(f"\n{bold}Running test suites…{reset}")

    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            f_be = executor.submit(_run_backend_tests)
            f_fe = executor.submit(_run_frontend_tests)
            be_code, be_out, be_err = f_be.result()
            fe_code, fe_out, fe_err = f_fe.result()

        be_combined = be_out + "\n" + be_err
        fe_combined = fe_out + "\n" + fe_err

        be_pct = _parse_coverage_pct(be_combined)
        fe_pct = _parse_coverage_pct(fe_combined)

        def _suite_icon(code: int) -> str:
            return f"{green}✓{reset}" if code == 0 else f"{red}✗{reset}"

        def _pct_display(pct: str | None) -> str:
            if pct is None:
                return f"{dim}n/a{reset}"
            num = int(pct.rstrip("%"))
            colour = green if num >= 80 else yellow if num >= 60 else red
            return f"{colour}{bold}{pct}{reset}"

        print()
        print(f"  {bold}{'Suite':<14}{'Status':<10}Coverage{reset}")
        print(f"  {'─' * 36}")
        print(f"  {'Backend (pytest)':<14}{_suite_icon(be_code):<17}{_pct_display(be_pct)}")
        print(f"  {'Frontend (vitest)':<14}{_suite_icon(fe_code):<17}{_pct_display(fe_pct)}")
        print(f"  {'─' * 36}")
        print(f"  {dim}Backend:  src/ + backend/   |   Frontend: lib/api/ + lib/errors.ts{reset}")
        print()

        if verbose:
            if be_out.strip():
                print(f"{bold}=== Backend test output ==={reset}")
                print(be_out.strip())
            if fe_out.strip():
                print(f"\n{bold}=== Frontend test output ==={reset}")
                print(fe_out.strip())

        overall = max(be_code, fe_code)
        if overall != 0:
            print(f"{red}One or more test suites failed.{reset}")
            if not verbose:
                print(f"▫ Run {cyan}tmd test -v{reset} for full output.")
        else:
            print(f"{green}✓ All tests passed.{reset}")

        return overall
    finally:
        _cleanup_coverage_files()


def main() -> None:
    parser = argparse.ArgumentParser(description="Parallel test runner with coverage summary.")
    parser.add_argument("-v", "--v", "--verbose", dest="verbose", action="store_true", help="Show full test output.")
    args = parser.parse_args()
    sys.exit(run_tests(verbose=args.verbose))


if __name__ == "__main__":
    main()
