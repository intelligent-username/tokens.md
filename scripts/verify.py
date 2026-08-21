"""Verify version alignment between Git tag and pyproject.toml.

If a Git release tag is present and does not match pyproject.toml,
pyproject.toml and internal package files are updated to match the tag.
"""

import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def get_pyproject_version() -> str:
    pyproject_file = ROOT / "pyproject.toml"
    content = pyproject_file.read_text(encoding="utf-8")
    match = re.search(r'version\s*=\s*["\']([^"\']+)["\']', content)
    if not match:
        raise ValueError("Could not find version in pyproject.toml")
    return match.group(1)


def set_pyproject_version(new_version: str) -> None:
    pyproject_file = ROOT / "pyproject.toml"
    content = pyproject_file.read_text(encoding="utf-8")
    updated = re.sub(r'version\s*=\s*["\']([^"\']+)["\']', f'version = "{new_version}"', content, count=1)
    pyproject_file.write_text(updated, encoding="utf-8")
    print(f"Updated pyproject.toml version to: {new_version}")


def sync_internal_versions(version: str) -> None:
    # 1. src/__init__.py
    init_file = ROOT / "src" / "__init__.py"
    if init_file.exists():
        init_text = init_file.read_text(encoding="utf-8")
        init_text = re.sub(r'__version__\s*=\s*["\']([^"\']+)["\']', f'__version__ = "{version}"', init_text)
        init_file.write_text(init_text, encoding="utf-8")
        print(f"Synced {init_file.relative_to(ROOT)} -> {version}")

    # 2. frontend/package.json
    frontend_pkg = ROOT / "frontend" / "package.json"
    if frontend_pkg.exists():
        pkg_text = frontend_pkg.read_text(encoding="utf-8")
        pkg_text_updated = re.sub(r'("version"\s*:\s*)"[^"]+"', rf'\g<1>"{version}"', pkg_text)
        if pkg_text != pkg_text_updated:
            frontend_pkg.write_text(pkg_text_updated, encoding="utf-8")
            print(f"Synced {frontend_pkg.relative_to(ROOT)} -> {version}")


def main() -> None:
    # Extract tag if provided as argument or via GITHUB_REF environment variable
    tag_input = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("GITHUB_REF", "")

    tag_version = ""
    if tag_input:
        # Match v1.2.3, refs/tags/v1.2.3, or 1.2.3
        match = re.search(r"(\d+\.\d+\.\d+(?:[-.][a-zA-Z0-9]+)?)", tag_input)
        if match:
            tag_version = match.group(1)

    pyproject_version = get_pyproject_version()
    print(f"pyproject.toml version: {pyproject_version}")

    if tag_version:
        print(f"Git release tag version: {tag_version}")
        if tag_version != pyproject_version:
            print(f"::warning title=Version Mismatch::Git tag ({tag_version}) != pyproject.toml ({pyproject_version}). Updating pyproject.toml to match tag.")
            set_pyproject_version(tag_version)
            sync_internal_versions(tag_version)
        else:
            print("Git tag and pyproject.toml versions are aligned.")
            sync_internal_versions(pyproject_version)
    else:
        print("No Git release tag provided. Verifying internal file alignment...")
        sync_internal_versions(pyproject_version)

    # Run sync_version to ensure full repository alignment
    try:
        from scripts.sync_version import main as sync_manifests
    except ImportError:
        from sync_version import main as sync_manifests
    sync_manifests()


if __name__ == "__main__":
    main()
