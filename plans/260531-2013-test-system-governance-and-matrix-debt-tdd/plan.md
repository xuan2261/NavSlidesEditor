---
title: "Test System Governance And Matrix Debt TDD"
description: "Repair brittle test-governance contracts, move release evidence to evergreen docs, then shrink the 10-entry feature matrix allowlist without broad test-platform overhaul."
status: completed
priority: P0
effort: "5-7 dev-days"
branch: master
tags: [testing, qa, tdd, docs, ci, tech-debt]
created: 2026-05-31
createdBy: ck-plan-skill
source: plans/reports/260531-1908-test-system-review-and-roadmap.md
mode: "--deep --tdd"
blockedBy: []
blocks: []
---

# Test System Governance And Matrix Debt TDD

## Overview

Fix the current red `npm run test:coverage` governance failures first, then close the known feature-coverage debts in focused batches. Keep scope narrow: no global coverage chase, no per-worker Playwright server platform, no real external provider credentials in CI.

## Source Evidence

| Source | Use |
|---|---|
| [Test System Review And Roadmap](../reports/260531-1908-test-system-review-and-roadmap.md) | Primary findings, recommended roadmap, current failures |
| [Testing Guide](../../docs/navslides-editor-vitest-playwright-k6-testing-guide.md) | Existing test commands, CI lane docs, matrix semantics |
| [Feature Coverage Matrix](../../docs/feature-coverage-matrix.md) | Current 100/100 verified state and 0 ALLOWED debts |
| [Code Standards](../../docs/code-standards.md) | Test annotation, selector, file-size, code organization rules |

## Cross-Plan Dependencies

| Relationship | Plan | Status | Notes |
|---|---|---|---|
| Related | [QA Confidence Uplift](../260522-1339-qa-confidence-uplift-5-phase-tdd/plan.md) | pending | Historical QA process context; non-blocking |
| Related | [Upstream Parity Verification](../260523-0500-upstream-parity-verification-tdd/plan.md) | in_progress | Broader parity effort; this plan fixes local test governance first |

## Phases

| Phase | Name | Status | Priority | Effort |
|---|---|---|---|---|
| 1 | [P0 Governance Contracts Repair](./phase-01-p0-governance-contracts-repair.md) | completed | P0 | 1d |
| 2 | [Evergreen Release Evidence Docs](./phase-02-evergreen-release-evidence-docs.md) | completed | P0 | 1d |
| 3 | [Matrix Debt Batch A: Commands And File Menu](./phase-03-matrix-debt-batch-a-commands-and-file-menu.md) | completed | P1 | 1.5d |
| 4 | [Matrix Debt Batch B: Canvas And Annotation Shortcuts](./phase-04-matrix-debt-batch-b-canvas-and-annotation-shortcuts.md) | completed | P1 | 1.5-2d |
| 5 | [Release Lane Hygiene And Final Gates](./phase-05-release-lane-hygiene-and-final-gates.md) | completed | P1 | 1d |

## Dependency Graph

```text
Phase 1 -> Phase 2 -> Phase 3 -> Phase 4 -> Phase 5
```

Phase 1 and 2 must land before feature-matrix debt work so the full coverage suite is trustworthy again. Phase 3 and 4 can be split later only if file ownership is exclusive.

## Global Success Criteria

- `npm run test:coverage` passes.
- `npm run matrix:gate` passes with fewer than 10 ALLOWED warnings; target 0 if seams stay small.
- Release-confidence tests no longer hard-code movable top-level plan paths as the only source of evidence.
- Evergreen docs contain final release lane, manual smoke, matrix debt, and governance facts.
- No new broad Playwright suite where a unit/component seam is sufficient.

## Recommended Cook Command

```powershell
/ck:cook --tdd C:\Work\NavSlidesEditor\plans\260531-2013-test-system-governance-and-matrix-debt-tdd\plan.md
```

## Unresolved Questions

- None.
