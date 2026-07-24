---
phase: 5
title: "Rotation-Aware Geometry & Crop"
status: pending
priority: P2
effort: "1.5d"
dependencies: []
---

# Phase 5: Rotation-Aware Geometry & Crop

## Overview
Make resize, marquee intersection, and align/distribute correct for ROTATED
elements, floor crop dimensions to prevent inversion, and guard aspect-ratio
resize against zero-dimension elements. This is the most math-heavy phase.

## Bugs Addressed
- **H3 (High)** — resize math ignores rotation; rotated element resizes along unrotated axes and jumps. `use-canvas-pointer-interaction.js:225-233`, `use-canvas-resize-rotate.js:27-72` (`startEl` drops `rotation`). (Confirmed: repro `[bug:H3]`.)
- **M2 (Medium)** — rubber-band intersection uses unrotated AABB → rotated elements mis-hit. `use-canvas-rubber-band-drag-selection.js:43-48`.
- **M5 (Medium)** — align/distribute uses unrotated AABB for rotated elements. `use-slide-operations.js:149-206`.
- **M3 (Medium)** — crop handles NW/N/NE/SW/W produce negative w/h past the opposite edge → crop inverts. `use-canvas-pointer-interaction.js:14-46` (`applyCropHandle`).
- **S3 (Suspected→confirm)** — aspect-ratio resize → NaN if element height=0. `use-canvas-resize-rotate.js:81-93`.

## Requirements
- Functional: dragging a resize handle on a rotated element grows toward the cursor along the element's rotated axes, anchoring the opposite edge/corner; center does not drift unexpectedly. Marquee and align use the element's true (rotated) bounding box. Crop never inverts (floor at MIN_CROP). Aspect-ratio resize never yields NaN/Infinity.
- Non-functional: keep helpers pure + unit-testable; rotation math centralized (one rotate-point helper, DRY).

## Architecture
- H3: thread `rotation` into `startEl`. In `applyResize`, transform the pointer delta `(dx,dy)` into the element's local (unrotated) frame via inverse rotation, compute the new box in local space, then map the anchor back. Add a `rotatePoint(px,py,cx,cy,deg)` helper. The opposite corner/edge stays fixed in WORLD space — compute world anchor, resize in local frame, recompute x/y so the anchor is preserved.
- M2/M5: add a `getRotatedAABB(el)` helper (4 corners rotated about center → min/max). Use it in marquee intersection and align min/max math. Distribute uses the rotated bbox width/height.
- M3: add `MIN_CROP` floor to the subtractive handles (nw, n, ne, sw, w) symmetric to the safe se/e/s handles; clamp so w/h ≥ MIN_CROP and never invert.
- S3: first CONFIRM whether any element can persist height=0 (check `element-factory.js`, pptx-import geometry). If reachable, guard `ratio` (skip aspect lock when height/width is 0). If not reachable, document as non-issue and skip.

**RED-TEAM CORRECTIONS:**

- **`clampToSlide` (High) — the headline invariant leaks.** Pipeline is
  `applyResize` → aspect → **`clampToSlide`** → `onUpdateElement`
  (`use-canvas-pointer-interaction.js:226-229`). `clampToSlide`
  (`use-canvas-resize-rotate.js:120-131`) clamps the AXIS-ALIGNED box to slide
  bounds. For a rotated element this shifts x/y and shrinks w/h near edges,
  UNDOING the world-anchor the H3 math just established → still jumps at edges.
  **`clampToSlide` must become rotation-aware** (clamp the rotated AABB, or skip
  the clamp when `rotation !== 0` and clamp the visual bbox instead). Do NOT ship
  H3 without addressing this.
- **CALL SITE (High) — rotation must reach `startEl`.** `startElementDrag` builds
  `startEl` at `use-canvas-pointer-interaction.js:288` as `{x,y,width,height,snapRef}`
  — NO rotation. Threading rotation into `applyResize` is useless unless `startEl`
  carries it. **Add a test asserting `startEl.rotation` is populated** from the
  element, else the helper test is green while the app stays broken.
- **H3 assertion must be EXACT, not `not.toEqual` (High).** "rotated differs from
  flat" is necessary, not sufficient — any wrong-axis/wrong-anchor math passes it.
  Assert: world-space opposite-edge midpoint INVARIANT (within epsilon) AND
  `newWidth === startWidth + (dx·cosθ + dy·sinθ)` for the E handle AND center
  moved by exactly half that delta along the rotated axis. Compute expected values
  from the rotate-point math.
