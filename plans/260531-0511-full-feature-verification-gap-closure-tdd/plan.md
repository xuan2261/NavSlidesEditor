---
title: "Full Feature Verification Gap Closure TDD"
description: "Close editor-core capability gaps, add release-grade user journey verification, then extend the matrix to export/import, presentation, live, games, AI, sync, and release gates."
status: pending
priority: P1
effort: "12-16 dev-days"
branch: master
tags: [qa, testing, tdd, coverage, e2e, ci, release-grade]
blockedBy: []
blocks: []
created: 2026-05-31
---

# Full Feature Verification Gap Closure TDD

## Overview

Follow-up to the completed capability matrix plan. Do not rebuild the matrix. Use it to remove false confidence: convert `ALLOWED` gaps to real PASS where practical, add risk-based E2E journeys, then extend coverage beyond editor-core.

## Cross-Plan Dependencies

| Relationship | Plan | Status |
|---|---|---|
| Builds on | [Feature Coverage Traceability Matrix System](../260530-0854-feature-coverage-traceability-matrix-system-tdd/plan.md) | completed |
| Complements | [QA Confidence Uplift MVP](../260522-1339-qa-confidence-uplift-5-phase-tdd/plan.md) | pending |
| Complements | [E2E Test Cleanup and Coverage Expansion](../260524-0959-e2e-cleanup-and-coverage-tdd/plan.md) | completed |

## Phases

| Phase | Name | Status |
|---|---|---|
| 1 | [Baseline and Verification Contract](./phase-01-baseline-and-verification-contract.md) | Pending |
| 2 | [Editor Core Gap Closure](./phase-02-editor-core-gap-closure.md) | Pending |
| 3 | [Critical User Journey E2E Coverage](./phase-03-critical-user-journey-e2e-coverage.md) | Pending |
| 4 | [Extended Domain Matrix Expansion](./phase-04-extended-domain-matrix-expansion.md) | Pending |
| 5 | [CI Gates and Release Confidence](./phase-05-ci-gates-and-release-confidence.md) | Pending |
| 6 | [Docs, Manual QA, and Maintenance Loop](./phase-06-docs-manual-qa-maintenance-loop.md) | Pending |

## Execution Strategy

Phase 1 first. Phase 2 and 3 can run parallel after Phase 1 if file ownership is split. Phase 4 starts after Phase 1 but should not block editor-core. Phase 5 waits for 2-4. Phase 6 finalizes docs and operating process.

## Success Criteria

- `docs/feature-coverage-matrix.md` remains generated source of truth, not hand-edited.
- Editor-core matrix reaches at least 90/100 PASS; high-risk `ALLOWED` entries either become PASS or have dated, justified debt.
- Critical user journeys have Playwright coverage with stable POM selectors.
- Extended domains have capability IDs and first-pass smoke/deep policy.
- `npm run matrix:gate`, `npm test`, and selected E2E core lane pass before completion.
- Release checklist tells user what is verified, what is manual, what remains risk.

## Dependencies

- Existing Vitest, Playwright, k6 setup.
- Existing `scripts/feature-inventory/*` matrix system.
- Existing POM helpers in `tests/e2e/pages/`.
- Docs: `docs/feature-coverage-matrix.md`, `docs/navslides-editor-vitest-playwright-k6-testing-guide.md`, `docs/code-standards.md`.

## Out Of Scope

- Product behavior rewrites unless tests reveal real bugs.
- New dashboard app; Markdown/JSON is enough.
- 100% line coverage target.
- Full PPTX fidelity perfection; use existing strict PPTX audit for release signoff.

## Cook Handoff

Run implementation with:

```bash
/ck:cook C:\Work\NavSlidesEditor\plans\260531-0511-full-feature-verification-gap-closure-tdd\plan.md
```
