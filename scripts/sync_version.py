"""Sync version across pyproject.toml, src/__init__.py, and all manifests."""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def main() -> None:
    pyproject_file = ROOT / "pyproject.toml"
    content = pyproject_file.read_text(encoding="utf-8")

    match = re.search(r'version\s*=\s*["\']([^"\']+)["\']', content)
    if not match:
        raise ValueError("Could not find version in pyproject.toml")

    version = match.group(1)
    print(f"Current version in pyproject.toml: {version}")

    # 1. Update src/__init__.py
    init_file = ROOT / "src" / "__init__.py"
    if init_file.exists():
        init_text = init_file.read_text(encoding="utf-8")
        init_text = re.sub(r'__version__\s*=\s*["\']([^"\']+)["\']', f'__version__ = "{version}"', init_text)
        init_file.write_text(init_text, encoding="utf-8")
        print(f"Updated {init_file.relative_to(ROOT)}")

    # 2. Update frontend/package.json
    frontend_pkg = ROOT / "frontend" / "package.json"
    if frontend_pkg.exists():
        pkg_text = frontend_pkg.read_text(encoding="utf-8")
        pkg_text_updated = re.sub(r'("version"\s*:\s*)"[^"]+"', rf'\g<1>"{version}"', pkg_text)
        if pkg_text != pkg_text_updated:
            frontend_pkg.write_text(pkg_text_updated, encoding="utf-8")
            print(f"Updated {frontend_pkg.relative_to(ROOT)}")

    # 3. Manifest replacements
    manifest_dir = ROOT / "manifests"
    if not manifest_dir.exists():
        return

    # Pattern to match semver version strings (e.g. 0.2.0, 1.0.0, 0.0.14)
    version_regex = r"(\d+\.\d+\.\d+(?:[-.][a-zA-Z0-9]+)?)"

    for path in manifest_dir.rglob("*"):
        if path.is_file():
            text = path.read_text(encoding="utf-8")
            # Replace version strings in URLs (releases/download/vX.Y.Z/)
            text_updated = re.sub(r"(releases/download/v)" + version_regex, rf"\g<1>{version}", text)
            # Replace standalone version declarations like: version "0.2.0" or "version": "0.2.0" or pkgver=0.2.0 or PackageVersion: 0.2.0
            text_updated = re.sub(r'((?:version|pkgver|PackageVersion)(?:\s*[:=]\s*|\s+))["\']?' + version_regex + r'["\']?', rf'\g<1>"{version}"' if '"' in text_updated or ":" in text_updated else rf"\g<1>{version}", text_updated)

            # Fine-tune specific format conventions
            if path.name == "PKGBUILD":
                text_updated = re.sub(r"pkgver=.*", f"pkgver={version}", text)
            elif path.name == "tmd.rb":
                text_updated = re.sub(r'version ".*"', f'version "{version}"', text_updated)
            elif path.name == "tmd.yaml":
                text_updated = re.sub(r"PackageVersion: .*", f"PackageVersion: {version}", text_updated)
            elif path.name == "snapcraft.yaml":
                text_updated = re.sub(r'version: ".*"', f'version: "{version}"', text_updated)
            elif path.name == "tmd.json":
                text_updated = re.sub(r'"version": ".*"', f'"version": "{version}"', text_updated)
            elif path.name == "tmd.nuspec":
                text_updated = re.sub(r"<version>.*</version>", f"<version>{version}</version>", text_updated)

            if text != text_updated:
                path.write_text(text_updated, encoding="utf-8")
                print(f"Updated {path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()

