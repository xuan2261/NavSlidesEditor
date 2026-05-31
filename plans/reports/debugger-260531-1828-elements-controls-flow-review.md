# Elements Controls Flow Review - Investigation Report

## Executive Summary
- **Issue:** Review/debug editor element controls, logic, flow.
- **Impact:** Core canvas generally builds/tests pass; several edge flows can silently fail.
- **Root cause:** Some handlers bypass active-slide abstraction or call update APIs with wrong shape.
- **Status:** Fixed with TDD regression coverage.
- **Fix:** Plugin callback contract, flat paste selection, active child lookups, and table data resizing patched.

## Technical Analysis

## Recheck 260531-1832
- **Scope:** Re-verify all 5 findings from first pass.
- **Result:** 5/5 confirmed. No false positives found.
- **Method:** Code-path reread, focused Vitest, direct Zustand runtime check, build/lint.

### Findings
1. **P1 - Plugin element state updates do not persist — CONFIRMED**
   - Evidence: `CanvasElement` calls `onUpdateElement?.({ pluginData: ... })` without element id.
   - Parent `EditorPage.updateElement` signature is `(id, updates)`.
   - Recheck: `rg` found no adapter that converts plugin patch object into `(id, updates)`.
   - Existing tests only verify plugin sandbox patch forwarding/rendering, not persistence through `CanvasElement`.
   - Impact: plugin iframe `navslides.updateData()` sends patch, host receives it, but active element is never updated.
   - File: `client/src/components/canvas/canvas-element-wrapper.jsx:192`

2. **P1 - Paste selection shape becomes nested array — CONFIRMED**
   - Evidence: `performPaste` calls `selectElement(allIds)`.
   - Store `selectElement` wraps input as `[id]`, so multi-paste writes `selectedElementIds: [[...ids]]`.
   - Runtime check: `selectElement(['id-a','id-b'])` returns `[["id-a","id-b"]]`.
   - Note: single paste also becomes `[["id-a"]]`; this still fails `selectedElementIds.includes(element.id)`.
   - Impact: pasted elements may not show selected, Format tab/contextual operations break until user reselects.
   - Files: `client/src/hooks/use-clipboard.js:150`, `client/src/stores/editor-store.js:10`

3. **P1 - Vertical child slide text edit lookup uses parent slide — CONFIRMED**
   - Evidence: `startEditingElement` reads `presentation?.slides[currentSlideIndexRef.current]?.elements`.
   - Active child support exists through `activeSlide`/`mapActive`, but this path bypasses it.
   - Recheck: `active-slide-mapper.test.js` confirms active child is the intended abstraction; this callback does not use it.
   - Impact: double-click text editing on vertical child slides can no-op.
   - File: `client/src/pages/EditorPage.jsx:660`

4. **P2 - Group auto-selection bypasses active child slide — CONFIRMED**
   - Evidence: `toggleElementSelection` uses parent slide for group lookup.
   - Recheck: same file already uses `activeSlide`/`activeSlideRef.current` for neighboring operations, but not this group lookup.
   - Impact: clicking a grouped element inside a vertical child slide selects only clicked id, not the full group.
   - File: `client/src/pages/EditorPage.jsx:1071`

5. **P2 - Format tab table row/column controls write unused fields — CONFIRMED**
   - Evidence: Format tab writes `rows`/`cols`; `TableRenderer` renders from `element.data`.
   - PropertiesPanel already mutates `data` through `normalizeTableShape`.
   - Recheck: search found table export/render/properties all consume `data`; no table renderer path consumes `element.rows` or `element.cols`.
   - Impact: R/C controls appear editable but do not change actual table grid.
   - Files: `client/src/components/ribbon/ribbon-format-tab-element-position-size-rotation-controls.jsx:100`, `client/src/components/canvas/element-renderers/table-element-renderer.jsx:34`

## Verification
- `npm run build` passed.
- `npm run lint` passed with 0 errors, 23 warnings.
- Targeted Vitest passed: `use-clipboard`, plugin wrapper render test, editor element ops, canvas pointer/resize tests, PropertiesPanel, Format tab controls.
- Recheck Vitest passed:
  - `client/src/plugins/plugin-sandbox.test.jsx`
  - `client/src/components/canvas/canvas-element-wrapper-plugin.test.jsx`
  - `client/src/hooks/use-clipboard.test.js`
  - `client/src/components/properties/table-properties-utils.test.js`
  - `client/src/utils/active-slide-mapper.test.js`
  - `client/src/pages/__tests__/editor-page-element-ops.characterization.test.jsx`
- Direct runtime check passed: Zustand `selectElement(array)` creates nested selection array, confirming paste bug.

## Fix 260531-1847
- **Changed:** `CanvasElement` plugin patches now call `onUpdateElement(element.id, updates)`.
- **Changed:** Clipboard paste now calls `setSelectedElementIds(allIds)` instead of scalar-only `selectElement`.
- **Changed:** Editor text-edit and grouped selection lookup now route through active-slide helpers.
- **Changed:** Format tab table R/C controls resize `element.data` via `normalizeTableShape`; no inert `rows`/`cols` updates.

### TDD Evidence
- Red baseline: 5 new regression tests failed before implementation:
  - Plugin update contract missing `element.id`.
  - Paste selected ids nested as `[["uuid-0","uuid-1"]]`.
  - Active child text-edit helper missing.
  - Active child grouped-selection helper missing.
  - Format table R/C controls did not update `data`.
- Green after fix:
  - `npx vitest run client/src/components/canvas/canvas-element-wrapper-plugin.test.jsx client/src/hooks/use-clipboard.test.js client/src/pages/__tests__/editor-page-element-ops.characterization.test.jsx client/src/components/ribbon/ribbon-format-tab-element-position-size-rotation-controls.test.jsx --reporter=verbose` — 44 passed.
  - `npx vitest run client/src/utils/active-slide-mapper.test.js client/src/components/properties/table-properties-utils.test.js client/src/plugins/plugin-sandbox.test.jsx client/src/components/canvas/canvas-element-wrapper.test.jsx client/src/components/ribbon/format-tab-dynamic-visibility-and-label.test.jsx --reporter=verbose` — 32 passed.
  - `npm run lint` — 0 errors, 23 existing warnings.
  - `npm run build` — passed.
  - `npm run test` — timed out after 305s; no completion result claimed.

## Recommendations

### Immediate (P0)
- None found.

### Short-term (P1)
- [x] Change plugin sandbox callback to `onUpdateElement?.(element.id, { pluginData: ... })`; add a test that simulates `onDataUpdate`.
- [x] Change paste selection to `setSelectedElementIds(allIds)` or update `selectElement` to accept only scalar; add hook-level paste integration test.
- [x] Change text edit and group lookup to use `activeSlideRef.current` or injected `getActiveSlide`.

### Long-term (P2)
- [x] Unify table grid controls with `normalizeTableShape` and remove unused `rows/cols` writes.
- [ ] Add browser-level vertical-child coverage for double-click edit, group select, paste, duplicate.

## Unresolved Questions
- None.
