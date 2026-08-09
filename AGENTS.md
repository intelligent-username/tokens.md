# AGENTS.md

A comprehensive operational specification, engineering standard, and workflow guide for AI coding agents operating within this repository.

---

## Table of Contents
1. [Workspace Environment & Context](#1-workspace-environment--context)
2. [Core Agent Operating Rules](#2-core-agent-operating-rules)
3. [Codebase Inspection & Search Strategy](#3-codebase-inspection--search-strategy)
4. [Software Engineering & Architecture Standards](#4-software-engineering--architecture-standards)
5. [Tool Usage Protocols & Best Practices](#5-tool-usage-protocols--best-practices)
6. [Multi-Agent & Subagent Orchestration](#6-multi-agent--subagent-orchestration)
7. [UI/UX & Web Interface Guidelines](#7-uiux--web-interface-guidelines)
8. [Testing, Verification & Error Triage](#8-testing-verification--error-triage)
9. [Security, Safety & Data Integrity](#9-security-safety--data-integrity)
10. [Version Control & Change Management](#10-version-control--change-management)

---

## 1. Workspace Environment & Context

- **Primary Workspace**: `tokens.md` (`intelligent-username/tokens.md`)
- **Host OS**: Windows (Powershell environment)
- **Line Endings & Encoding**: UTF-8 encoding across all text files. Standard line endings preserved per file conventions.
- **Path Handling**: Use forward slashes (`/`) or escaped backslashes (`\\`) consistently in configuration paths and clickable file links (`file:///...`).

---

## 2. Core Agent Operating Rules

### Concise & Direct Execution
- Skip introductory pleasantries, filler phrases, and generic conversational steps.
- Provide direct, technical, and actionable responses.
- Do not narrate routine steps before executing them—take direct action using appropriate tools.

### Zero-Guesswork Policy
- **Never infer definitions**: Never guess function signatures, variable names, exported types, or schema properties from partial snippets or assumptions.
- **Inspect authoritative sources**: Always view and parse target source files completely before consuming or modifying their symbols.

### Root-Cause Fixes Over Symptom Masking
- Never resolve failures by swallowing exceptions, adding dummy fallbacks, commenting out broken assertions, or suppressing linter errors silently.
- Always identify why an underlying API contract or test assertion failed and fix the root cause upstream.

### Mandatory Empirical Verification
- Editing a file does not equal completing a task.
- Run builds, test scripts, or runtime validation commands to empirically prove correctness before declaring success.

---

## 3. Codebase Inspection & Search Strategy

### Context Acquisition
1. **Search Before Editing**: Use exact-string or regex tools to locate every instance where a function, component, type, or constant is defined or imported.
2. **Read Full Definitions**: If a view snippet is truncated, adjust line ranges or byte offsets to inspect the complete object definition.
3. **Trace Dependencies**: Map out imported modules and consumer files before refactoring core APIs.

### Codebase Auditing
- Prior to creating new utility functions or helper classes, search the repository and existing history to avoid re-inventing functionality that already exists.

---

## 4. Software Engineering & Architecture Standards

### Code Quality & Maintainability
- **Single Responsibility**: Ensure functions, classes, and components have a focused, single purpose.
- **Defensive Typing**: Use explicit typing (TypeScript/Python type hints/etc.) across all public interfaces and internal data flow boundaries.
- **Comment Integrity**: Preserve existing non-obvious code comments and docstrings. Update documentation whenever function behavior changes.

### API Contract Preservation
- Modifications to existing function parameter lists must be propagated to all call sites across the codebase.
- Maintain backward compatibility where appropriate or update consumer components in the same task boundary.

### Resource & Performance Management
- **Non-Blocking Execution**: Never block main UI threads or single-threaded event dispatchers with synchronous blocking calls.
- **Async Safety**: Correctly handle promises, async/await blocks, resource cleanup, and thread loop termination criteria.

---

## 5. Tool Usage Protocols & Best Practices

### File Edits
- **Single Contiguous Edits**: Use `replace_file_content` when modifying a single contiguous block of lines.
- **Non-Adjacent Edits**: Use `multi_replace_file_content` for editing multiple separated line blocks in a single file to minimize file operations.
- **Exact Matches**: Ensure `TargetContent` strictly matches existing file contents including indentations and whitespace.

### Terminal & Process Management
- **No Manual Directory Switches**: Avoid executing `cd` commands. Set `Cwd` explicitly in process invocations.
- **Background Tasks**: Launch long-running dev servers, file watchers, or test daemons as asynchronous background tasks.
- **Log Inspection**: Inspect log outputs silently and summarize findings clearly for user review.

---

## 6. Multi-Agent & Subagent Orchestration

### Role Specialization
- Delegate intensive or repetitive tasks to specialized subagents:
  - **Research Agents**: Deep codebase exploration, documentation analysis, and pattern auditing.
  - **Execution Agents**: Focused code implementation, refactoring, and test suite creation.

### Communication & State Sync
- Maintain structured, context-rich task descriptions when dispatching subagent sub-tasks.
- Utilize task notifications and reactive wakeups rather than polling in continuous wait loops.

---

## 7. UI/UX & Web Interface Guidelines

### Visual Excellence & Aesthetics
- **Modern Typography**: Use curated font families (e.g., Inter, Roboto, Outfit) instead of raw system browser defaults.
- **Rich Palette**: Use custom dark modes, harmonious color tokens (HSL/HEX scales), subtle gradients, and glassmorphism where appropriate.
- **Micro-Interactions**: Incorporate fluid hover effects, responsive state feedback, dynamic keyframe animations, and reduced-motion considerations.

### Accessibility & Semantics
- Ensure proper HTML5 semantic tags (`<header>`, `<nav>`, `<main>`, `<section>`, `<footer>`).
- Maintain valid ARIA roles, descriptive alt texts, clear color contrast compliance (WCAG standards), and unique element IDs.

---

## 8. Testing, Verification & Error Triage

### Error Log Extraction
- When diagnosing a runtime error or build crash, read un-truncated stack traces and execution logs first.
- Base diagnoses strictly on empirical trace logs rather than hypothetical guesses.

### Verification Matrix
| Change Type | Verification Standard |
| :--- | :--- |
| **Logic & Algorithms** | Unit tests passing with high boundary coverage |
| **API Endpoints** | Integration calls / mock payloads validated |
| **UI Components** | Visual render check, interactive state verification |
| **Refactoring** | Full build pass with zero regression in consumers |

---

## 9. Security, Safety & Data Integrity

### Credential Protection
- Never output, log, or commit secret keys, tokens, environment passwords, or private user data.

### Input Validation & Sanitization
- Enforce strict validation schemas on incoming API payloads, route parameters, and input fields to prevent XSS, SQL injection, and command execution vulnerabilities.
- Configure safe HTTP headers and Content Security Policies (CSP) for web environments.

---

## 10. Version Control & Change Management

### Atomic Commits & Diffs
- Keep code changes focused and scoped directly to the request.
- Ensure clear, descriptive commit messages and explicit summaries for non-obvious architecture changes or tradeoffs.
