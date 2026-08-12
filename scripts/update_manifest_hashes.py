"""Parse SHA256SUMS.txt from build output and update all manifests automatically."""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
MANIFESTS = ROOT / "manifests"


def get_hashes() -> dict[str, str]:
    checksum_file = DIST / "SHA256SUMS.txt"
    if not checksum_file.exists():
        print(f"File not found: {checksum_file}")
        return {}

    hashes = {}
    for line in checksum_file.read_text(encoding="utf-8").splitlines():
        parts = line.strip().split()
        if len(parts) >= 2:
            sha, filename = parts[0], parts[1]
            hashes[filename] = sha
    return hashes


def main() -> None:
    hashes = get_hashes()
    if not hashes:
        print("No hashes found in SHA256SUMS.txt")
        return

    print("Parsed release SHA256 hashes:")
    for name, sha in hashes.items():
        print(f"  {name}: {sha}")

    win_x64 = hashes.get("tmd-windows-x64.exe", "")
    _win_arm64 = hashes.get("tmd-windows-arm64.exe", "")
    mac_arm64 = hashes.get("tmd-macos-arm64", "")
    _mac_x64 = hashes.get("tmd-macos-x64", "")
    linux_x64 = hashes.get("tmd-linux-x64", "")
    linux_arm64 = hashes.get("tmd-linux-arm64", "")

    # 1. Homebrew (tmd.rb)
    brew_file = MANIFESTS / "homebrew" / "tmd.rb"
    if brew_file.exists():
        text = brew_file.read_text(encoding="utf-8")
        text = re.sub(r'sha256\s+["\'](REPLACE_WITH_SHA256_MACOS_ARM64|[a-f0-9]{64})["\']', f'sha256 "{mac_arm64}"', text, count=1)
        text = re.sub(r'sha256\s+["\'](REPLACE_WITH_SHA256_LINUX_ARM64|[a-f0-9]{64})["\']', f'sha256 "{linux_arm64}"', text, count=1)
        text = re.sub(r'sha256\s+["\'](REPLACE_WITH_SHA256_LINUX_X64|[a-f0-9]{64})["\']', f'sha256 "{linux_x64}"', text, count=1)
        brew_file.write_text(text, encoding="utf-8")
        print("Updated Homebrew manifest.")

    # 2. Scoop (tmd.json)
    scoop_file = MANIFESTS / "scoop" / "tmd.json"
    if scoop_file.exists():
        text = scoop_file.read_text(encoding="utf-8")
        text = re.sub(r'"hash":\s*["\'](REPLACE_WITH_SHA256_WINDOWS_X64|[a-f0-9]{64})["\']', f'"hash": "{win_x64}"', text, count=1)
        scoop_file.write_text(text, encoding="utf-8")
        print("Updated Scoop manifest.")

    # 3. Winget (tmd.yaml)
    winget_file = MANIFESTS / "winget" / "tmd.yaml"
    if winget_file.exists():
        text = winget_file.read_text(encoding="utf-8")
        text = re.sub(r"InstallerSha256:\s*(REPLACE_WITH_SHA256_WINDOWS_X64|[a-f0-9]{64})", f"InstallerSha256: {win_x64}", text, count=1)
        winget_file.write_text(text, encoding="utf-8")
        print("Updated Winget manifest.")

    # 4. Chocolatey (chocolateyinstall.ps1)
    choco_file = MANIFESTS / "chocolatey" / "tools" / "chocolateyinstall.ps1"
    if choco_file.exists():
        text = choco_file.read_text(encoding="utf-8")
        text = re.sub(r'checksum64\s*=\s*["\'](REPLACE_WITH_SHA256_WINDOWS_X64|[a-f0-9]{64})["\']', f"checksum64     = '{win_x64}'", text)
        choco_file.write_text(text, encoding="utf-8")
        print("Updated Chocolatey manifest.")

    # 5. AUR (PKGBUILD)
    aur_file = MANIFESTS / "aur" / "PKGBUILD"
    if aur_file.exists():
        text = aur_file.read_text(encoding="utf-8")
        text = re.sub(r'sha256sums_x86_64=\(["\']?[a-f0-9]{64}["\']?\)', f"sha256sums_x86_64=('{linux_x64}')", text)
        text = re.sub(r'sha256sums_aarch64=\(["\']?[a-f0-9]{64}["\']?\)', f"sha256sums_aarch64=('{linux_arm64}')", text)
        aur_file.write_text(text, encoding="utf-8")
        print("Updated AUR manifest.")

    # 6. MacPorts (Portfile)
    macports_file = MANIFESTS / "macports" / "Portfile"
    if macports_file.exists():
        text = macports_file.read_text(encoding="utf-8")
        text = re.sub(r"sha256\s+(REPLACE_WITH_SHA256_MACOS_ARM64|[a-f0-9]{64})", f"sha256  {mac_arm64}", text)
        macports_file.write_text(text, encoding="utf-8")
        print("Updated MacPorts manifest.")


if __name__ == "__main__":
    main()
