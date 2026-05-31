# Deep Behavior Test Findings — high-risk editor-core

`tier:deep` tests assert EXACT behavior (not no-crash) for high-risk
capabilities. Verify-before-assert discipline: each implementation was read to
learn its correct behavior, then assertions were written to that verified
behavior. No test was weakened to pass.

## Verified (deep tests written, behavior CORRECT — no bug)

| Capability | Test file | What is proven | Source seam |
|---|---|---|---|
| canvas.rotate-snap | canvas/use-canvas-resize-rotate.deep.test.js | Shift-rotate snaps to nearest 15° (22°→15°, 23°→30°); free angle preserved; every 15° multiple maps to itself across full turn; normalized [0,360) | `getRotationAngle` (`Math.round(rotation/15)*15`) |
| canvas.resize-aspect | canvas/use-canvas-resize-rotate.deep.test.js | Shift-resize locks w/h ratio on dominant-delta axis; N/W handles reposition anchor so opposite corner stays fixed; edge handles never lock; MIN_SIZE floor respected | `applyResizeAspectRatio` |
| canvas.align | hooks/use-slide-operations-align-group-distribute.deep.test.js | left/right/center-h/top compute exact coordinates among 3 elements; <2 selected is a no-op | `alignElements` |
| canvas.distribute | hooks/use-slide-operations-align-group-distribute.deep.test.js | distribute-h/-v compute equal gap with endpoints fixed (gap=(span−ΣsizeΣ)/(n−1)) | `alignElements('distribute-*')` |
| canvas.group | hooks/use-slide-operations-align-group-distribute.deep.test.js | group assigns one shared groupId to all selected, ungroup clears it; single element is a no-op | `groupElements`/`ungroupElements` |
| element.table | canvas/element-renderers/table-element-merge.deep.test.jsx | mergedCells produce correct rowSpan/colSpan on anchor `<td>`; covered cells dropped; degenerate 1×1 covers nothing; horizontal-only span works | `TableRenderer` merge loop |
| flow.clipboard | hooks/use-clipboard.test.js (tagged Phase 3) | copy/paste/cut/duplicate fidelity, +20/+20 offset, locked-guard | pure `create*Operation` fns |
| flow.multiselect | stores/editor-store-multiselect.deep.test.js | selectElement replaces; addToSelection appends in order; functional updater; clearSelection empties + exits editing | editor-store selection actions |

**Result: 0 logic bugs found.** Every high-risk behavior tested was already
correct — the deep tests now lock that correctness against regression.

## Deferred deep tests (recorded for Phase 6 dated allowlist)

These high-risk caps have NO clean pure/integration seam today. Deep-testing
them would require refactoring source solely to create a test seam, which the
plan forbids (don't restructure source just for tests; YAGNI). Each is recorded
here with an honest reason and routed to the Phase 6 allowlist rather than
faked green.

| Capability | Why deferred | Path to close |
|---|---|---|
| canvas.zorder | Logic is inline in `EditorPage.jsx:726` (`reordered.map((el,i)=>({zIndex:i+1}))`), entangled with component state — no pure export. Smoke-level ordering covered; exact ≥3-element ordering needs the array extracted. | Extract a `reorderByZ(elements, id, edge)` pure helper (separate refactor), then deep-test. |
| flow.undo-redo | History is `historyRef` + 500 ms debounce inside `EditorPage.jsx:513`/`756`. The 50-step bound (`slice(-50)`) is real but only reachable through the component effect, not a unit seam. | Extract a `pushHistory(stack, snapshot)` helper bounded to 50; deep-test the bound directly. |
| element.chart | Chart.js config is built inline in `ChartRenderer` as a template string; no exported mapping fn. | Extract `buildChartConfig(element)`; assert bar/line/pie dataset mapping. |
| element.timeline | Event→position scaling is computed inside `TimelineRenderer` render body; no pure export. | Extract `scaleEventToTimeline(event, start, end, width)`; assert positions + auto ticks. |

These are NOT silent gaps: Phase 6 adds each to `coverage-gate-allowlist` with
`reason` + `added` date so they surface as acknowledged debt (WARN), and the
gate fails if any NEW high-risk cap appears without a deep test.

## Open questions

- Should the 4 deferred caps' seam-extraction refactors be a follow-up plan, or
  folded into the parallel `260529-2256-editorpage-hardening` epic that already
  touches `EditorPage.jsx`? (Recommend the latter — zorder + undo-redo live
  exactly where that refactor operates.)
