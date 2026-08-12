#!/usr/bin/env python3
"""Quiet, parallel linter & formatter runner for tokens.md backend (Ruff) and frontend (Prettier + ESLint)."""

from __future__ import annotations

import argparse
import concurrent.futures
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

try:
    from rich.console import Console
    from rich.live import Live

    console = Console()
except ImportError:
    console = None

ROOT_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = ROOT_DIR / "frontend"


def _strip_ansi(text: str) -> str:
    """Strip ANSI color and formatting escape codes from text."""
    return re.sub(r"\x1b\[[0-9;]*[a-zA-Z]", "", text)


def _run_cmd(cmd: list[str], cwd: Path) -> tuple[int, str, str]:
    """Execute a command quietly and return (exit_code, stdout, stderr)."""
    executable_cmd = list(cmd)
    if os.name == "nt" and executable_cmd[0] in {"npm", "npx"}:
        executable_cmd[0] = f"{executable_cmd[0]}.cmd"

    try:
        res = subprocess.run(executable_cmd, cwd=str(cwd), capture_output=True, text=True, encoding="utf-8", errors="replace")
        return res.returncode, res.stdout, res.stderr
    except Exception as exc:
        return 1, "", str(exc)


def _check_backend(fix: bool) -> tuple[int, int, int, int, str]:
    """Run Ruff checks on Python backend. Returns (files_count, error_count, warning_count, return_code, output)."""
    ruff_bin = shutil.which("ruff") or os.path.join(sys.prefix, "Scripts", "ruff.exe")
    base_cmd = [ruff_bin] if os.path.exists(ruff_bin) else [sys.executable, "-m", "ruff"]

    py_check = [*base_cmd, "check", str(ROOT_DIR)]
    py_format = [*base_cmd, "format", str(ROOT_DIR)]

    if fix:
        py_check.extend(["--fix", "--unsafe-fixes"])
        py_format = [*base_cmd, "format", str(ROOT_DIR)]
        _run_cmd(py_format, ROOT_DIR)
    else:
        py_format.append("--check")

    c1, out1, err1 = _run_cmd(py_check, ROOT_DIR)
    c2, out2, err2 = _run_cmd(py_format, ROOT_DIR)

    combined_out = f"{out1}\n{err1}\n{out2}\n{err2}".strip()
    clean_check = _strip_ansi(out1 + "\n" + err1)
    clean_format = _strip_ansi(out2 + "\n" + err2)

    check_lines = clean_check.splitlines()
    format_lines = clean_format.splitlines()

    file_paths = {line.split(":")[0].strip() for line in check_lines if ":" in line and ("error" in line.lower() or "warning" in line.lower())}
    reformat_files = {line.split()[1].strip() for line in format_lines if "would reformat" in line.lower() and len(line.split()) > 1}
    total_files = len(file_paths | reformat_files)

    warning_count = sum(1 for line in check_lines if "warning" in line.lower()) + len(reformat_files)
    error_count = sum(1 for line in check_lines if "error" in line.lower() or "error[" in line.lower())
    if error_count == 0 and c1 != 0 and total_files > 0:
        error_count = total_files

    effective_code = max(c1, c2)
    if total_files > 0:
        effective_code = max(effective_code, 1)

    return total_files, error_count, warning_count, effective_code, combined_out


def _check_frontend(fix: bool) -> tuple[int, int, int, int, str]:
    """Run Prettier & Next ESLint checks on frontend. Returns (files_count, error_count, warning_count, return_code, output)."""
    if not FRONTEND_DIR.exists():
        return 0, 0, 0, 0, ""

    prettier_flag = "--write" if fix else "--check"
    prettier_cmd = ["npx", "prettier", prettier_flag, "--ignore-path", ".prettierignore", "app", "components", "lib", "styles"]
    c1, out1, err1 = _run_cmd(prettier_cmd, FRONTEND_DIR)

    eslint_cmd = ["npm", "run", "lint"]
    if fix:
        eslint_cmd.extend(["--", "--fix"])
    c2, out2, err2 = _run_cmd(eslint_cmd, FRONTEND_DIR)

    combined_out = f"{out1}\n{err1}\n{out2}\n{err2}".strip()

    clean_prettier = _strip_ansi(out1 + "\n" + err1)
    clean_eslint = _strip_ansi(out2 + "\n" + err2)

    prettier_files = set()
    for line in clean_prettier.splitlines():
        line_str = line.strip()
        if line_str.startswith("[warn]") and not line_str.startswith("[warn] Code style issues"):
            filepath = line_str.replace("[warn]", "").strip()
            if filepath:
                prettier_files.add(filepath)

    eslint_lines = clean_eslint.splitlines()
    eslint_files = {line.strip() for line in eslint_lines if line.strip().startswith(("./", "app/", "components/", "lib/"))}

    all_files = prettier_files | eslint_files
    total_files = len(all_files)

    warning_count = len(prettier_files) + sum(1 for line in eslint_lines if "warning" in line.lower() or "Warning:" in line)
    error_count = sum(1 for line in eslint_lines if "error" in line.lower() or "Error:" in line)

    effective_code = max(c1, c2)
    if total_files > 0 or warning_count > 0 or error_count > 0:
        effective_code = max(effective_code, 1)

    return total_files, error_count, warning_count, effective_code, combined_out


