---
title: "Long Term Automated Coverage Expansion TDD"
description: "Raise long-term regression confidence beyond the current 100/100 editor-core capability matrix by deepening element-control, persistence, export, live, external-boundary, visual, accessibility, and CI governance coverage."
status: completed-with-concerns
priority: P0
effort: "12-18 dev-days"
branch: master
tags: [testing, qa, tdd, playwright, vitest, coverage, governance]
created: 2026-06-15
createdBy: ck-plan-skill
mode: "--deep --tdd"
blockedBy: []
blocks: []
---

# Long Term Automated Coverage Expansion TDD

## Overview

Create durable automated coverage for the whole repo. Existing `docs/feature-coverage-matrix.md` reports 100/100 PASS for editor-core, but that is minimum capability traceability. This plan expands depth: controls must prove UI action, state mutation, persistence/reload, and export/presentation impact where applicable.

## Source Evidence

| Source | Use |
|---|---|
| [README](../../README.md) | Product surface and supported features |
| [Testing Guide](../../docs/navslides-editor-vitest-playwright-k6-testing-guide.md) | Existing Vitest, Playwright, k6, matrix, CI conventions |
| [Feature Coverage Matrix](../../docs/feature-coverage-matrix.md) | Current 100/100 editor-core baseline |
| [Critical User Journeys](../../docs/critical-user-journeys.md) | Existing release-blocking flows |
| [Manual Smoke Checklist](../../docs/manual-smoke-checklist.md) | Manual-only release risk map |
| [Code Standards](../../docs/code-standards.md) | Selector, file-size, and test annotation rules |

## Cross-Plan Dependencies

| Relationship | Plan | Status | Notes |
|---|---|---|---|
| Related | [Test System Governance And Matrix Debt TDD](../260531-2013-test-system-governance-and-matrix-debt-tdd/plan.md) | completed | Provides matrix governance baseline |
| Related | [Element and Control Functional Fixes TDD](../260609-0830-element-control-functional-fixes-tdd/plan.md) | pending metadata, phases completed | Provides fixed control behavior to preserve |

## Phases

| Phase | Name | Status | Priority | Effort |
|---|---|---|---|---|
| 1 | [Baseline Audit And Risk Taxonomy](./phase-01-baseline-audit-and-risk-taxonomy.md) | completed-with-concerns | P0 | 1.5d |
| 2 | [Coverage Matrix Expansion Model](./phase-02-coverage-matrix-expansion-model.md) | completed | P0 | 2d |
| 3 | [Unit And Component Deep Coverage](./phase-03-unit-and-component-deep-coverage.md) | completed | P0 | 3d |
| 4 | [End To End Workflow Expansion](./phase-04-end-to-end-workflow-expansion.md) | completed-with-concerns | P0 | 3d |
| 5 | [External Boundary Contract Coverage](./phase-05-external-boundary-contract-coverage.md) | completed-with-concerns | P1 | 2d |
| 6 | [Visual Accessibility And Performance Gates](./phase-06-visual-accessibility-and-performance-gates.md) | completed-with-concerns | P1 | 2d |
| 7 | [CI Governance Docs And Release Adoption](./phase-07-ci-governance-docs-and-release-adoption.md) | completed-with-concerns | P0 | 1.5d |

## Dependency Graph

```text
Phase 1 -> Phase 2 -> Phase 3 -> Phase 4 -> Phase 5 -> Phase 6 -> Phase 7
```

## Global Success Criteria

- Expanded matrix distinguishes `trace`, `behavior`, `persistence`, `export`, `visual`, `a11y`, and `perf` coverage depth.
- Coverage-depth labels have a minimal policy: each label has an owner, allowed test layer, required assertion evidence, and promotion rule.
- New tests are failing-first before implementation or fixture updates.
- `npm run lint`, `npm run test`, `npm run build`, `npm run matrix:gate`, and targeted Playwright suites pass.
- Long-flow coverage covers editor controls, element properties, persistence/reload, import/export, live, games, and external-boundary contracts.
- Net-new Playwright coverage stays within the Phase 4 budget unless Phase 1 proves a higher-risk gap; unit/component tests handle combinatorics.
- No production abstraction is added only for tests unless the current code has no stable injectable boundary and the abstraction is documented in the phase report.
- Manual smoke checklist shrinks or becomes explicitly manual-only with rationale.
- No broad brittle UI tests where a unit/component seam gives equivalent confidence.

## Red Team Review

### Session - 2026-06-15

**Findings:** 8 (8 accepted, 0 rejected)  
**Severity breakdown:** 0 Critical, 5 High, 3 Medium  
**Full report:** [red-team-review-report.md](./reports/red-team-review-report.md)

## Validation Log

### Session 1 - 2026-06-15

**Trigger:** `/ck-plan validate C:\Work\NavSlidesEditor\plans\260615-1641-long-term-automated-coverage-expansion-tdd\plan.md`  
**Questions asked:** 3  
**Interview mode:** Interactive question tool unavailable in current mode; applied conservative recommended defaults and documented assumptions.
**Full report:** [validation-session-1-report.md](./reports/validation-session-1-report.md)

Confirmed: warn-first coverage-depth rollout, keep Phase 4 E2E cap, new gates start warn-first. Propagated to Phases 2, 4, and 7.

## Recommended Cook Command

```powershell
/ck:cook --tdd C:\Work\NavSlidesEditor\plans\260615-1641-long-term-automated-coverage-expansion-tdd\plan.md
```

## Unresolved Questions

- None.
