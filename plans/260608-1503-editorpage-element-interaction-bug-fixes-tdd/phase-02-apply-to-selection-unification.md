---
phase: 2
title: "Apply-to-Selection Unification"
status: pending
priority: P1
effort: "1d"
dependencies: [1]
---

# Phase 2: Apply-to-Selection Unification

## Overview
Make property/geometry edits apply to ALL selected elements (not just the last)
and unify clamping/normalization so the PropertiesPanel and the Format ribbon
behave identically. Single root cause behind H1/M7/M8.

## Bugs Addressed
- **H1 (High)** — multi-select edits apply to only the last-selected element. `EditorPage.jsx:209, 864, 1295, 1417-1423`. All style/geometry controls route through single-id `updateElement(selectedElementId,...)`.
- **M7 (Medium)** — Format-ribbon X/Y silently reject negatives (`min ?? 0`); panel accepts them → two UIs diverge. `ribbon-format-tab-element-position-size-rotation-controls.jsx:219-245`.
- **M8 (Medium)** — rotation normalization differs: panel `((v%360)+360)%360`, ribbon stores raw. `common-element-controls.jsx:56` vs ribbon `:277`.

## Requirements
- Functional: editing fill/opacity/border-radius/font-size/X/Y/W/H/rotation with N elements selected mutates ALL N. Negative X/Y allowed in BOTH UIs (off-canvas bleed is valid). Rotation normalized to 0–359 in BOTH UIs. Mixed-value selections should not silently overwrite invisibly — at minimum, all selected receive the new value (indeterminate display is a stretch goal, not required).
- Non-functional: one shared apply path (DRY); no per-keystroke history spam beyond what already exists (do not regress; M10 handled in phase 5/6 if scoped — here just don't make it worse).

## Architecture
Add `updateSelectedElements(updates)` to EditorPage that fans the partial
`updates` over every id in `selectedElementIds`, reusing the existing
`updateElements` (batch) path from `use-slide-operations.js:51-68` (already
deep-clone-safe and pptx-meta-aware). Rewire PropertiesPanel sub-panels and the
Format ribbon controls to call it instead of `updateElement(selectedElementId)`.

Shared clamp/normalize: extract a tiny `normalizeElementGeometryUpdate(updates)`
(or reuse `utils/number-input.js`) so both UIs apply the SAME rules — negatives
allowed for x/y, rotation `((v%360)+360)%360`, w/h ≥ MIN_SIZE.

Geometry caveat — **RESOLVED by user decision + red-team**: a plain click on a
grouped element auto-selects the WHOLE group (`getSelectionIdsForActiveSlideElement`,
`EditorPage.jsx:80-85`), so "absolute to all" would collapse a group to one point
on a single X edit. **Decision: X/Y numeric entry applies as a DELTA** (new value
− primary element's old value, added to every selected element → relative layout
preserved); **W/H numeric entry applies ABSOLUTE** (PowerPoint "make same size").
Opacity/rotation/style apply to all. Document this split in the tests.

**Mixed-type selections (red-team M-b):** fanning `fontSize`/`fill` onto a
text+shape+chart selection writes irrelevant props and triggers
`invalidatePptxFitMetaForUpdates` (`use-slide-operations.js:62`) on elements that
never had text. **Rule:** geometry (x/y/w/h/rotation/opacity) broadcasts to all
selected; type-specific style props (fontSize, fontFamily, fill) apply ONLY to
elements that own that prop. Gate per-property by element type.

## Related Code Files
- Modify: `client/src/pages/EditorPage.jsx` (add `updateSelectedElements`; rewire panel wiring 1417-1423 and ribbon 1295)
- Modify: `client/src/components/ribbon/ribbon-format-tab-element-position-size-rotation-controls.jsx` (remove `min ?? 0` for x/y; normalize rotation)
- Modify: `client/src/components/properties/common-element-controls.jsx` (share normalize)
- Create: `client/src/components/properties/apply-to-selection.test.jsx`

## Implementation Steps (TDD)
1. **Test first (H1) — unit:** drive `updateSelectedElements` with 3 ids + an injected `updateElements` → assert all 3 receive the partial update.
2. **Test first (H1) — CALL SITE (red-team High):** render PropertiesPanel (and the Format ribbon) with 3 elements selected, fire a real fill-change event → assert all 3 mutate. The helper test alone does NOT prove the bug dead; the panel/ribbon must actually route through `updateSelectedElements` instead of `updateElement(selectedElementId)`.
3. Implement `updateSelectedElements`; rewire panel (`EditorPage.jsx:1417-1423`) + ribbon (`:1295`). Grep ALL `onUpdateElement`/`updateElement(selectedElementId` call sites; convert exhaustively.
4. **Test first (geometry split):** with 3 selected, set X=100 → assert all shift by the SAME delta (relative offsets preserved), NOT all stacked at 100. Set W=200 → assert all widths become 200 but x/y unchanged. Cover the group-auto-select case (click 1 grouped element → group selected → X delta preserves layout).
5. Implement the X/Y-delta / W/H-absolute split.
6. **Test first (mixed-type):** select text+shape, set fontSize → assert only the text element changes; set opacity → assert both change. Assert no pptx-fit-meta pollution on the shape.
7. Gate per-property by element type.
8. **Test first (M7):** ribbon X accepts -40 and writes it; panel and ribbon agree.
9. Fix ribbon `updateNum` to allow negatives for x/y (`min: -Infinity`/null).
10. **Test first (M8):** typing 450 → stores 90 (both UIs); typing -30 → stores 330 (negative wrap, not reject).
11. Extract/share rotation normalization `((v%360)+360)%360`; apply in ribbon.
12. `npm run test` + `npm run lint`.

## Success Criteria
- [ ] H1 unit: 3-selected style edit fans to all 3
- [ ] H1 CALL SITE: rendered panel/ribbon with 3 selected mutates all 3 (not just helper)
- [ ] Geometry split: X/Y = delta (layout preserved), W/H = absolute; group-auto-select case covered
- [ ] Mixed-type: fontSize only to text; opacity to all; no pptx-meta pollution
- [ ] M7: negative X/Y accepted, panel == ribbon
- [ ] M8: rotation 450 → 90 AND -30 → 330 in both UIs
- [ ] No regression in single-select edits
- [ ] lint clean

## Risk Assessment
- **Risk (red-team H-b):** group auto-select makes "absolute to all" collapse groups. **Mitigation:** RESOLVED — X/Y delta, W/H absolute (user decision). Test the group-click path explicitly.
- **Risk (red-team M-b):** mixed-type fan pollutes pptx-fit meta / writes dead props. **Mitigation:** per-property type gating + mixed-selection test.
- **Risk:** rewiring every control is broad. **Mitigation:** single chokepoint (`updateSelectedElements`); grep + convert exhaustively; the call-site render test catches any missed wiring.
- **Risk:** helper-only test gives false confidence (red-team High). **Mitigation:** mandatory call-site render test (step 2).
