---
phase: 4
title: "Locked/Hidden Guards & Z-Order"
status: pending
priority: P2
effort: "0.5d"
dependencies: []
---

# Phase 4: Locked/Hidden Guards & Z-Order

## Overview
Make `locked`/`hidden` semantics consistent across operations (rubber-band,
align), and fix the naive z-order stepping so "bring forward / send backward"
crosses exactly one neighbor and works on multi-select.

## Bugs Addressed
- **M1 (Medium-High)** — rubber-band marquee selects `hidden` AND `locked` elements (AABB-only, no guard). `use-canvas-rubber-band-drag-selection.js:41-50`. (Confirmed: repro `[bug:M1]` ×2.)
- **M4 (Medium)** — align/distribute moves locked elements (delete/duplicate honor `locked`, align doesn't). `use-slide-operations.js:140-215`. (Confirmed: repro `[bug:M4]`.)
- **M6 (Medium)** — `bringElementForward`/`sendElementBackward` use naive `zIndex ±1` → gaps not crossed, ties created. `EditorPage.jsx:727-743`.
- **L3 (Low)** — Z-order keyboard shortcuts no-op on multi-select. `EditorPage.jsx:1096-1101`.

## Requirements
- Functional: marquee never selects `hidden` (invisible) elements; locked elements excluded from marquee selection AND from align/distribute moves (consistent with delete/duplicate). Bring-forward moves an element above exactly the next-higher neighbor; send-backward below the next-lower; ties resolved. Z-order shortcuts act on each selected element.
- Non-functional: preserve relative order within a multi-select z-op.

## Architecture

**RED-TEAM NOTE — `alignElements` is co-edited with Phase 5.** This phase (M4)
adds the locked-filter to `els` at `use-slide-operations.js:147`; Phase 5 (M5)
rewrites the bbox min/max math at `:149-206`. Apply **Phase 4 first**; Phase 5
must build its rotated-bbox math on the **post-M4 (locked-filtered) `els` set**.
Do NOT run 4 and 5 in parallel branches on this function.

- M1: add `!el.hidden && !el.locked` to the `endRubberBand` filter. (Confirm whether locked should be marquee-selectable for some workflows — audit says exclude for consistency; ASK if unsure since locked-but-visible selection can be legitimate for inspecting. Default: exclude both per audit.)
- M4: filter `locked` out of the `els` set in `alignElements` (`:147`), matching `deleteSelectedElements:75-80`. **Caveat:** the `ids.length < 2` guard (`:143`) runs on RAW ids BEFORE the locked-filter — so 1-free+1-locked passes the guard then aligns a single survivor. Decide: re-check count AFTER filtering (a lone free element → no-op).
- M6: replace `zIndex+1` with a neighbor-swap: find the nearest element with a strictly greater (forward) / lesser (backward) zIndex and swap, or renormalize zIndex to a dense sequence first then swap. KISS: renormalize-then-swap is simplest and kills ties. **Extract `computeZOrderStep(elements, id, dir)` as a pure fn AND verify the EditorPage callbacks (`727-743`) + shortcut handlers (`1096-1101`) are rewired to call it — a green helper test does not prove the inline `zIndex+1` at :730 is gone.**
- L3: extend z-order handlers to map over all `selectedElementIds`, preserving their relative order.

## Related Code Files
- Modify: `client/src/components/canvas/use-canvas-rubber-band-drag-selection.js` (filter 43-49)
- Modify: `client/src/hooks/use-slide-operations.js` (`alignElements` 147)
- Modify: `client/src/pages/EditorPage.jsx` (`bringElementForward`/`sendElementBackward` 727-743; shortcut handlers 1096-1101)
- Modify: `client/src/editor-interaction-bug-repro.test.js` (convert M1×2 + M4 tripwires)
- Create: `client/src/pages/editor-z-order.test.js` (M6, L3 — extract z-order logic to a pure helper if needed for testability)

## Implementation Steps (TDD)
1. **Repro (M1):** convert `[bug:M1]` ×2 to assert hidden/locked NOT in marquee hits AND **add positive: `vis` IS in hits** (else a fix returning `[]` for everything passes).
2. Fix filter; run → green.
3. **Repro (M4):** convert `[bug:M4]` to assert locked element stays put AND **add positive: free `b` DID align to 100** (else a no-op early-return passes). Add edge case: 1-free + 1-locked selected → free element no-op (count re-checked after filter).
4. Fix `alignElements` locked-filter (+ post-filter count guard); run → green.
5. **Test first (M6) — concrete numbers:** A.zIndex=1, B.zIndex=5; bring A forward → assert `result.A > result.B` (strictly above), and no third element's relative order changed. Also: already-topmost forward → no unbounded zIndex inflation; send-backward floors at 1. Extract pure `computeZOrderStep(elements, id, dir)`.
6. Implement neighbor-swap/renormalize. **Verify call site:** assert `bringElementForward`/`sendElementBackward` (`727-743`) invoke `computeZOrderStep` (not the old inline `+1`). Run → green.
7. **Test first (L3):** 2 selected, bring forward → both move AND their relative order preserved.
8. Fix shortcut handlers (`1096-1101`) to map over all selected; run → green.
9. `npm run test` + `npm run lint`.

## Success Criteria
- [ ] M1×2: marquee excludes hidden + locked AND includes visible (`vis`)
- [ ] M4: align leaves locked in place AND free element DID align; 1-free+1-locked → no-op
- [ ] M6: forward gives `A.zIndex > B.zIndex` (concrete), no ties, no unbounded inflation, back floors at 1; call site rewired to `computeZOrderStep`
- [ ] L3: z-order shortcuts act on all selected, relative order preserved
- [ ] tripwires converted with positive assertions; lint clean

## Risk Assessment
- **Risk:** excluding locked from marquee may annoy users who want to multi-select-then-unlock. **Mitigation:** matches audit recommendation + delete/duplicate precedent; flag to user, easily reverted to hidden-only guard.
- **Risk:** zIndex renormalization could reorder ties unexpectedly. **Mitigation:** stable sort by (zIndex, array-index) before renormalizing — preserves current visual order (matches `SlideCanvas.jsx:501`).
