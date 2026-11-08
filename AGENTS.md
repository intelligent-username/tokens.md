# Agent guide

`tokens.md` converts documents, web pages, and repositories into Markdown for LLM prompts. It provides a Typer CLI, a FastAPI backend, and a Next.js frontend. Preserve useful source content and structure while improving token efficiency; do not silently trade conversion fidelity for smaller output.

## Working agreement

- Read the relevant source and tests before editing. Search for definitions, imports, and callers before changing interfaces. Existing source and configuration take precedence over documentation when they disagree; report discrepancies.
- For substantial changes, present a plan and obtain user approval before implementation. Clarify consequential ambiguity instead of guessing.
- Obtain separate approval before commits, pushes, releases, dependency installation, network access, deletion or cleanup, and generating or changing generated artifacts. Inspect scripts for side effects before running them. A user request can explicitly authorize the relevant action.
- Protect `input/`, `output/`, user data, test fixtures, built assets, and release infrastructure. Do not overwrite or delete them without permission. Do not expose `.env`, credentials, private documents, or session data.
- Preserve unrelated user changes. Use available editing tools rather than assuming a particular agent platform or tool name.
- Make focused changes, investigate root causes, and report failures and verification limitations. Do not suppress errors or weaken assertions to make checks pass. On a failing check, stop and report the failure and proposed fix before proceeding.
- Support Python 3.10 and later and Windows, macOS, and Linux. Avoid machine-specific paths, shell assumptions, and platform-specific behavior unless guarded and tested. Preserve UTF-8 and existing line endings.

## Architecture and ownership

The CLI and backend share the conversion core. Keep format-specific conversion out of entry points. Trace the real implementation and tests before relying on a diagram: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) provides the larger architecture overview.

| Area | Responsibility and starting points |
| --- | --- |
| CLI | `src/cli.py` is the package entry point; `src/cli_support/commands.py` defines commands, `convert_runner.py` runs conversions, and `theme.py`, `utils.py`, and `constants.py` support the CLI. `src/main.py` is a compatibility entry point. |
| Dispatch | `src/registry.py` defines converter dispatch. `src/handlers/__init__.py` registers implementations. Inspect both when adding or changing format support. |
| Formats | `src/handlers/` owns converter implementations and adapters; `src/readers/` parses individual formats. Reader-backed formats use `readers/adapter.py` to connect readers to the registry and renderer. `src/math_converters/` handles Office and MathML math. |
| Document representation | `src/engine/model.py` contains document blocks; `renderer.py` renders Markdown; `boilerplate.py` handles repeated page content; `converter.py` provides compatibility wrappers. |
| Conversion utilities | `src/merger.py`, `budget.py` and `budget_support/`, `tokenizer.py`, `delta.py`, `file_selector.py`, `fetch.py`, `spoof.py` and `spoof_support/`, `watcher.py`, `clipboard.py`, `detector.py`, and `deps.py` own their respective shared operations. Inspect `src/support/` for related compatibility/support code. |
| API | `backend/app.py` creates the application; `routes.py` aggregates routes; `api_routes/` implements conversion, file, and watch endpoints; `schemas.py` and `schema_models/` define contracts. `config.py` manages settings, `workspace.py` and `workspace_support/` manage session files and cleanup, and `ws.py` manages WebSocket events. |
| Web UI | `frontend/app/` contains App Router entry points, layout, providers, and global styles. `components/workspaces/` composes workspaces; `components/convert/`, `components/layout/`, `components/ui/`, and `components/ux/` own feature and reusable UI. `lib/api/` contains clients and types; `lib/hooks/`, `lib/utils/`, and `lib/copy/` own state, helpers, and copy. `styles/tokens.css` contains design tokens. |
| Tests | `tests/unit/`, `tests/converters/`, and `tests/integration/` cover core logic, formats, and CLI/API behavior. `tests/conftest.py` provides shared setup; `tests/dummies/` contains fixtures. Frontend unit tests live under `frontend/lib/**/__tests__/`; workflow tests live in `frontend/e2e/`. |
| Packaging and automation | `pyproject.toml`, `uv.lock`, and `requirements.txt` describe Python packaging/dependencies; `frontend/package.json` and its lockfiles describe the UI. `scripts/` contains test, lint, verification, version synchronization, and manifest helpers. `manifests/` and `.github/` contain distribution manifests, CI, release workflows, and composite actions. `assets/` contains branding and packaging assets. |
| Other data | `docs/` contains user and developer references. `input/` and `output/` can contain user documents and results; `notes/` may contain work in progress. Caches, virtual environments, `frontend/out/`, and other build outputs are not authoritative source. |

### Common change paths

