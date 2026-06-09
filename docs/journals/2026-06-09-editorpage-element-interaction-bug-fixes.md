# EditorPage Element Interaction Bug Fixes — 7-Phase TDD Effort

**Date**: 2026-06-09 00:00
**Severity**: High
**Component**: EditorPage / element interaction surfaces (autosave, multi-select, clipboard, z-order, rotation, keyboard, undo)
**Status**: Resolved

## What Happened

A prior 5-agent debug audit surfaced ~22 element/control interaction defects across EditorPage. A 7-phase TDD plan was executed to fix them, with 7 runtime-confirmed bugs captured upfront as `it.fails` tripwires in `client/src/editor-interaction-bug-repro.test.js`. All tripwires were converted to passing standard assertions. Execution order: 1→3→2→6→4→5→7 (Phase 4 strictly before 5 because both touch `alignElements`).

Two commits landed: `e1f53820 fix(editor): correct element interaction defects across editor surfaces` and `605aa4c9 docs(plans): add editor interaction bug-fix plan (completed)`.

## The Brutal Truth

Twenty-two bugs across seven domains in a single page component is a maintenance debt statement. `EditorPage.jsx` at 77k LOC is the core offender — when clipboard logic, undo state, rotation geometry, and autosave lifecycle all live in the same file, regressions compound silently. The fact that a source-grep contract test nearly broke the certification gate without anyone noticing is the real signal: the test suite had coverage gaps hiding in plain sight, outside the obvious directory scope.

## Technical Details

**P1 — Autosave/history lifecycle**
- Silent data loss on tab-close: `navigator.sendBeacon` is POST-only; save route is PUT. Fixed with `fetch({ keepalive: true })` + sync fallback for oversized payloads (slide backgrounds can inline base64 data-URLs that exceed the 64 KB beacon limit).
- A→B navigation: pending save queue now drains before route change.
- `seededRef` decoupled from dirty-flag: undo is disabled until the first real edit, not first load.
- History capped at exactly 50 entries (was off-by-one).
- Keep-dirty + retry on save failure (was silently clearing dirty flag).

**P2 — Apply-to-selection**
- New `updateSelectedElements` chokepoint fans property edits to all selected elements: X/Y as delta (preserves group layout), W/H absolute, style props type-gated.
- Negative X/Y and rotation-wrap unified across Properties panel and Format ribbon.

**P3 — Clipboard/grouping**
- `groupId` remapped at paste/duplicate: ≥2 members share a new id; lone survivor is ungrouped.
- Paste cascade via `pasteIndex` fixes stacking order.
- Ctrl+D no longer clobbers clipboard; skip-locked on duplicate.

**P4 — Locked/z-order**
- Marquee excludes hidden+locked elements.
- `alignElements` skips locked elements.
- Z-order: renormalize then swap on single + multi-select.

**P5 — Rotation-aware geometry**
- Added `rotatePoint` / `getRotatedAABB` helpers.
- Resize, clampToSlide, marquee, align, and distribute are now rotation-aware.
- World-anchor preserved at slide edges during clamp.
- Crop floored (no inversion); zero-dimension aspect guard added.

**P6 — Keyboard/undo**
- Ctrl+F: single-toggle (was toggling twice on held key).
- Drag selection: synchronous ref, no stale closure.
- Undo/redo: restores selection state + reconciles TipTap content.
- `e.repeat` guard scoped so held-arrow nudge still works.
- Game-key gating while authoring text; listener-churn fixed.

**P7 — Verification sweep**
- S1: `contenteditable` focus guard added to both keyboard guards.
- S2: Escape-to-blur added.
- S4: Confirmed non-issue — single `.slide-canvas` render site at `SlideCanvas.jsx:416`, `querySelector` first-match always correct.
- S5: Confirmed handled by P1's load-effect reset — `App.jsx` `EditorRoute` has no `key` prop, same `EditorPage` instance reused across `/editor/:id` navigation, P1 reset covers it.

**Final gate**: `npm run test` = 2313 passed / 1 skipped / 0 failures (261 files). `npm run lint` = 0 errors (23 pre-existing warnings in unrelated scripts/pptx-parser-benchmark). `npm run build` succeeds. Zero orphan `it.fails`.

## What We Tried

Per-phase scoped test runs (`vitest run client/src/...`) passed each phase cleanly. Only the full `npm run test` caught the broken contract test. The temptation to certify on scoped runs alone was real after Phase 7 looked clean — didn't, and it mattered.

## Root Cause Analysis

Two independent root causes:

1. **Debt accumulation in a monolithic page file.** `EditorPage.jsx` at 77k LOC means behavior from autosave, undo, rotation, and clipboard is entangled. Each fix required careful auditing of shared state mutations that no type system or module boundary enforced.

2. **Source-grep contract test as a brittle artifact.** `tests/unit/clipboard-offset-source.test.js` pinned the literal `+20/+20` paste offset by regex-scanning source. Phase 3 intentionally replaced it with an L1 cascade. The test lived outside `client/src/**/__tests__/` — outside the scope the phase audit scanned — so it was invisible until the full suite ran. Source-grep contracts are fundamentally fragile to intentional behavior changes.

## Lessons Learned

- **Run the full suite before certifying, always.** Scoped runs are for fast iteration; the full run is the gate. A test living in `tests/unit/` rather than `client/src/` is still a test.
- **Source-grep contract tests are landmines.** They fail on intentional refactors, produce false-negative safety signals, and scatter outside obvious scopes. Convert them to behavioral tests that exercise the actual output.
- **`navigator.sendBeacon` is POST-only.** If your save endpoint is PUT, sendBeacon silently drops the request. `fetch({ keepalive: true })` with a size-aware fallback is the correct pattern for flush-on-unload.
- **`it.fails` tripwires are worth the setup cost.** Having 7 runtime-confirmed bugs as `it.fails` before writing a fix line made regression detection automatic; nothing could ship with a partially resolved tripwire.

## Next Steps

- **EditorPage.jsx decomposition** (owner: next feature sprint): 77k LOC is the systemic risk here. Autosave, undo, and clipboard are natural extraction candidates into dedicated hooks/services. No timeline set — document as tech debt in roadmap.
- **Audit remaining source-grep contract tests** across `tests/unit/`: convert any that pin literal source text to behavioral assertions. One-time pass, low-urgency but should happen before the next major refactor.
- **Add `groupId` remapping to the element integration test suite**: currently covered by clipboard unit tests only; a grouping-specific integration scenario would catch regressions earlier.
