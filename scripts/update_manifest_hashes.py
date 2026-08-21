"""Validate ALL release binaries in SHA256SUMS.txt and sync manifest versions + hashes."""

from __future__ import annotations

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
    win_arm64 = hashes["tmd-windows-arm64.exe"]
    mac_arm64 = hashes["tmd-macos-arm64"]
    mac_x64 = hashes["tmd-macos-x64"]
    linux_x64 = hashes["tmd-linux-x64"]
    linux_arm64 = hashes["tmd-linux-arm64"]

    semver_pattern = r"(\d+\.\d+\.\d+(?:[-.][a-zA-Z0-9]+)?)"

    # 1. Homebrew (tmd.rb)
    brew_file = MANIFESTS / "homebrew" / "tmd.rb"
    if brew_file.exists():
        content = f"""class Tmd < Formula
  desc "Convert files to token-efficient Markdown for LLM prompts"
  homepage "https://github.com/intelligent-username/tokens.md"
  license "AGPL-3.0-only"
  version "{version}"

  livecheck do
    url :stable
    strategy :github_latest
    regex(/^v?(\\d+(?:\\.\\d+)+)$/i)
  end

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/intelligent-username/tokens.md/releases/download/v#{{version}}/tmd-macos-arm64"
      sha256 "{mac_arm64}"
    else
      url "https://github.com/intelligent-username/tokens.md/releases/download/v#{{version}}/tmd-macos-x64"
      sha256 "{mac_x64}"
    end
  end

  on_linux do
    if Hardware::CPU.arm?
      url "https://github.com/intelligent-username/tokens.md/releases/download/v#{{version}}/tmd-linux-arm64"
      sha256 "{linux_arm64}"
    else
      url "https://github.com/intelligent-username/tokens.md/releases/download/v#{{version}}/tmd-linux-x64"
      sha256 "{linux_x64}"
    end
  end

  def install
    bin.install Dir["tmd*"].first => "tmd"
  end

  test do
    assert_match version.to_s, shell_output("#{{bin}}/tmd --version")
    system bin/"tmd", "--help"
  end
end
"""
        brew_file.write_text(content, encoding="utf-8")
        print("Updated Homebrew manifest (version + sha256).")

    # 2. Scoop (tmd.json)
    scoop_file = MANIFESTS / "scoop" / "tmd.json"
    if scoop_file.exists():
        content = f"""{{
  "version": "{version}",
  "description": "Convert files to token-efficient Markdown for LLM prompts",
  "homepage": "https://github.com/intelligent-username/tokens.md",
  "license": "AGPL-3.0-only",
  "architecture": {{
    "64bit": {{
      "url": "https://github.com/intelligent-username/tokens.md/releases/download/v{version}/tmd-windows-x64.exe",
      "hash": "{win_x64}"
    }},
    "arm64": {{
      "url": "https://github.com/intelligent-username/tokens.md/releases/download/v{version}/tmd-windows-arm64.exe",
      "hash": "{win_arm64}"
    }}
  }},
  "bin": "tmd.exe",
  "checkver": {{
    "github": "https://github.com/intelligent-username/tokens.md"
  }},
  "autoupdate": {{
    "architecture": {{
      "64bit": {{
        "url": "https://github.com/intelligent-username/tokens.md/releases/download/v$version/tmd-windows-x64.exe"
      }},
      "arm64": {{
        "url": "https://github.com/intelligent-username/tokens.md/releases/download/v$version/tmd-windows-arm64.exe"
      }}
    }}
  }}
}}
"""
        scoop_file.write_text(content, encoding="utf-8")
        print("Updated Scoop manifest (version + url + hash).")

    # 3. Winget (tmd.yaml)
    winget_file = MANIFESTS / "winget" / "tmd.yaml"
    if winget_file.exists():
        content = f"""# yaml-language-server: $schema=https://aka.ms/winget-manifest.singleton.1.6.0.schema.json

PackageIdentifier: intelligent-username.tmd
PackageVersion: {version}
PackageName: tmd
Publisher: intelligent-username
PublisherUrl: https://github.com/intelligent-username
License: AGPL-3.0-only
LicenseUrl: https://github.com/intelligent-username/tokens.md/blob/main/LICENSE
ShortDescription: Convert files to token-efficient Markdown for LLM prompts
Description: >-
  tmd converts PDF, DOCX, PPTX, XLSX, ODT, EPUB, MOBI, HTML, JSON, CSV,
  LaTeX, e-mail, subtitles, Jupyter notebooks, and whole code repositories
  into clean, token-efficient Markdown for LLM context windows.
  Includes token counting, budget pruning, hot-folder watching, and a web UI.
Homepage: https://github.com/intelligent-username/tokens.md
Tags:
  - markdown
  - llm
  - tokens
  - cli
  - pdf
  - converter
Installers:
  - Architecture: x64
    InstallerUrl: https://github.com/intelligent-username/tokens.md/releases/download/v{version}/tmd-windows-x64.exe
    InstallerSha256: {win_x64}
    InstallerType: portable
    Commands:
      - tmd
  - Architecture: arm64
    InstallerUrl: https://github.com/intelligent-username/tokens.md/releases/download/v{version}/tmd-windows-arm64.exe
    InstallerSha256: {win_arm64}
    InstallerType: portable
    Commands:
      - tmd
ManifestType: singleton
ManifestVersion: 1.6.0
"""
        winget_file.write_text(content, encoding="utf-8")
        print("Updated Winget manifest (version + url + sha256).")

    # 4. Chocolatey (tmd.nuspec + chocolateyinstall.ps1)
    choco_nuspec = MANIFESTS / "chocolatey" / "tmd.nuspec"
    if choco_nuspec.exists():
        text = choco_nuspec.read_text(encoding="utf-8")
        text = re.sub(r"<version>[^<]+</version>", f"<version>{version}</version>", text)
        text = re.sub(r"(releases/tag/v)[^<]+", rf"\g<1>{version}", text)
        choco_nuspec.write_text(text, encoding="utf-8")
        print("Updated Chocolatey nuspec (version + release notes URL).")

    choco_install = MANIFESTS / "chocolatey" / "tools" / "chocolateyinstall.ps1"
    if choco_install.exists():
        text = choco_install.read_text(encoding="utf-8")
        text = re.sub(r"(releases/download/v)" + semver_pattern, rf"\g<1>{version}", text)
        text = re.sub(r"checksum64\s*=\s*['\"][^'\"]+['\"]", f"checksum64     = '{win_x64}'", text)
        choco_install.write_text(text, encoding="utf-8")
        print("Updated Chocolatey install script (url + checksum).")

    # 5. AUR (PKGBUILD)
    aur_file = MANIFESTS / "aur" / "PKGBUILD"
    if aur_file.exists():
        text = aur_file.read_text(encoding="utf-8")
        text = re.sub(r"pkgver=.*", f"pkgver={version}", text)
        text = re.sub(r"sha256sums_x86_64=\(['\"][^'\"]+['\"]\)", f"sha256sums_x86_64=('{linux_x64}')", text)
        text = re.sub(r"sha256sums_aarch64=\(['\"][^'\"]+['\"]\)", f"sha256sums_aarch64=('{linux_arm64}')", text)
        aur_file.write_text(text, encoding="utf-8")
        print("Updated AUR PKGBUILD (pkgver + sha256 sums).")

    # 6. MacPorts (Portfile)
    macports_file = MANIFESTS / "macports" / "Portfile"
    if macports_file.exists():
        content = f"""# -*- coding: utf-8; mode: tcl; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- vim:fenc=utf-8:ft=tcl:et:sw=4:ts=4:sts=4

PortSystem          1.0

name                tmd
version             {version}
categories          textproc devel
platforms           darwin
supported_archs     arm64 x86_64
license             AGPL-3
maintainers         {{github:intelligent-username}}
description         Convert files to token-efficient Markdown for LLM prompts
long_description    {{*}}${{description}}. Supports PDF, DOCX, PPTX, XLSX, ODT, \\
                    EPUB, MOBI, HTML, JSON, CSV, LaTeX, e-mail, subtitles, \\
                    Jupyter notebooks, and whole code repositories.
homepage            https://github.com/intelligent-username/tokens.md

distfiles           tmd-macos-arm64
if {{${{build_arch}} eq "x86_64"}} {{
    distfiles       tmd-macos-x64
}}

master_sites        https://github.com/intelligent-username/tokens.md/releases/download/v${{version}}/
checksums           tmd-macos-arm64 \\
                        sha256  {mac_arm64} \\
                    tmd-macos-x64 \\
                        sha256  {mac_x64}

use_configure       no
build               {{}}

destroot {{
    if {{${{build_arch}} eq "x86_64"}} {{
        file copy ${{worksrcpath}}/tmd-macos-x64 ${{destroot}}${{prefix}}/bin/tmd
    }} else {{
        file copy ${{worksrcpath}}/tmd-macos-arm64 ${{destroot}}${{prefix}}/bin/tmd
    }}
    file attributes ${{destroot}}${{prefix}}/bin/tmd -permissions 0755
}}

test.run            yes
test.cmd            ${{prefix}}/bin/tmd
test.args           --version
"""
        macports_file.write_text(content, encoding="utf-8")
        print("Updated MacPorts Portfile (version + sha256).")

    # 7. Snap (snapcraft.yaml)
    snap_file = MANIFESTS / "snap" / "snapcraft.yaml"
    if snap_file.exists():
        text = snap_file.read_text(encoding="utf-8")
        text = re.sub(r'version:\s*"[^"]+"', f'version: "{version}"', text)
        text = re.sub(r'(releases/download/v)' + semver_pattern, rf'\g<1>{version}', text)
        snap_file.write_text(text, encoding="utf-8")
        print("Updated Snapcraft manifest (version + download urls).")

    # 8. Flatpak (com.intelligent_username.tmd.yaml)
    flatpak_file = MANIFESTS / "flatpak" / "com.intelligent_username.tmd.yaml"
    if flatpak_file.exists():
        content = f"""app-id: com.intelligent_username.tmd
runtime: org.freedesktop.Platform
runtime-version: "23.08"
sdk: org.freedesktop.Sdk
command: tmd
finish-args:
  - --filesystem=host
  - --share=network

modules:
  - name: tmd
    buildsystem: simple
    build-commands:
      - install -Dm755 tmd-linux-x64 /app/bin/tmd || install -Dm755 tmd-linux-arm64 /app/bin/tmd
      - install -Dm644 com.intelligent_username.tmd.metainfo.xml /app/share/metainfo/com.intelligent_username.tmd.metainfo.xml
    sources:
      - type: file
        url: https://github.com/intelligent-username/tokens.md/releases/download/v{version}/tmd-linux-x64
        sha256: {linux_x64}
        dest-filename: tmd-linux-x64
        only-arches:
          - x86_64
      - type: file
        url: https://github.com/intelligent-username/tokens.md/releases/download/v{version}/tmd-linux-arm64
        sha256: {linux_arm64}
        dest-filename: tmd-linux-arm64
        only-arches:
          - aarch64
      - type: file
        path: com.intelligent_username.tmd.metainfo.xml
"""
        flatpak_file.write_text(content, encoding="utf-8")
        print("Updated Flatpak manifest (version + sha256).")

    print("All manifests successfully synchronized with release version and hashes.")


if __name__ == "__main__":
    main()
