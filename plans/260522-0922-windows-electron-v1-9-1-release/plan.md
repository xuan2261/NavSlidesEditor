---
title: "NavSlidesEditor v1.9.1 Windows Electron Release"
description: "Align v1.9.1 release docs, harden the Windows-only Electron release path, verify packaged dependencies locally, and prep commit/tag/push from current HEAD."
status: complete
priority: P1
effort: 4h
branch: master
tags: [release, electron, windows, docs, workflow]
created: 2026-05-22
blockedBy: []
blocks: []
---

# NavSlidesEditor v1.9.1 Windows Electron Release

## Snapshot

- Source of truth version already sits at `package.json:3` and `package-lock.json:3,9` with `1.9.1`.
- Release-facing docs are partially aligned in the current worktree: `README.md:7,76`, `docs/project-overview-pdr.md:5`, `docs/project-roadmap.md:3`, `docs/codebase-summary.md:6-7,154`, `docs/deployment-guide.md:130,271-272`.
- GitHub Release reality is still behind repo state: latest published release is `v1.7.1` (verified via `gh release list`, dated 2026-05-14), latest local tag is `v1.8.0`, and `HEAD` is 32 commits ahead.
- Windows release workflow is already separate from the main CI workflow: `.github/workflows/release.yml:3-12,79-82` vs `.github/workflows/github-actions-ci-pipeline-lint-unit-coverage-e2e-load-smoke.yml:3-8,223-244`.

## Phases

1. [Phase 1 - Docs Scope And Release Baseline](./phase-01-docs-scope-and-release-baseline.md) - Complete.
2. [Phase 2 - Workflow Guardrails And Contract Tests](./phase-02-workflow-guardrails-and-contract-tests.md) - Complete.
3. [Phase 3 - Local Windows Package Verification](./phase-03-local-windows-package-verification.md) - Complete.
4. [Phase 4 - Commit Tag Push Readiness](./phase-04-commit-tag-push-readiness.md) - In progress until commit, tag, push, and release verification complete.

## Dependency Graph

- Phase 1 blocks Phase 2 because contract assertions must target the final doc text.
- Phase 2 blocks Phase 3 because local verification should exercise the final workflow/test expectations.
- Phase 3 blocks Phase 4 because tag/push should happen only after Windows packaging and packaged dependency checks pass.
- No parallel phase is recommended; each phase either depends on prior file content or validates prior outputs.

## Release Gate

- Required gates for this release: targeted release-readiness contract test, Windows Electron build, packaged dependency/resource verification.
- Explicit non-gate for this release: unrelated failures in the `CI` workflow on `master`, as long as `.github/workflows/release.yml` remains independent and Windows packaging passes.
- Backwards compatibility rule: do not restore `v1.8.0`; no data migration; Linux/macOS local build scripts stay available but out of GitHub Release scope.

## Verification Log

- `npx vitest run tests/unit/electron-release-readiness-contract.test.js tests/unit/github-actions-manual-visual-baseline-workflow-contract.test.js` - pass, 7 tests.
- `npm run build` - pass; existing Vite chunk-size warning only.
- `npm run electron:build:win` - pass; generated `NavSlides Editor Setup 1.9.1.exe` and `NavSlides Editor 1.9.1.exe`.
- Packaged dependency spot-check - pass for `express`, `pptxtojson`, and `pptx2json`.
- `npm run lint` - pass with 0 errors and existing warnings.

## Files In Scope

- Docs/version: `README.md`, `docs/deployment-guide.md`, `docs/project-overview-pdr.md`, `docs/project-roadmap.md`, `docs/codebase-summary.md`
- Release pipeline: `.github/workflows/release.yml`
- Version source: `package.json`, `package-lock.json`
- Minimal contract guard: `tests/unit/electron-release-readiness-contract.test.js`

## Reports

- [Scout Report](./reports/scout-report.md)

## Unresolved Questions

- None before tag push.
