"""Validate all release binaries in SHA256SUMS.txt and sync manifest versions + hashes."""

import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
MANIFESTS = ROOT / "manifests"

REQUIRED_BINARIES = [
    "tmd-linux-x64",
    "tmd-linux-arm64",
    "tmd-macos-x64",
    "tmd-macos-arm64",
    "tmd-windows-x64.exe",
    "tmd-windows-arm64.exe",
]


def get_hashes() -> dict[str, str]:
    checksum_file = DIST / "SHA256SUMS.txt"
    if not checksum_file.exists():
        raise FileNotFoundError(f"Checksum file not found: {checksum_file}")

    hashes = {}
    for line in checksum_file.read_text(encoding="utf-8").splitlines():
        parts = line.strip().split()
        if len(parts) >= 2:
            sha, filename = parts[0], parts[1]
            hashes[filename] = sha
    return hashes


def get_version() -> str:
    # First check GITHUB_REF or CLI argument for tag
    tag_input = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("GITHUB_REF", "")
    if tag_input:
        match = re.search(r"(\d+\.\d+\.\d+(?:[-.][a-zA-Z0-9]+)?)", tag_input)
        if match:
            return match.group(1)

    # Fallback to pyproject.toml
    pyproject = (ROOT / "pyproject.toml").read_text(encoding="utf-8")
    match = re.search(r'version\s*=\s*["\']([^"\']+)["\']', pyproject)
    if not match:
        raise ValueError("Could not find version in pyproject.toml")
    return match.group(1)


