---
phase: 3
title: "Indeterminate Multi-Select State"
status: completed
priority: P0
effort: "1d"
dependencies: [1, 2]
---

# Phase 3: Indeterminate Multi-Select State

## Overview
When multiple elements with DIFFERENT values for a property are selected, every
control currently shows the primary element's value with no indication others
differ — silently masking divergence. Build the read-side mixing pattern ONCE,
then apply to high-impact controls. Implements locked decision 4.

## Defects Addressed
- **P0-INDET** — 0 controls implement indeterminate state. `PropertiesPanel.jsx:115`
  passes only `selectedElement` (primary) to controls; no merged read-state.
  Write-side fan-out (`element-update-fanout.js`) is correct; the READ side is the gap.

## Requirements
- Functional: with ≥2 elements selected that differ on a property, that property's
  control shows an indeterminate cue (blank value + placeholder "—", or
  mixed-state styling) instead of the primary's concrete value. Editing the
  control still applies to all (existing fan-out unchanged). When all selected
  share the same value, show that value normally.
- Non-functional: build the mixing logic ONCE (DRY); single-select behavior
  unchanged; no perf regression (compute mix only when `selectedElementIds.length > 1`).
- Scope (decision 4): apply to high-impact controls FIRST — opacity, X/Y, W/H,
  rotation, colors (fill/stroke/textColor). Remaining controls fast-follow (noted,
  not required this phase).

## Architecture
- Add a pure helper `computeMixedValues(elements, ids, keys)` →
  `{ [key]: { value, isMixed } }`. KISS sentinel via the `isMixed` flag.
- Thread `selectedElementIds` + slide elements into the controls. Each control
  reads `isMixed` for its prop and renders blank/"—"/placeholder when true.
- **Opacity lives in the ribbon + shape-properties, NOT common-element-controls
  (red-team M4 — verified `grep -c opacity common-element-controls.jsx` = 0).**
  `common-element-controls.jsx` owns X/Y/W/H/rotation/lock/fragment/shadow/layer/
  delete — so geometry indeterminate wiring goes there. Opacity indeterminate
  wiring targets `ribbon-format-tab…:~298-311` and `shape-properties.jsx:~104-116`
  (shape/line only). Colors (fill/stroke/textColor) live in shape-properties.
- **Non-shape types have NO panel opacity control at all** — only the ribbon
  exposes opacity. After Phase 1 makes opacity RENDER for all types, a generic
  panel opacity slider for non-shape types is still missing. That generic control
  is OUT OF SCOPE here (Phase 3 = indeterminate read-state for EXISTING controls);
  it is added in Phase 4 (missing controls) and adopts this pattern then.
- For X/Y: edits apply as a DELTA; displayed value is the primary's position. When
  mixed, show blank (delta still works on edit). Document in tests.
- DO NOT touch the write path — `updateSelectedElements`/`element-update-fanout.js`
  stays as-is. Read-side only.

## Related Code Files
- Create: `client/src/utils/selection-mixed-values.js` (pure `computeMixedValues`)
- Create: `client/src/utils/selection-mixed-values.test.js`
- Modify: `client/src/components/PropertiesPanel.jsx` (pass ids + elements into controls ~115)
- Modify: `client/src/components/properties/common-element-controls.jsx` (X/Y/W/H/rotation indeterminate — NO opacity here)
- Modify: `client/src/components/properties/shape-properties.jsx` (opacity + fill/stroke/textColor indeterminate, shape/line)
- Modify: `client/src/components/ribbon/ribbon-format-tab-element-position-size-rotation-controls.jsx` (opacity indeterminate in ribbon ~298-311)

## Implementation Steps (TDD)
1. **Test first (helper):** `computeMixedValues([{opacity:1},{opacity:0.5}], ids, ['opacity'])`
   → `opacity.isMixed === true`; same values → `isMixed false` + the value.
2. Implement `computeMixedValues`; green.
3. **Test first (CALL SITE — opacity, ribbon + shape-properties):** render the
   RIBBON opacity control with 2 elements of differing opacity → shows blank/"—",
   not primary's value. Render shape-properties opacity with 2 shapes differing →
   blank. Single element → its value. Editing → fans to all (write path intact).
   (NOT common-element-controls — it has no opacity, per M4.)
4. Thread ids+elements through PropertiesPanel; wire opacity indeterminate into
   ribbon + shape-properties. Green.
5. **Test first (X/Y/W/H/rotation in common-element-controls):** mixed
   positions/sizes/rotation → blank; identical → value. Editing X still applies
   delta to all.
6. Wire geometry controls in `common-element-controls.jsx`. Green.
7. **Test first (colors):** mixed fill/stroke/textColor (shape-properties) →
   indeterminate swatch; identical → the color.
8. Wire color controls. Green.
9. **Regression:** single-select shows concrete values everywhere (no false MIXED).
10. `npm run test` + `npm run lint`. Note: non-high-impact controls + the missing
    generic non-shape panel opacity slider are fast-follow / Phase 4 (out of scope
    here); they keep current behavior (not a regression).

## Success Criteria
- [ ] `computeMixedValues` pure + tested
- [ ] Opacity (ribbon + shape-properties), X/Y/W/H/rotation (common-element-controls), fill/stroke/textColor (shape-properties) show indeterminate when selection differs
- [ ] Editing a mixed control still fans to all selected (write path unchanged)
- [ ] Single-select unchanged (no false indeterminate)
- [ ] Pattern documented so Phase 4 controls adopt it; lint clean

## Risk Assessment
- **Risk:** scope creep to every control. **Mitigation:** decision 4 — high-impact
  set only this phase; rest fast-follow, explicitly out of scope.
- **Risk:** X/Y delta semantics vs blank display confusing. **Mitigation:** test
  that blank display + delta edit coexist; document.
- **Risk:** false MIXED on single-select. **Mitigation:** guard `ids.length > 1`; regression test.
- **Risk:** threading new props breaks existing PropertiesPanel tests.
  **Mitigation:** additive props with safe defaults; run PropertiesPanel suite.
