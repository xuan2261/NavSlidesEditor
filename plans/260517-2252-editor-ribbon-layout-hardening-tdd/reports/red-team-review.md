---
title: "Red Team Review - Editor Ribbon Layout Hardening Plan"
status: complete
created: 2026-05-17
---

# Red Team Review - Editor Ribbon Layout Hardening Plan

## Summary

Plan is feasible. Main danger: over-designing responsive ribbon. Keep phases strict. Tests first.

## Findings

| Severity | Finding | Mitigation |
| --- | --- | --- |
| High | Compact dropdowns can break TipTap selection if commands use click instead of mouseDown preservation. | Phase 5 requires `rememberSelection`, `runTextCommand`, `onMouseDown.preventDefault`. |
| High | New Button variant can accidentally change all icon buttons if `icon` is weakened. | Phase 2 keeps `icon` strict and adds separate `ribbon`. |
| Medium | Browser metric tests may flag intentional horizontal scroll as failure. | Tests distinguish clipped individual controls from intentional tab/ribbon scroll. |
| Medium | Insert grouping can reduce discoverability. | Keep Basic/Shapes/Content direct; group only Media/Embed/Advanced. |
| Medium | Header More menu would add complexity. | Phase 6 forbids More menu unless later approved. |
| Low | Screenshot evidence may become stale. | Final report captures new screenshots and metrics. |

## Hard Constraints

- No multi-row ribbon.
- No route/store rewrite.
- No new dependency.
- No backend work.

## Recommendation

Proceed. Do not skip Phase 1. If tests are not created first, this becomes cosmetic guesswork.

## Unresolved Questions

- None.
