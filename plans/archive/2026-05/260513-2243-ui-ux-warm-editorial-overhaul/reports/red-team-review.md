---
title: "Red Team Review"
type: review
created: 2026-05-13
---

# Red Team Review

## Summary

Main risk is aesthetic overreach. The plan must improve usability without making a dense editor feel like a landing page. Canvas fidelity is non-negotiable.

## Findings

| Severity | Risk | Mitigation |
| --- | --- | --- |
| High | Global accent change can hide selection/focus affordances | Keep separate tokens: brand, focus, selection, danger |
| High | Serif/font changes can hurt dense controls and offline builds | Use serif only in dashboard/empty states; fallback first |
| High | Snapshot churn from broad UI changes | Update visual tests intentionally, one phase at a time |
| Medium | Shared ModalShell can break Escape/focus behavior | Add focused modal tests before wide migration |
| Medium | Larger hit areas can reduce editor workspace | Tune toolbar/panel density; no mobile-first exaggeration on desktop |
| Medium | Removing `transition-all` can miss intended transforms | Replace with explicit `transition-[color,border-color,background-color,box-shadow,transform]` |

## Required Plan Adjustments

- Every phase must include build/test gate.
- Phase 1 must define separate semantic tokens for `--brand`, `--accent`, `--focus`, `--selection`.
- Phase 4 must migrate modals incrementally.
- Phase 8 must update docs and changelog.

## Unresolved Questions

- Whether to keep blue selection token as current `#6366f1` or move to accessible blue from `DESIGN.md`.
