---
phase: 5
title: "Deep Behavior Tests (high-risk)"
status: completed
priority: P2
effort: "2.5d"
dependencies: [3]
---

# Phase 5: Deep Behavior Tests (high-risk)

## Overview

For high-risk capabilities, "renders without crashing" is not enough — the logic must be exactly right. This phase writes `tier:deep` tests that assert precise behavior for the capabilities most likely to be subtly wrong: rotation snapping, aspect-ratio resize, z-order math, group transforms, alignment/distribution geometry, undo/redo history bounds, clipboard fidelity, table merge/span, chart data mapping, timeline date scaling. Runs in parallel with Phase 4 (different files).

## Requirements

- **Functional** — assert exact behavior, not no-crash:
  - `canvas.rotate-snap`: rotating with Shift snaps to nearest 15° (e.g. 22° → 15°, 23° → 30°); without Shift, free angle preserved.
  - `canvas.resize-aspect`: Shift-resize preserves width/height ratio within tolerance; free resize does not.
  - `canvas.zorder`: `bringForward`/`sendBackward`/`bring-to-front`/`send-to-back` produce correct relative ordering among ≥3 elements (not just zIndex±1).
  - `canvas.group`: group transform moves children together; ungroup restores absolute positions; nested selection bounds correct.
  - `canvas.align`/`canvas.distribute`: left/center/right/top/middle/bottom compute correct coordinates; distribute spaces evenly among ≥3.
  - `flow.undo-redo`: 50-step bounded history (per README); 51st undo does not exceed bound; redo stack cleared on new action.
  - `flow.clipboard`: copy→paste preserves all props + offsets position; cut removes original; duplicate (`Ctrl+D`) clones with offset.
  - `flow.multiselect`: shift-click accumulates; move/delete affect all selected.
  - `element.table`: merge cells produces correct `mergedCells` rowSpan/colSpan; per-cell styles map to right `[row][col]`.
  - `element.chart`: dataset → Chart.js config mapping correct for bar/line/pie.
  - `element.timeline`: events map to correct positions across `timelineStart`/`timelineEnd` range; `tickSpacing: auto` produces sane ticks.
- **Non-functional**
  - Each deep test tagged `[cap:<id> tier:deep]`.
  - Assert numeric outcomes with explicit expected values + tolerance where float math is involved.
  - Files ≤ 200 LOC; co-located with the unit under test.

## Architecture

**Test layer choice per capability:**
- Pure-logic caps (rotate-snap math, zorder, align/distribute geometry, undo bounds, clipboard transform, table merge) → **unit tests** against the store/util functions (`editor-store.js`, `smartGuides.js`, geometry helpers). Fast, exact, run every PR.
- Caps requiring DOM/interaction (drag-to-rotate handle, shift-resize via pointer) → integration via Testing Library + `use-canvas-pointer-interaction` hook, OR extend existing e2e (`tests/e2e/element-interactions.spec.js`, `element-properties-shape.spec.js`). Prefer unit on the underlying math function; reserve e2e for the wiring.

**Anchor to existing tests** (extend, don't duplicate):
- `client/src/stores/editor-store.test.js` — undo/redo, zorder, multiselect.
- `client/src/utils/smartGuides.test.js` — snapping/guides geometry.
- `client/src/hooks/use-clipboard.test.js` — clipboard fidelity.
- `client/src/hooks/use-canvas-pointer-interaction.test.js` — rotate/resize pointer math.
- `client/src/components/timeline-element.test.jsx` — timeline scaling.

**Verify-before-assert discipline:** for each high-risk cap, first READ the current implementation to learn the actual expected output (e.g. exact snap rounding rule, zIndex strategy), then write the assertion to that verified behavior. Cite `file:line` for the rule in the test's nearby comment only if the WHY is non-obvious (per code-comment rule). If implementation looks wrong while writing the test, flag it — do not silently "fix" by weakening the test.

## Related Code Files

- **Create / extend:** deep `tier:deep` tests in the anchor files above; new files only where no anchor exists (e.g. `editor-store-zorder-and-align-distribute.deep.test.js`).
- **Read (to learn exact behavior):** `client/src/stores/editor-store.js`, `client/src/utils/smartGuides.js`, `client/src/hooks/use-canvas-pointer-interaction.js`, `client/src/hooks/use-clipboard.js`, table renderer, chart renderer, `timeline-element-renderer`.
- **Create:** `reports/deep-test-findings.md` — record any real logic bugs surfaced.

## Implementation Steps (TDD)

1. Pull high-risk DEEP-GAP rows from the matrix JSON.
2. **Per capability:** read the implementation to confirm the exact correct behavior (verified decision, cite source).
3. **`red:`** write the `tier:deep` test asserting exact expected values. Run.
   - Passes → behavior correct, now deep-verified.
   - Fails → either the test's expectation was wrong (fix test to verified behavior) or a real bug (fix source `green:`, record in `deep-test-findings.md`).
4. Re-run `npm run matrix`; DEEP-GAP count falls.
5. **`refactor:`** factor shared geometry fixtures; ensure exact-value assertions documented; files ≤ 200 LOC.

## Success Criteria

- [ ] Every high-risk capability (rotate-snap, resize-aspect, zorder, group, align, distribute, undo-redo, clipboard, multiselect, table-merge, chart-mapping, timeline-scaling) has a `tier:deep` test asserting exact behavior
- [ ] Matrix DEEP-GAP count for editor-core reaches 0 (or allowlisted with reason)
- [ ] Rotation snap test proves 15° increments; undo test proves 50-step bound; zorder test proves correct ordering among ≥3 elements
- [ ] Any logic bug found is fixed + recorded in `deep-test-findings.md`; test expectations trace to verified implementation behavior
- [ ] No test weakened to pass — assertions match real correct behavior
- [ ] Commit log: `red:`→`green:`→`refactor:`

## Risk Assessment

- **Expected-value uncertainty** → read implementation first; assert to verified behavior; cite source. Avoids "test the bug" trap.
- **Float/pixel flakiness** → use tolerances (`toBeCloseTo`) for geometry; avoid exact equality on computed floats.
- **Drag-interaction tests flaky in jsdom** → assert the underlying math function (unit) rather than simulated pointer drag where possible; reserve e2e for true wiring checks.
- **Found bug expands scope** → record in findings; fix if small + in editor-core; escalate to user if it's a large pre-existing defect (don't balloon the phase).
