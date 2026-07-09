# Researcher 01 — Verified Findings Matrix

**Date:** 2026-07-09  
**Mode:** deep plan research (session debug + code verification)

## Verdicts used for plan scope

| ID | Finding | Verdict | Phase |
|----|---------|---------|-------|
| V1 | Cut deletes locked; Delete/Dup skip | CONFIRMED | 1 |
| V2 | Table normalize wipes all merges | CONFIRMED | 2 |
| V3 | Find/replace no table cells | CONFIRMED | 3 |
| V4 | Group block silent | CONFIRMED | 4 |
| V5 | Callout 36 < MIN_SIZE 40 | CONFIRMED | 5 |
| V6 | Opacity mixed slider UX | CONFIRMED | 5 |
| — | Multi-select arrow nudge broken | **FALSE** | out of scope |
| — | Hot-potato/Jeopardy not implemented | **OVERSTATED** | out of scope |
| — | PPTX no shadow/filter | DESIGN LIMIT | out of scope |

## Prior art

- `260608-1503` fixed dup skip locked, paste group remap, align/marquee locked — **did not fix cut**.
- Table utils tests **encode wipe as expected** — Phase 2 must rewrite tests, not only code.

## Recommendation

Six-phase TDD plan; P0 cut first; no game/export work.