def _format_status(name: str, files: int, errors: int, warns: int) -> str:
    if files == 0 and errors == 0 and warns == 0:
        return f"{name:<9} 0 files need improvement."

    file_str = f"{files} file" if files == 1 else f"{files} files"
    verb = "needs" if files == 1 else "need"

    details = []
    if errors > 0:
        details.append(f"{errors} error" if errors == 1 else f"{errors} errors")
    if warns > 0:
        details.append(f"{warns} warning" if warns == 1 else f"{warns} warnings")

    detail_str = f" ({' and '.join(details)})" if details else ""
    return f"{name:<9} {file_str} {verb} linting/formatting{detail_str}."


def run_linters(fix: bool = False, verbose: bool = False) -> int:
    """Run backend and frontend linters in parallel, updating lines in place."""
    status_lines = {"backend": "Backend:  Linting...", "frontend": "Frontend: Linting..."}

    def render_text() -> str:
        return f"\n{status_lines['backend']}\n{status_lines['frontend']}"

    try:
        if console:
            with Live(render_text(), console=console, refresh_per_second=10) as live, concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
                f_backend = executor.submit(_check_backend, fix)
                f_frontend = executor.submit(_check_frontend, fix)

                py_files, py_errs, py_warns, py_code, py_out = f_backend.result()
                status_lines["backend"] = _format_status("Backend:", py_files, py_errs, py_warns)
                live.update(render_text())

                fe_files, fe_errs, fe_warns, fe_code, fe_out = f_frontend.result()
                status_lines["frontend"] = _format_status("Frontend:", fe_files, fe_errs, fe_warns)
                live.update(render_text())
        else:
            print("\nBackend:  Linting...\nFrontend: Linting...")
            with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
                f_backend = executor.submit(_check_backend, fix)
                f_frontend = executor.submit(_check_frontend, fix)

                py_files, py_errs, py_warns, py_code, py_out = f_backend.result()
                fe_files, fe_errs, fe_warns, fe_code, fe_out = f_frontend.result()

            status_lines["backend"] = _format_status("Backend:", py_files, py_errs, py_warns)
            status_lines["frontend"] = _format_status("Frontend:", fe_files, fe_errs, fe_warns)
            print(render_text())
    except Exception:
        py_files, py_errs, py_warns, py_code, py_out = _check_backend(fix)
        fe_files, fe_errs, fe_warns, fe_code, fe_out = _check_frontend(fix)
        status_lines["backend"] = _format_status("Backend:", py_files, py_errs, py_warns)
        status_lines["frontend"] = _format_status("Frontend:", fe_files, fe_errs, fe_warns)
        print(render_text())

    if verbose:
        if py_out:
            print("\n=== Backend Output ===")
            print(py_out)
        if fe_out:
            print("\n=== Frontend Output ===")
            print(fe_out)

    cyan = "\033[36m"
    reset = "\033[0m"
    green = "\033[32m"

    if py_code != 0 or fe_code != 0:
        if not verbose or not fix:
            print()
        if not verbose:
            print(f"▫ Run {cyan}tmd lint -v{reset} for verbose output.")
        if not fix:
            print(f"▫ Run {cyan}tmd lint --fix{reset} to automatically fix issues.")
        return 1

    print(f"\n{green}✓ All backend and frontend linter checks passed!{reset}")
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Parallel quiet linter runner.")
    parser.add_argument("--fix", action="store_true", help="Automatically fix linter and formatting issues.")
    parser.add_argument("-v", "--v", "--verbose", dest="verbose", action="store_true", help="Show detailed verbose linter outputs.")
    args = parser.parse_args()
    sys.exit(run_linters(fix=args.fix, verbose=args.verbose))


if __name__ == "__main__":
    main()