- **FP-drift at 0° is a NON-issue (don't over-correct):** `cos(0)===1`, `sin(0)===0`
  exactly in IEEE-754; `rotatePoint(...,0)` returns input bit-for-bit. The unrotated
  smoke/deep tests pass unchanged PROVIDED the unrotated path multiplies by exact-0
  trig (don't introduce a different formula). Lock those tests as a regression floor.
- **Center-anchor is correct** (`canvas-element-wrapper.jsx:110` rotate with no
  transform-origin → CSS default 50% 50%). Keep YAGNI center assumption.
- **S3 trigger is width=0 AND height=0** (`0/0`=NaN), not height alone (lone
  height=0 → ratio=Infinity → `round(0)`=0 → `max(MIN_SIZE,0)`=40, finite). Check
  `element-factory.js`/pptx-import for the BOTH-zero combination specifically.
- **Distribute consistency:** if marquee/align switch to rotated bbox, distribute's
  width/height SUMS (`use-slide-operations.js:186,199`) must use rotated bbox
  dimensions too, or spacing drifts. Do both or neither.
- **alignElements co-edit:** build M5's rotated-bbox math on the **post-Phase-4
  (locked-filtered) `els` set** — Phase 4 runs first. Don't reintroduce locked
  elements into the bbox extent.
- **S4 overlap:** `startElementDrag` also uses `document.querySelector('.slide-canvas')`
  at `:273` (same first-match hazard as S4) and is the exact function whose
  `startEl` you edit. Coordinate with Phase 7/S4 so the two edits don't clobber.

## Related Code Files
- Modify: `client/src/components/canvas/use-canvas-resize-rotate.js` (`applyResize` 27-72, `applyResizeAspectRatio` 81-93; add `rotatePoint`/`getRotatedAABB`)
- Modify: `client/src/components/canvas/use-canvas-pointer-interaction.js` (`startEl` build ~288 to include rotation; `applyCropHandle` 14-46)
- Modify: `client/src/components/canvas/use-canvas-rubber-band-drag-selection.js` (intersection 43-48 → rotated bbox)
- Modify: `client/src/hooks/use-slide-operations.js` (`alignElements` 149-206 → rotated bbox)
- Modify: `client/src/editor-interaction-bug-repro.test.js` (convert H3 tripwire)
- Create: `client/src/components/canvas/rotated-geometry.test.js`

## Implementation Steps (TDD)
1. **Lock regression floor:** confirm existing `canvas-geometry-ops.smoke.test.js` + `use-canvas-resize-rotate.deep.test.js` pass; they pin the unrotated path (rotation defaults 0 → exact-0 trig → unchanged).
2. **Repro (H3) — EXACT assertion:** convert `[bug:H3]` to: 45°-rotated element, E handle, drag → assert (a) world-space W-edge midpoint invariant (epsilon), (b) `newWidth === startWidth + (dx·cosθ + dy·sinθ)`, (c) center moved half that delta along rotated axis. NOT `not.toEqual`.
3. **Test first (call site):** assert `startElementDrag` output (pending-drag ref) populates `startEl.rotation` from the element.
4. Add `rotatePoint` + rotation-aware `applyResize` (accept `rotation`, default 0 → existing path). Thread `rotation` into `startEl` at `use-canvas-pointer-interaction.js:288`.
5. **Test first (clampToSlide):** rotated element resized near a slide edge → assert world-anchor still preserved (clamp must not undo it).
6. Make `clampToSlide` rotation-aware (clamp rotated AABB, or skip axis-aligned clamp when rotation≠0). Run → H3 + clamp tests green.
7. **Test first (M2):** rotated element whose unrotated AABB is inside marquee but rotated bbox is outside → not selected (and vice versa). Add `getRotatedAABB`; fix marquee.
8. **Test first (M5):** align-left of rotated + unrotated uses rotated left edges; distribute uses rotated bbox dims (spacing consistent). Build on the post-Phase-4 locked-filtered `els`. Fix align + distribute together.
9. **Test first (M3):** drag NW (and N/NE/SW/W) crop handle past opposite edge → assert w,h ≥ MIN_CROP, finite, no inversion (note: `applyCropHandle` computes `w=(x+w)-nx` which goes negative if `nx > x+w` — floor `w` itself, not just `nx`). Fix subtractive handles.
10. **S3:** construct a width=0 AND height=0 element, assert aspect resize → finite; check `element-factory.js`/pptx-import reachability. Guard if reachable; else document non-issue.
11. **Regression:** re-run unrotated smoke/deep tests unchanged.
12. `npm run test` + `npm run lint`.

## Success Criteria
- [ ] H3: EXACT world-anchor + projected-width assertion (not "different"); unrotated path unchanged
- [ ] Call site: `startEl.rotation` populated (helper not orphaned)
- [ ] clampToSlide rotation-aware: rotated resize at slide edge keeps anchor
- [ ] M2: marquee uses rotated bbox
- [ ] M5: align + distribute use rotated bbox consistently; built on locked-filtered set
- [ ] M3: crop never inverts (w,h ≥ MIN_CROP, finite) for all subtractive handles
- [ ] S3: BOTH-zero confirmed + guarded (or documented non-issue)
- [ ] existing smoke/deep geometry tests still green
- [ ] lint clean

## Risk Assessment
- **Risk:** rotation-aware resize is the trickiest math; easy to break the common unrotated case. **Mitigation:** rotation defaults to 0 → identical to current code path; lock the unrotated smoke tests as a regression floor BEFORE changing.
- **Risk:** rotated-bbox align changes long-standing behavior users may rely on. **Mitigation:** only affects rotated elements (unrotated bbox == element box); document.
- **Risk:** scope creep — full transform-origin handling. **Mitigation:** YAGNI — assume center origin (matches `canvas-element-wrapper.jsx` default); do not generalize origins unless a test proves it needed.
