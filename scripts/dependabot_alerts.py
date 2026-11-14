"""Summarize GitHub Dependabot alerts using the authenticated GitHub CLI."""

import argparse
import json
import subprocess
import sys
from collections import Counter


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", help="GitHub repository in OWNER/REPO format")
    parser.add_argument(
        "--state",
        choices=("open", "dismissed", "fixed", "auto_dismissed", "all"),
        default="open",
    )
    args = parser.parse_args()

    repo = args.repo or "{owner}/{repo}"
    endpoint = f"repos/{repo}/dependabot/alerts?per_page=100"
    if args.state != "all":
        endpoint += f"&state={args.state}"
    try:
        result = subprocess.run(
            ["gh", "api", "--paginate", "--slurp", endpoint],
            capture_output=True,
            text=True,
            encoding="utf-8",
            check=True,
        )
    except FileNotFoundError:
        print("GitHub CLI (gh) was not found. Install and authenticate it first.", file=sys.stderr)
        return 1
    except subprocess.CalledProcessError as exc:
        print(f"Could not fetch Dependabot alerts: {exc.stderr.strip()}", file=sys.stderr)
        return 1

    pages = json.loads(result.stdout)
    alerts = [alert for page in pages for alert in page]
    print(f"Dependabot alerts ({args.state}): {len(alerts)}")
    for label, counts in (
        ("Severity", Counter(a["security_advisory"]["severity"] for a in alerts)),
        ("State", Counter(a["state"] for a in alerts)),
        ("Ecosystem", Counter(a["dependency"]["package"]["ecosystem"] for a in alerts)),
        ("Package", Counter(a["dependency"]["package"]["name"] for a in alerts)),
    ):
        print(f"\n{label}:")
        for name, count in counts.most_common():
            print(f"  {name}: {count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
