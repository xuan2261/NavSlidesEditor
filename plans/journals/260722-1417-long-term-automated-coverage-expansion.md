---
title: Long-Term Automated Coverage Expansion
date: 2026-07-22 14:17 +07:00
status: completed-with-concerns
component: test governance, Vitest, Playwright, k6
plan: ../archive/260615-1641-long-term-automated-coverage-expansion-tdd/plan.md
---

# Long-Term Automated Coverage Expansion

## Context

This journal closes the archival record for the [coverage-expansion plan](../archive/260615-1641-long-term-automated-coverage-expansion-tdd/plan.md). Its goal was not raw line coverage: it was evidence that high-risk editor behavior survives state mutation, persistence, export, synchronization, provider failure, and browser interaction.

## What happened

- **2026-06-15:** the baseline audit found that the 100/100 capability matrix was traceability, not exhaustive workflow proof. `npm run matrix:baseline-report` passed the coverage gate but then rejected stale `scripts/feature-inventory/run-results-vitest.json`; `npm run test` timed out at 126 s and a direct JSON Vitest run timed out at 300 s. The root cause was a matrix that could report green from stale, shallow evidence, not a lack of tags. See [Phase 1](../archive/260615-1641-long-term-automated-coverage-expansion-tdd/phase-01-baseline-audit-and-risk-taxonomy.md).
- **2026-06-16:** commit `125f3b75` added depth-aware evidence and its policy in [`scripts/feature-inventory/coverage-depth-policy.json`](../../scripts/feature-inventory/coverage-depth-policy.json), deep unit/component tests, and three bounded browser tests including [`editor-control-persistence.spec.js`](../../tests/e2e/coverage-depth/editor-control-persistence.spec.js).
- The later full validation recorded 300 Vitest files / 2,511 passing tests / 1 skipped test, and 475 passing Playwright tests / 22 skipped tests with no retry-passed flakes. External-boundary tests kept credentials out of CI; visual, keyboard, touch, and loopback k6 smoke coverage were documented and wired conservatively. See [Phases 3–7](../archive/260615-1641-long-term-automated-coverage-expansion-tdd/phase-03-unit-and-component-deep-coverage.md), [Phase 4](../archive/260615-1641-long-term-automated-coverage-expansion-tdd/phase-04-end-to-end-workflow-expansion.md), [Phase 5](../archive/260615-1641-long-term-automated-coverage-expansion-tdd/phase-05-external-boundary-contract-coverage.md), [Phase 6](../archive/260615-1641-long-term-automated-coverage-expansion-tdd/phase-06-visual-accessibility-and-performance-gates.md), and [Phase 7](../archive/260615-1641-long-term-automated-coverage-expansion-tdd/phase-07-ci-governance-docs-and-release-adoption.md).

## Impact

The suite now distinguishes `trace`, `behavior`, `persistence`, `export`, `sync`, `visual`, `a11y`, and `perf`; losing required depth emits a warn-first `DEPTH-WARN` instead of silently preserving a misleading PASS. The blunt truth: the old green matrix was easier to celebrate than to trust. This work made the evidence materially better without pretending every end-to-end or release-environment risk is solved.

## Decisions

- Keep depth enforcement warn-first; reject required-check or branch-protection promotion without deterministic reproduction and two target-branch green CI runs.
- Keep the E2E expansion bounded at three new tests against a cap of 12; use unit/component seams for combinatorial control behavior.
- Test provider failures at public route/service boundaries and preserve manual smoke rows unless automation proves the same observable risk.

## Concerns/limitations

- Required-check promotion was deliberately not performed: no two target-branch green CI links were available.
- Canonical visual snapshots were not run locally because their baseline requires the pinned Linux Playwright image in [the CI workflow](../../.github/workflows/github-actions-ci-pipeline-lint-unit-coverage-e2e-load-smoke.yml).
- The full release strict lane remains target-environment validation. The k6 WebSocket smoke run passed but emitted a non-fatal local `127.0.0.1:6565` API-port bind warning.

## Next

1. **CI operator, before any required-check change:** collect and link two target-branch green runs, then explicitly decide whether to promote depth/visual gates.
2. **Release validator, before the next release:** run the pinned-Linux visual baseline and full release strict lane; retain artifacts privately because screenshots can contain deck content.
3. **Future test owners, whenever a high-risk capability changes:** update its depth evidence and policy instead of adding a shallow capability tag.

## Unresolved questions

None.
