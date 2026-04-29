---
phase: 1
title: "Baseline Worktree Reconciliation"
status: completed
priority: P1
effort: "0.5 day"
dependencies: []
---

# Phase 1: Baseline Worktree Reconciliation

## Overview

Establish a trusted baseline for the current dirty worktree before any more Tailwind/refactor work. The goal is to separate valid migration work from accidental churn, generated artifacts, stale plan output, and unrelated server/shared changes.

Current known dirty areas: `client/src/components`, `client/src/pages`, `client/src/hooks`, `client/src/utils`, `server`, `shared`, `tests/e2e`, `docs`, `playwright.config.js`, and several plan folders.

## Requirements

- Produce a file-by-file ownership map for all dirty and untracked files.
- Preserve user changes; do not revert anything without explicit approval.
- Identify files that changed only due version/build/generated noise.
- Identify missing tests for each touched user-facing area.
- Decide commit grouping before implementation continues.

## Architecture

The reconciliation layer is process-only. No app code changes should happen here except optional plan metadata updates. Outputs go to:

- `plans/20260423-2151-tailwind-refactor-hardening-verification/reports/worktree-baseline.md`
- `plans/20260423-2151-tailwind-refactor-hardening-verification/reports/test-baseline.md`

## Implementation Steps

1. Capture raw state:
   - `git status --short`
   - `git diff --name-status`
   - `git diff --stat`
   - `git diff --check`
2. Group files by workstream:
   - Tailwind foundation
   - Dashboard/pages
   - Editor controls/canvas
   - Properties panel
   - Modals/overlays
   - Live/server/shared contracts
   - Export/import/persistence
   - Tests/docs/plans
3. Check risky churn:
   - Deleted files that still have imports.
   - Untracked helper/test files that must be included or intentionally dropped.
   - Mixed server/client/shared edits that require contract tests.
4. Run fast static inventory:
   - `rg "style=\\{\\{" client/src`
   - `rg "#[0-9a-fA-F]{3,8}" client/src`
   - `rg "TemplatePreview|slideNotes|slide-operation-helpers|find-replace-helpers" client/src shared server tests`
5. Create baseline report with:
   - Files by group.
   - Must-keep vs review vs defer classification.
   - Tests currently covering each group.
   - Open risks and owners.
6. Confirm no hidden version mismatch after `v1.6.0` release:
   - `rg "1\\.5|1\\.6\\.0|version" package.json client/package.json server/package.json client/src`

## Verification & Tests

- `git diff --check` must pass or every whitespace issue must be listed for Phase 2/10.
- `npm run build` baseline result recorded.
- `npm run test` baseline result recorded.
- `npm run test:e2e -- --list` or `npx playwright test --list` recorded to prove E2E discovery still works.
- No browser QA required in this phase; defer visual proof to phases 3-10.

## Todo List

- [ ] Create `reports/worktree-baseline.md`.
- [ ] Create `reports/test-baseline.md`.
- [ ] Classify every dirty/untracked file.
- [ ] List stale or superseded plan directories.
- [ ] Decide commit groups and phase ownership.

## Success Criteria

- [ ] No dirty file is unexplained.
- [ ] No deleted file has unresolved imports.
- [ ] Commit grouping is ready before code edits resume.
- [ ] Baseline test failures, if any, have exact command and failure cause.

## Risk Assessment

- Risk: existing dirty files may include unrelated user work. Mitigation: classify and isolate before edits.
- Risk: generated files may pollute commits. Mitigation: compare path against `.gitignore`, package locks, and build outputs.
- Risk: stale optimized Vite/shared state may mask bugs. Mitigation: use clean build and browser reload in later phases.

## Security Considerations

- Check dirty files for secrets before commit: `rg -n "(API_KEY|SECRET|TOKEN|PASSWORD|PRIVATE_KEY|DATABASE_URL)" .`.
- Do not include local `.env`, credentials, screenshots with private tokens, or generated debug dumps.

## Next Steps

Proceed to Phase 2 only when the dirty-file map and baseline test evidence exist.
