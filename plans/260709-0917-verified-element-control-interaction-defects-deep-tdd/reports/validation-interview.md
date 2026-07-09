# Validation Interview — Verified Element Control Interaction Defects

**Date:** 2026-07-09  
**Mode:** deep auto-validate (decisions locked from debug session)

## Critical questions

| # | Question | Answer locked |
|---|----------|---------------|
| 1 | Cut locked: skip or allow? | **Skip** (parity delete/dup) |
| 2 | Mixed cut selection after? | Locked survivors remain selected |
| 3 | Table merge on +row: preserve or wipe? | **Preserve in-bounds** |
| 4 | Find/replace: table only or all types? | **Table only** Phase 3; rest stretch/follow-up |
| 5 | Group feedback: toast lib? | **No** — minimal aria-live notice |
| 6 | Callout: default 40 or MIN_SIZE exception? | **Default 40** |
| 7 | Concurrent UI a11y plan? | Non-blocking; avoid wrapper conflicts |
| 8 | Full suite gate? | Yes, Phase 6 |

## Acceptance criteria (plan-level)

1. Locked elements survive Cut; free members cut normally.
2. Adding table row/col keeps valid merges.
3. Find/replace finds and replaces table cell text.
4. Blocked group action shows accessible notice.
5. New callouts ≥ 40px; mixed opacity not silently authoritative.
6. Regression harness + docs; `npm run test` + lint green.

## Ambiguity remaining

**None** for cook. Optional stretch items listed Phase 6.

## Validation result

**passed-with-amendments** — product decisions written into `plan.md` Locked Decisions.
