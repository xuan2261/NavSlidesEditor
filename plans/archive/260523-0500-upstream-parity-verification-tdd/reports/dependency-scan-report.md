---
title: "Dependency Scan Report"
date: 2026-05-23
status: done
---

# Dependency Scan Report

## Summary

New plan overlaps with QA and upstream verification work, but should not replace existing MVP plan. It is the comprehensive follow-up for upstream parity proof.

## Plan Relationships

| Existing plan | Status seen | Relationship |
|---|---|---|
| `260522-1339-qa-confidence-uplift-5-phase-tdd` | pending | Related. This plan expands deferred full matrix and parity gates. |
| `260519-1200-comprehensive-test-coverage-expansion` | completed | Dependency by reuse, not blocker. |
| `260514-1045-upstream-main-selective-port-workflow` | complete | Historical upstream strategy reference. |
| `260522-2013-insert-advanced-direct-actions-and-overlay-tdd` | pending/active context by reports | Recent feature QA input; no blocking dependency. |

## File Ownership Guidance

| Area | Owner phase |
|---|---|
| `docs/upstream-parity-matrix.md` | Phase 2 |
| `tests/e2e/fixtures/` parity fixtures | Phase 3 |
| `tests/e2e/elements/`, `tests/e2e/*editor*` | Phase 4 |
| `tests/e2e/export/`, `tests/e2e/live/`, `tests/e2e/games/` | Phase 5 |
| `tests/e2e/visual/`, manual docs | Phase 6 |
| `.github/workflows/`, `docs/*` final sync | Phase 7 |

## Unresolved Questions

- Whether to mark this plan blocked by the pending MVP QA plan depends on release schedule. Technically Phase 1-4 can start now.