def main() -> None:
    version = get_version()
    print(f"Target release version for manifests: {version}")

    hashes = get_hashes()
    if not hashes:
        raise ValueError("No checksums found in SHA256SUMS.txt")

    print(f"Found {len(hashes)} checksums in SHA256SUMS.txt:")
    for name, sha in hashes.items():
        print(f"  {name}: {sha}")

    # Check for all required binaries
    missing = [b for b in REQUIRED_BINARIES if b not in hashes]
    if missing:
        raise RuntimeError(
            f"Release is incomplete! Missing required binary checksums in SHA256SUMS.txt: {missing}\n"
            f"Manifests will NOT be updated."
        )

    print("All required binary checksums are present. Updating manifests...")

    win_x64 = hashes["tmd-windows-x64.exe"]
    _win_arm64 = hashes["tmd-windows-arm64.exe"]
    mac_arm64 = hashes["tmd-macos-arm64"]
    _mac_x64 = hashes["tmd-macos-x64"]
    linux_x64 = hashes["tmd-linux-x64"]
    linux_arm64 = hashes["tmd-linux-arm64"]

    semver_pattern = r"(\d+\.\d+\.\d+(?:[-.][a-zA-Z0-9]+)?)"

    # 1. Homebrew (tmd.rb)
    brew_file = MANIFESTS / "homebrew" / "tmd.rb"
    if brew_file.exists():
        text = brew_file.read_text(encoding="utf-8")
        text = re.sub(r'version\s+"[^"]+"', f'version "{version}"', text)
        text = re.sub(r'sha256\s+["\'](REPLACE_WITH_SHA256_MACOS_ARM64|[a-f0-9]{64})["\']', f'sha256 "{mac_arm64}"', text, count=1)
        text = re.sub(r'sha256\s+["\'](REPLACE_WITH_SHA256_LINUX_ARM64|[a-f0-9]{64})["\']', f'sha256 "{linux_arm64}"', text, count=1)
        text = re.sub(r'sha256\s+["\'](REPLACE_WITH_SHA256_LINUX_X64|[a-f0-9]{64})["\']', f'sha256 "{linux_x64}"', text, count=1)
        brew_file.write_text(text, encoding="utf-8")
        print("Updated Homebrew manifest (version + sha256).")

    # 2. Scoop (tmd.json)
    scoop_file = MANIFESTS / "scoop" / "tmd.json"
    if scoop_file.exists():
        text = scoop_file.read_text(encoding="utf-8")
        text = re.sub(r'"version":\s*"[^"]+"', f'"version": "{version}"', text)
        text = re.sub(r'(releases/download/v)' + semver_pattern, rf'\g<1>{version}', text)
        text = re.sub(r'"hash":\s*["\'](REPLACE_WITH_SHA256_WINDOWS_X64|[a-f0-9]{64})["\']', f'"hash": "{win_x64}"', text, count=1)
        scoop_file.write_text(text, encoding="utf-8")
        print("Updated Scoop manifest (version + url + hash).")

    # 3. Winget (tmd.yaml)
    winget_file = MANIFESTS / "winget" / "tmd.yaml"
    if winget_file.exists():
        text = winget_file.read_text(encoding="utf-8")
        text = re.sub(r"PackageVersion:\s*[^\s]+", f"PackageVersion: {version}", text)
        text = re.sub(r'(releases/download/v)' + semver_pattern, rf'\g<1>{version}', text)
        text = re.sub(r"InstallerSha256:\s*(REPLACE_WITH_SHA256_WINDOWS_X64|[a-f0-9]{64})", f"InstallerSha256: {win_x64}", text, count=1)
        winget_file.write_text(text, encoding="utf-8")
        print("Updated Winget manifest (version + url + sha256).")

    # 4. Chocolatey (tmd.nuspec + chocolateyinstall.ps1)
    choco_nuspec = MANIFESTS / "chocolatey" / "tmd.nuspec"
    if choco_nuspec.exists():
        text = choco_nuspec.read_text(encoding="utf-8")
        text = re.sub(r"<version>[^<]+</version>", f"<version>{version}</version>", text)
        text = re.sub(r'(releases/tag/v)' + semver_pattern, rf'\g<1>{version}', text)
        choco_nuspec.write_text(text, encoding="utf-8")
        print("Updated Chocolatey nuspec (version + release notes URL).")

    choco_install = MANIFESTS / "chocolatey" / "tools" / "chocolateyinstall.ps1"
    if choco_install.exists():
        text = choco_install.read_text(encoding="utf-8")
        text = re.sub(r'(releases/download/v)' + semver_pattern, rf'\g<1>{version}', text)
        text = re.sub(r'checksum64\s*=\s*["\'](REPLACE_WITH_SHA256_WINDOWS_X64|[a-f0-9]{64})["\']', f"checksum64     = '{win_x64}'", text)
        choco_install.write_text(text, encoding="utf-8")
        print("Updated Chocolatey install script (url + checksum).")

    # 5. AUR (PKGBUILD)
    aur_file = MANIFESTS / "aur" / "PKGBUILD"
    if aur_file.exists():
        text = aur_file.read_text(encoding="utf-8")
        text = re.sub(r"pkgver=.*", f"pkgver={version}", text)
        text = re.sub(r'sha256sums_x86_64=\(["\']?[a-f0-9]{64}["\']?\)', f"sha256sums_x86_64=('{linux_x64}')", text)
        text = re.sub(r'sha256sums_aarch64=\(["\']?[a-f0-9]{64}["\']?\)', f"sha256sums_aarch64=('{linux_arm64}')", text)
        aur_file.write_text(text, encoding="utf-8")
        print("Updated AUR PKGBUILD (pkgver + sha256 sums).")

    # 6. MacPorts (Portfile)
    macports_file = MANIFESTS / "macports" / "Portfile"
    if macports_file.exists():
        text = macports_file.read_text(encoding="utf-8")
        text = re.sub(r'version\s+"[^"]+"', f'version             "{version}"', text)
        text = re.sub(r"sha256\s+(REPLACE_WITH_SHA256_MACOS_ARM64|[a-f0-9]{64})", f"sha256  {mac_arm64}", text)
        macports_file.write_text(text, encoding="utf-8")
        print("Updated MacPorts Portfile (version + sha256).")

    # 7. Snap (snapcraft.yaml)
    snap_file = MANIFESTS / "snap" / "snapcraft.yaml"
    if snap_file.exists():
        text = snap_file.read_text(encoding="utf-8")
        text = re.sub(r'version:\s*"[^"]+"', f'version: "{version}"', text)
        text = re.sub(r'(releases/download/v)' + semver_pattern, rf'\g<1>{version}', text)
        snap_file.write_text(text, encoding="utf-8")
        print("Updated Snapcraft manifest (version + download urls).")

    print("All manifests successfully synchronized with release version and hashes.")


if __name__ == "__main__":
    main()
