# Red-Team Review - 2026-05-22

## Summary

- Findings: 15 deduped from 4 hostile lenses.
- Accepted: 12.
- Rejected: 3.
- Main correction: reduce scope, define measurable state/critical gates, and avoid brittle snapshot/test contracts.

## Findings

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | Scope too broad for known ribbon outlier | High | Accept | Overview, Phases 2/3/6/7 |
| 2 | Critical controls undefined | Critical | Accept | Success Criteria, Phase 05 |
| 3 | Height decision deferred | High | Accept | Overview, Phase 01 |
| 4 | Tailwind-class contract tests brittle | Medium | Accept | Phase 01 |
| 5 | Missing stable ribbon selectors | Critical | Accept | Phase 01, Phase 05 |
| 6 | Double-scroll owner ambiguity | High | Accept | Phase 02, Phase 05 |
| 7 | Static taxonomy ignores conditional states | Critical | Accept | Phase 03 |
| 8 | Fake `Contextual` group label | High | Accept | Phase 03, Phase 04 |
| 9 | TDD baseline can leave CI red | Critical | Accept | Phase 01 |
| 10 | Format selected setup flaky | High | Accept | Phase 04 |
| 11 | Insert 1024px `fixme` hides regression | Critical | Accept | Phase 05 |
| 12 | Visual baseline workflow too loose | High | Accept | Phase 06 |
| 13 | Security checklist for all ribbon commands | High | Reject | No auth/data-boundary change; covered as command visibility/focus gates. |
| 14 | npm audit/npm ci required for layout-only plan | Medium | Reject | No dependency changes planned; package/lockfile diff check is enough. |
| 15 | Full E2E always required | High | Reject | Require full unit + curated editor/a11y/visual Chromium gates when blast radius expands; full E2E remains optional. |

## Reviewer Lenses

- Security Adversary: accepted critical-control and snapshot-trust concerns; rejected broad security checklist/audit requirements for layout-only work.
- Assumption Destroyer: accepted selector, scroll-owner, state-matrix, and height decision findings.
- Failure Mode Analyst: accepted no-red-CI, deterministic Format setup, Insert 1024 `fixme`, and canonical snapshot workflow findings.
- Scope & Complexity Critic: accepted scope reduction and abstraction/taxonomy constraints.

## Unresolved Questions

- None.
