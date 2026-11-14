"""Summarize GitHub CodeQL alerts using the authenticated GitHub CLI."""

import argparse
import base64
import binascii
import json
import subprocess
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote


def github_api(endpoint: str, *, paginate: bool = False) -> object:
    command = ["gh", "api"]
    if paginate:
        command.extend(["--paginate", "--slurp"])
    command.append(endpoint)
    result = subprocess.run(
        command, capture_output=True, text=True, encoding="utf-8", check=True
    )
    return json.loads(result.stdout)


def code_snippet(repo: str, instance: dict, cache: dict) -> dict:
    location = instance.get("location") or {}
    path = location.get("path")
    commit = instance.get("commit_sha")
    start = location.get("start_line")
    end = location.get("end_line") or start
    snippet = {"path": path, "start_line": start, "end_line": end, "commit": commit}
    if not path or not commit or not isinstance(start, int) or not isinstance(end, int):
        snippet["code"] = None
        snippet["error"] = "CodeQL did not provide a complete source location."
        return snippet

    key = (path, commit)
    if key not in cache:
        try:
            content = github_api(
                f"repos/{repo}/contents/{quote(path, safe='/')}?ref={quote(commit, safe='')}"
            )
            if content.get("encoding") != "base64" or "content" not in content:
                raise ValueError("GitHub did not return base64 file content")
            cache[key] = base64.b64decode(content["content"]).decode("utf-8").splitlines()
        except (subprocess.CalledProcessError, ValueError, UnicodeError, binascii.Error) as exc:
            cache[key] = f"Could not retrieve source at the analyzed commit: {exc}"
    lines = cache[key]
    if isinstance(lines, str):
        snippet["code"] = None
        snippet["error"] = lines
    elif start < 1 or end < start or end > len(lines):
        snippet["code"] = None
        snippet["error"] = "CodeQL's line range is outside the source file."
    else:
        snippet["code"] = "\n".join(lines[start - 1 : end])
    return snippet


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", help="GitHub repository in OWNER/REPO format")
    parser.add_argument(
        "--state", choices=("open", "dismissed", "fixed", "all"), default="open"
    )
    args = parser.parse_args()
    repo = args.repo or "{owner}/{repo}"
    endpoint = f"repos/{repo}/code-scanning/alerts?per_page=100&tool_name=CodeQL"
    if args.state != "all":
        endpoint += f"&state={args.state}"
    try:
        pages = github_api(endpoint, paginate=True)
        alerts = [alert for page in pages for alert in page]
        details = []
        source_cache = {}
        for alert in alerts:
            number = alert["number"]
            detail = github_api(f"repos/{repo}/code-scanning/alerts/{number}")
            rule = detail["rule"]
            instance = detail.get("most_recent_instance") or {}
            details.append(
                {
                    "number": number,
                    "title": rule.get("description"),
                    "description": {
                        "rule": rule.get("full_description"),
                        "finding": (instance.get("message") or {}).get("text"),
                    },
                    "code_snippet": code_snippet(repo, instance, source_cache),
                }
            )
    except FileNotFoundError:
        print("GitHub CLI (gh) was not found. Install and authenticate it first.", file=sys.stderr)
        return 1
    except subprocess.CalledProcessError as exc:
        print(f"Could not fetch CodeQL alerts: {exc.stderr.strip()}", file=sys.stderr)
        return 1

    output = Path(__file__).resolve().parent.parent / "output"
    output.mkdir(exist_ok=True)
    ignore = output / ".gitignore"
    if not ignore.exists():
        ignore.write_text("*\n", encoding="utf-8")
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    report = output / f"codeql-alerts-{timestamp}.json"
    with report.open("x", encoding="utf-8") as file:
        json.dump(details, file, indent=2, ensure_ascii=False)
        file.write("\n")
    print(f"Condensed alert report: {report}")
    print(f"CodeQL alerts ({args.state}): {len(alerts)}")
    groups = (
        ("Security severity", Counter((a["rule"].get("security_severity_level") or "not specified") for a in alerts)),
        ("Rule severity", Counter((a["rule"].get("severity") or "not specified") for a in alerts)),
        ("State", Counter(a["state"] for a in alerts)),
        ("Rule", Counter(a["rule"]["id"] for a in alerts)),
    )
    for label, counts in groups:
        print(f"\n{label}:")
        for name, count in counts.most_common():
            print(f"  {name}: {count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
