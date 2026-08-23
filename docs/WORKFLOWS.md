# GitHub Actions workflows

This document describes the automated CI/CD pipelines in this repository.

## Core workflows

### Checks & Tests (`.github/workflows/check.yml`)

Runs on pull requests and pushes to `main` or `master`, as well as manual dispatches and workflow calls.

It runs two jobs:
- **Version Verification & Alignment**: Runs `scripts/verify.py` to check tag alignment and sync internal version declarations.
- **Backend & Frontend Tests**: Runs `scripts/test.py` to execute both `pytest` and `vitest` in parallel with live progress and coverage metrics.

### Release pipeline (`.github/workflows/release.yml`)

Triggers only when a new version tag matching `v*` (for example `v1.0.0`) is pushed to GitHub.

Execution pipeline:

1. **Check & Test Gate**: Runs `check.yml`. If verification or tests fail, execution stops and no release is created.
2. **Binary Builds**: Runs `build-binary.yml` across six target platforms in parallel via composite actions in `.github/actions/`:
   - Linux (`x64`, `arm64`)
   - macOS (`x64`, `arm64`)
   - Windows (`x64`, `arm64`)
3. **GitHub Release & Manifests**: Downloads build outputs, computes `SHA256SUMS.txt`, validates all 6 binaries are present, updates manifest versions and SHA-256 hashes via `update_manifest_hashes.py`, and creates the GitHub release.
4. **PyPI Publishing**: Builds wheels and source distributions and publishes them to PyPI.
5. **Chocolatey Publishing**: Packs and pushes `tmd.nupkg` directly to `community.chocolatey.org` (runs after GitHub Release is published and manifests are updated).
6. **Homebrew Publishing**: Syncs the updated formula `manifests/homebrew/tmd.rb` to `intelligent-username/homebrew-tap` (runs when `HOMEBREW_TAP_TOKEN` is configured).

## Reusable Workflows & Actions

- `build-binary.yml`: Orchestrates compilation across the 6 platform composite actions in `.github/actions/` (`build-linux-x64`, `build-windows-arm64`, etc.).
- `.github/actions/github-release`: Bundles artifacts, creates GitHub Release, and updates manifest hashes.
- `.github/actions/publish-pypi`: Builds wheels/sdist and publishes to PyPI with token authentication.
- `.github/actions/publish-chocolatey`: Packages and pushes `.nupkg` to Chocolatey using `CHOCOLATEY_API_KEY`.
- `.github/actions/publish-homebrew`: Pushes `manifests/homebrew/tmd.rb` to `intelligent-username/homebrew-tap` using `HOMEBREW_TAP_TOKEN`.

### Manual PyPI Re-Publish (`.github/workflows/republish-pypi.yml`)

**Trigger**: Manual only (`workflow_dispatch`).

**Purpose**: An emergency recovery workflow executed when automated PyPI publishing fails during a release run (e.g., due to OIDC token exchange glitches, network drops, or permission issues).

**Features**:
- Avoids re-triggering the lengthy full multi-platform binary compilation matrix.
- Accepts an optional `tag` input (defaults to the latest release if blank).
- Fetches the tagged release, prepares distribution archives (`.whl` and `.tar.gz`), and syncs them to PyPI using Trusted Publishing (`environment: pypi`).
- Skips packages that already exist on PyPI (`skip_existing: true`) by default.

### Manual Chocolatey Re-Publish (`.github/workflows/republish-chocolatey.yml`)

**Trigger**: Manual only (`workflow_dispatch`).

**Purpose**: Directly pack and publish `manifests/chocolatey` from `main` to `community.chocolatey.org` using `CHOCOLATEY_API_KEY`.

### Manual Homebrew Re-Publish (`.github/workflows/republish-homebrew.yml`)

**Trigger**: Manual only (`workflow_dispatch`).

**Purpose**: Directly sync `manifests/homebrew/tmd.rb` from `main` into `intelligent-username/homebrew-tap` using `HOMEBREW_TAP_TOKEN`.



## Triggering a release

To issue a release:

1. Make sure the `version` in `pyproject.toml` is correct.
2. Tag and push:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
3. GitHub Actions builds all binaries, updates manifests, and publishes to PyPI automatically.

