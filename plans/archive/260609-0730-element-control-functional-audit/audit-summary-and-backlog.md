# Element & Control Functional Audit — Consolidated Backlog
Date: 2026-06-09
Scope: 19 element types × all controls × 3 render targets (canvas / reveal HTML / PPTX) + E2E coverage of just-shipped fixes
Source reports: `reports/stream-a-element-control-matrix.md`, `reports/stream-b-e2e-coverage-gaps.md`, `reports/stream-d-control-export-fidelity.md`
Method: read-only static audit, 3 parallel agents. No source changed.

---

## Cross-Report Reconciliation (verified)

**Opacity — A and D conflicted; D is correct (verified by reading source).**
`canvas-element-wrapper.jsx:96-114` (`elementWrapperStyle`) has NO `opacity` key. Stream A miscited line 98 (that line is width/height) as the opacity consumer — wrong. Only `shape` applies opacity (internally, `shape-element-renderer.jsx:169`). For the other 18 types the opacity control is a near-global no-op on canvas AND drops on both export paths. → merged as **P0-OPACITY** below; Stream A's "Opacity WORKS" row retracted.

Other A/D findings spot-checked and confirmed: code `borderRadius:0` hardcode (`canvas-element-wrapper.jsx:137`), `filterSaturate` read but no slider (`:167`).

---

## Headline numbers

| Stream | Found |
|--------|-------|
| A — element×control matrix | 1 DEAD, 10 MISSING, 1 WRITES-IGNORED, 1 WRONG + systemic indeterminate gap |
| B — E2E coverage of shipped fixes | 7 GAP, 4 PARTIAL, 2 COVERED |
| D — control→export fidelity | 19 export gaps (13 fixable-mapping, 6 inherent format limits) |

After dedupe (opacity counted once): **~30 distinct actionable defects + 1 systemic UX gap + 7 missing E2E specs.**

---

## P0 — Broken / silently misleading / data-loss risk

| ID | Defect | Evidence | Source |
|----|--------|----------|--------|
| P0-OPACITY | Opacity control no-op on 18/19 types (canvas + reveal + pptx). Only `shape` applies it. User sets 50% → nothing happens anywhere. | wrapper `:96-114` no opacity key; `shared/src/element-renderers.js:116` `buildBaseStyle` no opacity | A+D (D correct) |
| P0-INDET | Multi-select shows primary element's value in every control, no indeterminate/blank state anywhere (0 implementations). Editing a mixed-value selection silently overwrites. | `PropertiesPanel.jsx:115` passes primary `selectedElement`; no read-side mixing | A |
| P0-LINEFILL | Ribbon Fill picker shown for `line`, writes `fill`, `LineArrowRenderer` ignores it → visible control does nothing | `ribbon-format-tab…:188-190` routes line→ShapeControls (always renders Fill); `line-element-renderer.jsx:60-119` | A |
| P0-CODE-RADIUS | `code` borderRadius control writes prop, outer div applies it, but inner `<pre>` hardcodes `borderRadius:0` → no visible effect | `code-properties.jsx:84` vs `canvas-element-wrapper.jsx:137` | A |
| P0-VIDEO-SRC | Ribbon "Source" writes `src`; panel also exposes `videoUrl`; renderer reads `videoUrl\|\|src` → ribbon edit ignored when videoUrl set | `ribbon-format-tab…:158` vs `canvas-element-wrapper.jsx:204` | A |
| P0-MD-HARDCODE | `markdown` fontSize + textColor hardcoded in renderer; no controls, writes ignored | `markdown-element-renderer.jsx:12-13` | A |
| P0-AUTOSAVE-E2E | Autosave flush-on-leave (data-loss fix) has ZERO browser test; `beforeunload`+keepalive physically untestable in jsdom | no spec in `tests/e2e/**` | B |
| P0-FLIP | image `flipH/flipV` dropped on canvas + reveal (PPTX honors it) → flipped image shows un-flipped in editor + HTML export | `canvas-element-wrapper.jsx:170`, `shared/src/element-renderers.js:178,181` | D |

## P1 — Incomplete (renderer supports prop, control missing) + export mapping gaps

