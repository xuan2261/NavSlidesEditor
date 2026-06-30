---
phase: 2
title: "Traceability Matrix"
status: completed
priority: P1
dependencies: [1]
---

# Phase 2: Traceability Matrix

## Overview
Convert the baseline into an enforceable capability × surface × depth matrix so “all functions” has a concrete pass/fail definition.

## Requirements
- Functional: every capability/control/variant row has owner, priority, user flow, contract depth, validator command, and evidence path.
- Non-functional: matrix gate must be deterministic and fast enough for CI.

## Architecture
Extend existing `scripts/feature-inventory/` outputs rather than creating a parallel system. Matrix rows should map to Vitest, Playwright, k6, corpus, visual, or manual-evidence gates.

## Related Code Files
- Modify: `scripts/feature-inventory/build-matrix.mjs`
- Modify: `scripts/feature-inventory/check-coverage-gate.mjs`
- Modify: `scripts/feature-inventory/validate-element-control-audit-matrix.mjs`
- Read: `tests/unit/data-testid-presence.test.js`
- Create: `plans/260629-2154-full-application-qa-verification-deep-tdd/reports/traceability-matrix.md`

## Implementation Steps
1. Define matrix schema: `capabilityId`, `surface`, `priority`, `depth`, `testFile`, `command`, `evidence`, `status`, `owner`.
2. Add coverage depths: inventory, smoke, contract, interaction, persistence, export, visual, a11y, security, performance, manual evidence.
3. Fail matrix gate for missing P1 coverage, stale paths, duplicate IDs, orphan tests, or capabilities without validators.
4. Map existing tests into the matrix before adding new tests.
5. Produce a gap list sorted by priority and cheapest test layer.

## TDD Gate
- Red: add fixture rows with missing validator commands and assert `matrix:gate` fails.
- Green: implement row validation and map real tests until gate passes for known covered rows.

## Success Criteria
- [x] Matrix gate blocks missing P1 test evidence.
- [x] Every P2/P3 control and variant has at least inventory/smoke/manual evidence, never a blank row.
- [x] Each row points to a real file and runnable command, or an explicit inventory-only warning.
- [x] Existing QA plans are referenced only as history, not as pass evidence.

## Risk Assessment
Risk: matrix becomes busywork. Mitigation: use it to drive actual blocking commands, not decorative spreadsheets.
