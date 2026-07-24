---
title: "Element interaction controls: seven contracts, point-in-time closure"
date: 2026-07-22 14:17 +07:00
status: completed
plan: ../archive/260703-0000-element-interaction-controls-fixes-deep-tdd/plan.md
---

# Element Interaction Controls: Seven Contracts, Point-in-Time Closure

## Context

The completed [deep-TDD plan](../archive/260703-0000-element-interaction-controls-fixes-deep-tdd/plan.md) turned D1–D7 into regression contracts: line hit testing/export, shared movement bounds, keyboard nudge, locks, context-menu targeting, and group selection. The root cause was not seven isolated defects. We had let pointer, keyboard, ribbon, context-menu, and export paths each mutate or render elements with their own exceptions.

## What happened

Red-team review stopped the tempting “guard `updateSelectedElements` and move on” patch. The adopted contract required strict lock-only updates, group-atomic locks (including no ungroup escape), synchronous context targets, one batch drag delta after snap/guide resolution, and a real-browser line-hit test.

Commit `77f8e6de` (2026-07-04) shipped the repair across 32 files. It added shared batch clamping in [the pointer interaction hook](../../client/src/components/canvas/use-canvas-pointer-interaction.js), lock-aware fanout in [the update utility](../../client/src/utils/element-update-fanout.js), group expansion in [selection resolution](../../client/src/utils/active-slide-selection.js), synchronous context selection in [SlideCanvas](../../client/src/components/SlideCanvas.jsx), and marker-safe line rendering in [the shared renderer](../../shared/src/element-renderers.js). Regression coverage included [line export](../../shared/tests/line-export-clipping.test.js) and [Chromium interaction smoke](../../tests/e2e/editor-element-interactions.spec.js).

## Impact

At that commit, grouped/multi-selected elements preserved relative offsets at boundaries; locked elements accepted only an explicit pure unlock; right-click actions targeted the clicked selection once; and thin lines became selectable without a bounding-box click trap or clipped markers in export. The historical completion evidence records 168 targeted Vitest tests, two Chromium tests, and a full suite of 2,733 tests in 320 files passing; lint passed with 16 pre-existing warnings and build passed.

## Decisions

- Chose one clamped batch delta over per-element clamping; the latter visibly distorted groups at edges.
- Chose group-atomic blocking over partial movement or ungrouping when one member is locked/hidden; partial mutation silently corrupts the group contract.
- Chose explicit synchronous context IDs over waiting for React selection state; async reconciliation was the double-delete race.
- Chose SVG stroke targeting plus Playwright over wrapper-wide pointer capture or JSDOM-only proof; neither alternative proves real hit testing safely.

## Concerns / limitations

The repo-wide `npx prettier --check .` failed on **1,919** existing unformatted files. Touched code passed a scoped Prettier check, but the repository was not formatting-clean. The full suite also contained one skip, although the D1–D7 touched-test scan found no `it.fails`, `test.fails`, or `.skip` markers.

The uncomfortable truth is that “completed” was a point-in-time validation result, not immunity from later regressions. Commits `11f1c6be` (2026-07-08) and `fedd2a9d` (2026-07-09) revisited overlapping wrapper, movement, editor, and cut/lock paths; the latter explicitly aligned Cut with locked-member behavior. Do not cite this plan as proof that every later interaction edge case was already solved.

## Next

Owner: repository maintainer. Before archival, preserve this journal with the plan and treat its test counts as historical evidence only. Any future change to these interaction paths must rerun the linked focused tests and browser smoke before claiming equivalent coverage. AgentWiki publication was skipped: no external-sharing authorization exists.

## Unresolved questions

None.
