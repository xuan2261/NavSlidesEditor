---
title: "Test Governance and Matrix Debt Closure"
date: "2026-07-22 14:17 +07:00"
status: historical-complete
plan: "plans/archive/260531-2013-test-system-governance-and-matrix-debt-tdd/plan.md"
---

# Test Governance and Matrix Debt Closure

## Context

This is a chronological record for the completed [plan](../archive/260531-2013-test-system-governance-and-matrix-debt-tdd/plan.md), not current testing policy. All five phases landed together in commit `20d432749b9f76f939dd40e4a38f531f2a364c8b` on 2026-05-31: [governance repair](../archive/260531-2013-test-system-governance-and-matrix-debt-tdd/phase-01-p0-governance-contracts-repair.md), [evergreen evidence](../archive/260531-2013-test-system-governance-and-matrix-debt-tdd/phase-02-evergreen-release-evidence-docs.md), [commands/file menu](../archive/260531-2013-test-system-governance-and-matrix-debt-tdd/phase-03-matrix-debt-batch-a-commands-and-file-menu.md), [canvas/annotation shortcuts](../archive/260531-2013-test-system-governance-and-matrix-debt-tdd/phase-04-matrix-debt-batch-b-canvas-and-annotation-shortcuts.md), and [release hygiene](../archive/260531-2013-test-system-governance-and-matrix-debt-tdd/phase-05-release-lane-hygiene-and-final-gates.md).

## What happened

The root cause was blunt: test governance treated movable plan history as runtime configuration. `describe.skipIf()` skipped assertions but not the suite-definition `readdirSync`, so a relocated plan could still produce `ENOENT` during `npm run test:coverage` collection. The completion gate was changed to avoid filesystem reads unless `RUN_PLAN_GATE=1`, then resolve active or archived plan locations.

Release-confidence contracts stopped using a single plan report as authority and instead asserted stable facts in the [testing guide](../../docs/navslides-editor-vitest-playwright-k6-testing-guide.md), [manual smoke checklist](../../docs/manual-smoke-checklist.md), and generated [feature matrix](../../docs/feature-coverage-matrix.md). The ten warn-first editor-core allowlist entries were removed after focused coverage for command/file-menu behavior, canvas move/lock logic, and annotation shortcuts. For example, `applyMove`/`applyMoveBatch` made drag calculations testable while locked elements were excluded from drag selection.

This was tedious but necessary work. CI breaking because someone archived a plan is an embarrassing, self-inflicted dependency, not a sophisticated testing problem.

## Impact

The recorded [final validation](../archive/260531-2013-test-system-governance-and-matrix-debt-tdd/reports/final-validation-report.md) passed `npm run matrix:gate` at **100/100 verified, 0 ALLOWED, 0 failures, 0 orphans**. `npm run test:coverage` passed **250 files / 2,215 tests**, with one intentional skip; `npm run build` passed. Lint had **0 errors but 23 existing warnings**—not a clean bill of health, merely non-blocking at that point.

## Decisions

- Chose evergreen docs for release facts; rejected making archived operational reports permanent test dependencies.
- Chose small unit/component seams over a broad full-page Playwright expansion; the debt was wiring and pure behavior, not a reason to enlarge the browser platform.
- Kept the matrix gate warn-first rather than promoting it without the required green-CI evidence. No CI-platform or external-credential work was added.

## Concerns / limitations

These results are commit-time evidence from 2026-05-31, not proof that current `master` remains green. The opt-in plan gate still intentionally requires an active or archived directory when `RUN_PLAN_GATE=1`. The 23 lint warnings were not resolved here.

Unresolved questions: None.

## Next

- Archive owner: preserve this plan and its evidence links during the pending archival operation; do not treat this journal as product authority.
- Release maintainer: rerun the current matrix, coverage, build, and lint gates for the next release candidate rather than relying on these historical numbers.