| ID | Defect | Evidence | Source |
|----|--------|----------|--------|
| P1-SAT | image saturation: renderer applies `saturate()` but no slider | `canvas-element-wrapper.jsx:167` | A |
| P1-CHART-AREA | chart `areaFill` (line) read, no control | `chart-element-renderer.jsx:5` | A |
| P1-CHART-STACK | chart `stacked` read, no control | `chart-element-renderer.jsx:6` | A |
| P1-TBL-HDRTXT | table `headerTextColor` applied, no control | `table-element-renderer.jsx:40` | A |
| P1-TBL-BORDER | table `borderStyle` applied, no control (no dashed/dotted) | `table-element-renderer.jsx:15` | A |
| P1-SVG-EDIT | svg `content` read, no editor to change markup after creation | `svg-element-renderer.jsx:3` | A |
| P1-TL-CONN | timeline per-event `connectorOffset` read, no control | `timeline-element.jsx:66` | A |
| P1-IMG-BORDER | image border (color/width) dropped in reveal HTML (PPTX has it) | `shared/src/element-renderers.js:156-182` | D |
| P1-CHART-ROT | chart rotation dropped in PPTX | `export-pptx-basic-renderers.js:305-312` | D |
| P1-TBL-MERGE | table mergedCells dropped in reveal HTML (no colspan/rowspan) | `shared/src/element-renderers.js:374-432` | D |

## P1 — E2E specs to write (browser-only behavior, unprotected)

1. `autosave-flush-on-leave.spec.js` (new) — covers autosave flush + A→B nav drain. Design note: assert via navigate-away + poll API for landed edit, NOT by intercepting the keepalive request (unreliable in Playwright).
2. `canvas/apply-to-selection.spec.js` (new) — multi-select fan-out: X/Y delta, W/H absolute, type-gating, rotation-wrap.
3. `canvas/marquee-and-zorder.spec.js` (new) — marquee excl hidden/locked, z-order swap, synchronous drag-selection (real pointer coords).
4. `undo-redo.spec.js` (extend) — undo-disabled-on-fresh-load (aria-state) + TipTap undo reconcile (real Selection API).
5. `canvas/clipboard.spec.js` (extend) — groupId remap on paste, Ctrl+D no-clobber.

## P2 — Polish / inherent limits (document, don't necessarily fix)

- shape borderRadius gate is shape-string-dependent (`shape-properties.jsx:121`) — fragile to new variants.
- drawing stroke controls only affect default for new paths; no "apply to all" affordance.
- game `fontFamily` in defaults but renderer ignores it — schema noise.
- D inherent limits (6): pptxgenjs has no box-shadow, no image corner-radius, no CSS filters→pptx, no table rotation; game/html-iframe are live-only — these are format ceilings, document as "expected loss" not bugs.

---

## Suggested fix phasing (if/when we move to /ck:plan)

- **Phase 1 — Global one-line wins (highest impact/effort):** P0-OPACITY (wrapper + buildBaseStyle), P0-CODE-RADIUS, P0-FLIP, P1-CHART-ROT. Mostly single-line prop additions hitting many types.
- **Phase 2 — Dead/wrong controls:** P0-LINEFILL, P0-VIDEO-SRC, P0-MD-HARDCODE.
- **Phase 3 — Indeterminate state (systemic):** P0-INDET — needs read-side mixing plumbed through PropertiesPanel; biggest single design change.
- **Phase 4 — Missing controls:** all P1-* control gaps (saturation, chart area/stacked, table header/border, svg editor, timeline connector).
- **Phase 5 — Export fidelity:** P1-IMG-BORDER, P1-TBL-MERGE (reveal renderer additions).
- **Phase 6 — E2E safety net:** the 5 specs, autosave-flush first.

---

## Resolved decisions (2026-06-09, locked by user)

1. **videoUrl vs src → UNIFY to single `src`.** Drop the `videoUrl` field; `src` carries both upload path and external URL. Back-compat: renderer keeps reading `videoUrl || src` so old data survives; migrate `videoUrl→src` on load. Ribbon writing `src` then becomes correct. (Verified: `media-properties.jsx:17-34` has two overlapping URL fields; renderer `canvas-element-wrapper.jsx:204` reads `videoUrl||src`.) → reshapes **P0-VIDEO-SRC**.
2. **markdown fontSize/textColor → genuine gap, wire it.** Renderer reads `element.textColor`/`element.fontSize`; add controls in MiscProperties (markdown branch). Consistent with text/callout/table. → confirms **P0-MD-HARDCODE**.
3. **timeline connectorOffset → missing, add control but LOW priority.** Per-event numeric input; niche, lands last in P1. → confirms **P1-TL-CONN** (deprioritized).
4. **Indeterminate scope → build plumbing once, apply high-impact controls first.** Plumb mixed-value read-state through PropertiesPanel, then apply to opacity, X/Y, W/H, rotation, colors (fill/stroke/textColor). Remaining controls fast-follow. NOT every control at once (YAGNI). → reshapes **P0-INDET** into a plumbing phase + incremental application.
5. **Export inherent limits (6) → accept + document, no workarounds.** Add a "Known export limitations" docs section (pptx: no box-shadow, no image corner-radius, no CSS filters, no table rotation; game/html-iframe live-only). Only the **13 fixable mapping gaps** are in fix scope.
