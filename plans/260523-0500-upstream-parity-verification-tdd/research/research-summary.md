---
title: "Research Summary"
date: 2026-05-23
status: done
---

# Research Summary

## Findings

Repo already has strong test infra:

| Layer | Existing assets |
|---|---|
| Unit/integration | `npm test`, `npm run test:coverage`, many Vitest files under client/server/shared |
| E2E | `npm run test:e2e`, specs under `tests/e2e/` |
| Visual | `tests/e2e/visual/`, `tests/e2e/visual-regression.spec.js` |
| Load | k6 REST and Socket.IO smoke/load/stress scripts |
| Corpus | `npm run test:corpus` for PPTX import/export fidelity |
| Docs | `docs/navslides-editor-vitest-playwright-k6-testing-guide.md` |

## Existing Relevant Plans

| Plan | Relevance |
|---|---|
| `260519-1200-comprehensive-test-coverage-expansion` | Completed broad coverage foundation; use as test command baseline |
| `260522-1339-qa-confidence-uplift-5-phase-tdd` | Pending MVP QA plan; this plan covers the deferred full matrix |
| `260514-1045-upstream-main-selective-port-workflow` | Defines upstream safety approach and selective port precedent |
| `260522-2013-insert-advanced-direct-actions-and-overlay-tdd` | Recent QA report with green ribbon/visual workflow gates |

## Gaps This Plan Closes

- No full upstream parity matrix.
- No standard "run same suite on upstream and current" workflow.
- Golden fixtures are not explicitly tied to upstream behavior.
- E2E pass does not yet prove feature-by-feature upstream equivalence.
- Manual QA exists as visuals/reports, but needs parity status rollup.

## Unresolved Questions

- Exact upstream ref still needs user/project owner decision.