- New format: inspect the registry, existing handler and reader patterns, document model, renderer, and `docs/FORMATS.md`. Register the converter, test representative content and failure cases, and update relevant format documentation. Preserve math, tables, ordering, and other structures where supported.
- Conversion or token-budget behavior: inspect the shared core and its CLI/API callers; add targeted tests for fidelity, budget boundaries, and opt-in behavior. Do not assume all budget-related transformations apply without a budget.
- API change: trace route, Pydantic schemas, session/workspace safety, WebSocket messages where relevant, frontend API types and consumers, and integration tests. Update [docs/REST_API.md](docs/REST_API.md) when the contract changes.
- UI change: follow existing design tokens and components, preserve keyboard access, semantic HTML, focus states, contrast, and reduced-motion behavior. Test loading, success, and failure states as applicable.
- CLI change: inspect command definitions, shared implementation, path handling, and integration tests; update [docs/USAGE.md](docs/USAGE.md) when user-facing behavior changes.
- Packaging or release change: inspect the relevant manifest, scripts, and workflow together. Do not trigger publishing or alter release infrastructure without approval. See [docs/WORKFLOWS.md](docs/WORKFLOWS.md) and [docs/CLI_DISTRIBUTION.md](docs/CLI_DISTRIBUTION.md).

## Agent delegation

Delegate only when the environment supports it and the task benefits from parallel work. A coordinating agent retains responsibility for the final result.

1. Give each agent a precise objective, relevant paths and contracts, constraints, and verification expectations. Assign separate file ownership when agents work concurrently.
2. Research agents inspect code and report evidence; implementation agents make scoped changes; reviewers independently inspect correctness, security, and regressions. Use specialized agents for tests, documentation, or release infrastructure when available.
3. Order dependent work explicitly. Integrate and review handoffs, resolve interface conflicts, and validate the combined result. Do not ask multiple agents to edit the same files concurrently.
4. Respect the same approval and data-protection rules in delegated work. Never delegate publishing, installation, deletion, or network activity without the required authorization.

## Development and verification

Use existing installed tools when possible. `pnpm` is the preferred frontend package manager; run frontend commands with `frontend/` as the working directory. Both `pnpm-lock.yaml` and `package-lock.json` exist; CI currently uses the npm lockfile for its security audit. Do not remove or regenerate either casually. Python metadata declares `>=3.10`, despite the README currently recommending 3.13+.

Run focused checks appropriate to the change, then broader checks when risk warrants. Report the exact commands and results, including checks not run. These examples assume dependencies are already installed; obtain approval before installing them or accessing the network.

| Scope | Example command | Working directory |
| --- | --- | --- |
| Python targeted tests | `python -m pytest tests/unit/test_registry.py` | root |
| Python tests | `python -m pytest` | root |
| Python lint / format check | `python -m ruff check src backend tests` / `python -m ruff format --check src backend tests` | root |
| Frontend unit tests | `pnpm run test` | `frontend/` |
| Frontend workflow tests | `pnpm run test:e2e` | `frontend/` |
| Frontend build | `pnpm run build` | `frontend/` |

Builds and tests may write caches or artifacts; inspect their side effects and obtain approval where generated files or cleanup are involved. Frontend workflow tests may require services or other setup: inspect `frontend/vitest.e2e.config.ts` and the tests before running them. Do not assume a build or UI test passed without running it.

Important script hazards: `scripts/test.py` runs Python and frontend suites and removes the root `temp/` tree and coverage files in its cleanup; do not run it without confirming that deletion is authorized and safe. `scripts/lint.py --fix` writes formatting changes and runs Ruff unsafe fixes. `scripts/verify.py`, version-sync, and manifest scripts may modify files; read them before use. `frontend/package.json` currently defines `lint` as `next lint`; verify that it works with the installed Next.js version before relying on it.

For documentation-only changes, verify referenced paths and commands against the repository and review the resulting Markdown; runtime suites are not automatically required. Never claim validation that was not performed.

## Security and contracts

- Treat uploaded files, archives, repository paths, URLs, and rendered Markdown as untrusted. Preserve path containment, session isolation, existing sanitization, and network safety checks; add regression tests when changing these boundaries.
- Keep conversion logic shared between the CLI and backend. Preserve public function signatures, CLI flags, API response shapes, and compatibility wrappers unless an intentional breaking change is approved and consumers are updated.
- Keep asynchronous operations and cleanup safe; avoid blocking event loops with lengthy work. Preserve actionable errors rather than hiding exceptions.
- Do not log secrets or document contents unnecessarily. Do not modify a database or run migrations.

## Further references

- [README.md](README.md): installation, entry points, and overview.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): conversion pipeline and module relationships.
- [docs/FORMATS.md](docs/FORMATS.md), [docs/USAGE.md](docs/USAGE.md), and [docs/REST_API.md](docs/REST_API.md): supported formats and user-facing contracts.
- [docs/LIBS_REF.md](docs/LIBS_REF.md): library references; inspect installed versions and current sources before depending on an API.
- [docs/WORKFLOWS.md](docs/WORKFLOWS.md) and [docs/CLI_DISTRIBUTION.md](docs/CLI_DISTRIBUTION.md): CI and distribution. Verify details against the actual workflows and scripts.
