# GitHub Actions workflows

This document describes the automated CI/CD pipelines in this repository.

## Core workflows

### Tests (`.github/workflows/test.yml`)

Runs on pull requests and pushes to `main` or `master`, as well as manual dispatches and workflow calls.

It runs two parallel jobs:

- **Backend tests**: Ensures all backend/CLI functionality still works.
   - Runs `pytest` under Python 3.13 with `uv`.
- **Frontend tests**: Ensures the frontend is still functional.
   - Runs `vitest` under Node 22 in `frontend/`.
- **Version Verification**: Compares the Git release tag version against `project.version` in `pyproject.toml`.
   - Runs `scripts/sync_version.py` to keep version declarations in sync across project files.

### Release pipeline (`.github/workflows/release.yml`)

Triggers only when a new version tag matching `v*` (for example `v1.0.0`) is pushed to GitHub.

Execution pipeline:

1. **Test gate**: Runs `test.yml`. If any test fails, execution stops and no release is created.
2. **Version check**: Runs `verify.yml` to check tag and `pyproject.toml` version alignment (issues a warning on mismatch, but does not block release).
3. **Binary builds**: Runs `build-binary.yml` across six target platforms after tests pass:
   - Linux (`x64`, `arm64`)
   - macOS (`x64`, `arm64`)
   - Windows (`x64`, `arm64`)
   If any binary build fails, execution stops and the release is not created.
4. **GitHub release and manifests**: Downloads build outputs, computes `SHA256SUMS.txt`, puts them in the manifests via `update_manifest_hashes.py`, and creates the GitHub release.
5. **PyPI publishing**: Runs `publish-pypi.yml` to build wheels and source distributions and publish them to `PyPI`.

## Reusable workflows

- `build-binary.yml`: Orchestrates compilation across platform-specific worker files (`build-linux-x64.yml`, `build-windows-arm64.yml`, etc.).
- `publish-pypi.yml`: Builds package distributions using `python -m build` and uploads them to PyPI.

## Triggering a release

To issue a release:

1. Make sure the `version` in `pyproject.toml` is correct.
2. Tag and push:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
3. GitHub Actions builds all binaries, updates manifests, and publishes to PyPI automatically.
