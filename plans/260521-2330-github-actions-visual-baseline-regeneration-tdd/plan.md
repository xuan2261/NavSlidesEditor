---
title: "GitHub Actions Visual Baseline Regeneration TDD"
description: "Manual CI path to regenerate Playwright visual baselines in canonical Linux Playwright container when local Docker is unavailable."
status: blocked
priority: P1
branch: "refactor/icon-consistency-pass"
tags: [testing, playwright, github-actions, visual-regression, tdd, ci]
blockedBy: []
blocks: [260521-1130-icon-consistency-pass-tdd]
created: "2026-05-21T23:30:00+07:00"
createdBy: "ck:plan --deep --tdd"
source: skill
---

# GitHub Actions Visual Baseline Regeneration TDD

## Overview

Create a manual GitHub Actions workflow that regenerates Playwright visual baseline PNGs inside `mcr.microsoft.com/playwright:v1.59.1-jammy`, verifies the regenerated baselines in the same container, uploads only intended snapshot artifacts, then applies/reviews those artifacts locally before final gates.

This follows user-selected direction 1 for the active icon consistency PR. Local Docker/Podman/Nerdctl are unavailable and WSL has no installed distro, so Windows-host snapshot updates remain prohibited.

## Cross-Plan Dependencies

| Relationship | Plan | Reason |
|---|---|---|
| Blocks | [260521-1130 Icon Consistency Pass TDD](../260521-1130-icon-consistency-pass-tdd/plan.md) | Its Phase 4 cannot finish until Linux visual baselines are regenerated and visual E2E is green. |
| References | [Testing guide](../../docs/navslides-editor-vitest-playwright-k6-testing-guide.md) | Existing contract requires Linux Docker baseline generation. |

## Key Decisions

- Manual-only workflow via `workflow_dispatch`; no automatic snapshot commits in first iteration.
- Canonical container is fixed to `mcr.microsoft.com/playwright:v1.59.1-jammy`, matching CI and `@playwright/test` 1.59.1.
- Scope includes both `tests/e2e/visual/` and `tests/e2e/visual-regression.spec.js`; the current CI visual job only covers the expanded directory, but the PR has failures in both visual families.
- TDD first: add a source-level workflow contract test before adding the workflow.
- Artifact review stays human-controlled: download with `gh run download`, copy PNGs into snapshot dirs, inspect `git diff --stat`, then commit only intended PNGs plus workflow/test/doc changes.
- Do not weaken screenshot thresholds, skip tests, or generate baselines on Windows/macOS.

## Phases

| Phase | Name | Status | Priority |
|---|---|---|---|
| 1 | [Scout & Workflow Contract Tests](./phase-01-scout-and-workflow-contract-tests.md) | Complete | P1 |
| 2 | [Add Manual GitHub Actions Workflow](./phase-02-add-manual-github-actions-workflow.md) | Complete | P1 |
| 3 | [Run Workflow and Apply Artifact](./phase-03-run-workflow-and-apply-artifact.md) | Blocked | P1 |
| 4 | [Verify Visual and Full Gates](./phase-04-verify-visual-and-full-gates.md) | Blocked | P1 |
| 5 | [Docs and PR Finalization](./phase-05-docs-and-pr-finalization.md) | In-progress | P2 |

## Out of Scope

- Installing Docker, Podman, Nerdctl, or WSL locally.
- Auto-committing snapshot PNGs from GitHub Actions.
- Relaxing Playwright screenshot thresholds or excluding failing visual specs.
- Refactoring Playwright config beyond what the workflow needs.
- Replacing the existing CI visual gate in this plan.
- Updating snapshots from Windows/macOS.

## Plan-Level Test Matrix

| Gate | Command / Check | Expected |
|---|---|---|
| Workflow contract unit test | `npm run test -- tests/unit/github-actions-manual-visual-baseline-workflow-contract.test.js` | Fails before workflow, passes after workflow |
| Workflow syntax/source scan | same Vitest contract | `workflow_dispatch`, container, update step, verify step, artifact paths locked |
| Manual workflow run | `gh workflow run manual-update-playwright-visual-baselines.yml --ref <branch>` | Completes green |
| Artifact integrity | inspect downloaded artifact | Only PNGs under approved snapshot dirs |
| Visual verification | `npx playwright test tests/e2e/visual/ tests/e2e/visual-regression.spec.js` in Linux workflow | Green |
| Local non-visual regression | existing local gates | Lint/unit/build/non-visual Playwright remain green |

## Success Criteria

- [x] Manual workflow exists at `.github/workflows/manual-update-playwright-visual-baselines.yml`.
- [x] Contract test prevents accidental drift from manual-only Linux snapshot regeneration.
- [ ] GitHub Actions artifact contains updated PNGs only for `tests/e2e/visual/**/*-snapshots/*.png` and `tests/e2e/visual-regression.spec.js-snapshots/*.png`.
- [ ] Snapshot PNGs applied to repo are Linux-generated, reviewed, and limited to intended visual diffs.
- [ ] Visual Playwright suite green in canonical container.
- [ ] Existing icon plan Phase 4 can resume and complete PR creation.

## Progress Notes

- 2026-05-21: Phase 1 complete. Added `tests/unit/github-actions-manual-visual-baseline-workflow-contract.test.js`. Red run failed because `.github/workflows/manual-update-playwright-visual-baselines.yml` was missing; green run passed 4/4 after workflow was added.
- 2026-05-21: Phase 2 complete. Added `.github/workflows/manual-update-playwright-visual-baselines.yml` and committed/pushed `9331885c test: add manual visual baseline workflow` to `refactor/icon-consistency-pass`.
- 2026-05-21: Phase 3 blocked. `gh workflow run manual-update-playwright-visual-baselines.yml --ref refactor/icon-consistency-pass` returns `HTTP 404: workflow ... not found on the default branch`. GitHub requires a brand-new manual workflow to exist on the default branch before it can be dispatched.
- 2026-05-21: Phase 3 unblocked. Cherry-picked the workflow bootstrap commit onto `master` as `6aeb3191`, pushed it, confirmed `gh workflow list --all` now shows `Manual Update Playwright Visual Baselines`, and dispatched run `26240623328` on `refactor/icon-consistency-pass`.
- 2026-05-21: Run `26240623328` failed at `npm ci` due lockfile drift (`esbuild@0.28.0` missing from `package-lock.json`). Updated lockfile with npm 10 and verified `npx npm@10.8.2 ci --dry-run` passes before rerunning workflow.
- 2026-05-21: Pushed lockfile fix `2da23289` and dispatched rerun `26241153971`; `npm ci` and `npm run build` passed, visual update is running.
- 2026-05-21: Run `26241153971` failed visual verify only on `live-viewer-no-presenter.png`; the screenshot included random `Room: {roomCode}` text. Masked that dynamic line before rerun.
- 2026-05-21: Run `26241432529` on `138584bf` passed `npm ci`, `npm run build`, visual update, and visual verify. It failed only on artifact upload because repository GitHub Actions artifact storage quota is exhausted, so snapshot artifact download/application remains blocked outside code.

## Unresolved Questions

_None._
