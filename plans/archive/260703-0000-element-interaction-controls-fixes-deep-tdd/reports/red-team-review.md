---
title: "Red-Team Review: Element Interaction and Control Bug Fixes"
status: completed
created: 2026-07-03
plan: ../plan.md
---

# Red-Team Review: Element Interaction and Control Bug Fixes

## Summary

The first plan draft was directionally sound but under-specified key invariants. Review found 12 actionable findings: 5 P0, 4 P1, and 3 P2. All accepted amendments were folded into `plan.md` and the relevant phase files.

## Accepted Findings

| ID | Severity | Finding | Applied To |
|---|---:|---|---|
| RT1 | P0 | Lock enforcement missed bypasses: z-order, group/ungroup, crop/reset crop, snap reference, direct context updates | `plan.md`, Phase 03 |
| RT2 | P0 | Lock-only semantics allowed possible mixed `{ locked:false, x }` payload exploit | `plan.md`, Phase 03 |
| RT3 | P0 | Mixed locked group semantics were contradictory and could still distort groups | `plan.md`, Phases 02, 03, 05 |
| RT4 | P0 | Context-menu target contract depended on async selection state and zero-arg callbacks | `plan.md`, Phase 04 |
| RT5 | P0 | Multi-select drag omitted snap/smart-guide contract | `plan.md`, Phase 02 |
| RT6 | P1 | D1 line click cannot be proven in JSDOM | Phases 01, 06, 07 |
| RT7 | P1 | D7 export clipping needs marker-safe SVG geometry, not wrapper overflow alone | Phase 06 |
| RT8 | P1 | Keyboard nudge needed shared batch clamp tests | Phase 02 |
| RT9 | P1 | `it.fails` tripwires lacked hard conversion gate | Phase 07 |
| RT10 | P1 | Group expansion helper did not define hidden member behavior | Phase 05 |
| RT11 | P2 | Final validation needed scoped Playwright smoke | Phases 01, 06, 07 |
| RT12 | P2 | Large-file risk ignored; helper extraction should be preferred over growing `EditorPage.jsx` | `plan.md`, Phases 02/03 guidance |

## Binding Decisions

- Locked elements accept only a pure lock toggle payload.
- Mixed locked groups are group-atomic no-op targets for movement and destructive/group-level mutations.
- Context-menu actions must use synchronous `contextSelectionIds` or explicit target-aware callbacks.
- Multi-select movement defines snap/guide behavior before clamping.
- One scoped Playwright smoke is mandatory for browser-only interaction behavior.

## Unresolved Questions

None.
