---
phase: 6
title: "Keyboard, Focus & Undo Reconciliation"
status: pending
priority: P1
effort: "1d"
dependencies: [2]
---

# Phase 6: Keyboard, Focus & Undo Reconciliation

## Overview
Fix the dead Ctrl+F (double-toggle), the stale-selection-ref drag, the undo/redo
that leaves phantom selection, plus keyboard hardening (no key-repeat runaway,
game keys not hijacking the editor canvas, listener re-subscription churn).

## Bugs Addressed
- **H6 (High)** — Ctrl+F handled by BOTH the registry listener and the legacy inline listener → two toggles cancel → find bar never opens. `use-keyboard.js:69-77` + `EditorPage.jsx:827-831`.
- **H2 (High)** — grabbing an unselected element while multi-selected drags the OLD selection (stale `selectedElementIdsRef` updated in a post-render effect). `SlideCanvas.jsx:513-525`, ref at `:124`.
- **H4 (High)** — undo/redo never reset `selectedElementIds`/`editingElementId` → phantom selection, properties panel acts on removed elements. `EditorPage.jsx:783-810`.
- **F2 (Medium)** — keydown listener re-subscribes every render (inline callbacks defeat `useMemo`); latent stale closure in bringForward/sendBackward. `use-keyboard.js:161-272`.
- **F3 (Medium)** — no `e.repeat` guard → held Ctrl+K strobes palette, held Ctrl+G spams group. `use-keyboard.js:29-98`.
- **F8 (Medium)** — bare game keys (G/R/L/P/E/Space/1-4) live on the editor canvas when a game element is present. `use-keyboard.js:46-65`.

## Requirements
- Functional: Ctrl+F opens find bar (single effective toggle). Grabbing an unselected element drags THAT element. After undo/redo, selection only contains ids that still exist; editing state cleared if its element is gone. Held shortcut keys fire once per press (not on auto-repeat). Game bare-keys inert while authoring (unless an explicit in-editor game-preview mode is active).
- Non-functional: single document keydown listener (remove the legacy one or de-dupe responsibilities); stable handler identity where feasible.

## Architecture
- H6: remove the Ctrl+F branch from the legacy `EditorPage.jsx:827-831` listener (registry `toggleFindReplace` owns it). Verify the legacy listener's other responsibility (slide-sorter) is preserved or migrated. Confirm `onToggleRibbon` (destructured but unused at `use-keyboard.js:113`) isn't expected from the legacy path.
- H2: pass the freshly-computed selection into `startElementDrag` synchronously instead of reading the post-render ref. Either compute the new selection set inline at pointer-down and hand it to the drag, or update `selectedElementIdsRef.current` synchronously before calling `startElementDrag`.
- H4: in `handleUndo`/`handleRedo`, after `setPresentation(prevState)`, reconcile selection — intersect `selectedElementIds` with ids present in the restored slide; clear `editingElementId`/`editingElementIdRef` if its element is gone.
- F2: wrap the inline callbacks (`onEscape`, `onArrow`, z-order, game handlers) in `useCallback`, or have `useKeyboard` read latest handlers from a ref. Ensure bringForward/sendBackward read selection from `selectedElementIdsRef` (not closure) once re-subscription is removed.
- F3: early-return on `e.repeat` in `createKeyboardHandler`.
- F8: only enable `presentation-game` scope keys when actually presenting a game, not merely when a game element exists on the slide in the editor. Gate on present-mode flag.

**RED-TEAM CORRECTIONS:**

- **F3 (High) — DO NOT blanket-guard `e.repeat`.** Arrow-key nudge is dispatched
  inside `createKeyboardHandler` (`use-keyboard.js:82-85` → `onArrow` →
  `EditorPage.jsx:1023-1040` moves elements). A global `if (e.repeat) return`
  kills held-arrow continuous nudge AND held-arrow slide-walking (standard
  behavior). **Scope the guard to the discrete chords that strobe** (Ctrl+K
  palette, Ctrl+G group, Ctrl+M) — NOT arrows, NOT +/- timer. Whitelist or
  per-chord flag, not a top-level return.
- **F8 (High) — present-mode gating REMOVES a wired feature.** In-editor game keys
  are deliberate: `activeGameType` passed from the editor (`EditorPage.jsx:1052`),
  overlays "reachable in-editor" (comment `:250`), `onGameHud/Timer/Reveal/...`
  wired (`1056-1073`). Blanket present-mode gating disables in-editor HUD/reveal/
  timer (a feature), not just the nuisance. **Gate ONLY the nuisance bare-keys
  (Space, 1-4 team-select) that hijack canvas typing; keep HUD(G)/reveal(R)/
  leaderboard(L).** Needs a dedicated in-editor game-preview toggle — VERIFY one
  exists; if not, this fix requires introducing it (else it's a feature removal).
  If no preview flag exists, consider deferring F8 or scoping to only Space/1-4.
- **H2 (Medium) — preserve the existing conditional or break group-drag.** Current
  pointer-down replaces selection ONLY when grabbing an unselected element WITHOUT
  shift (`SlideCanvas.jsx:518-524`). If the synchronous hand-off passes `[id]` in
  ALL cases, grabbing an already-selected element in a multi-selection drags only
  that one (group-drag regression). The synchronous set must replicate the
  conditional: compute `getSelectionIdsForActiveSlideElement(slide, fallback, id)`
  (group expansion) when unselected & no-shift; otherwise hand over the CURRENT
  selection unchanged. Sync the ref too.
- **H4 (Low-Med) — also reset TipTap content.** Clearing `editingElementId` isn't
  enough: if the editing element vanished on undo, the TipTap `editor` still holds
  its HTML; next edit writes stale content. Add `editor.commands.setContent('')`
  (or equivalent) when editing is cleared. Compose WITH the existing
  `reconcileVerticalEdit` (`EditorPage.jsx:793,809`) — chain both, don't replace.
- **H6 (verified sound) — keep the legacy listener.** Remove ONLY the
  `if (e.key === 'f')` block (`827-831`); the legacy listener also owns
  Ctrl+Shift+S slide-sorter (`822-826`) which is NOT in the registry — it must
  stay. `onToggleRibbon` (destructured-unused at `use-keyboard.js:117`) is not
  provided by the legacy path → no orphan.

## Related Code Files
- Modify: `client/src/hooks/use-keyboard.js` (`createKeyboardHandler` 29-98, memo/effect 161-272, scope filter 46)
- Modify: `client/src/pages/EditorPage.jsx` (legacy listener 814-835, undo/redo 783-810, callbacks 1016-1105)
- Modify: `client/src/components/SlideCanvas.jsx` (pointer-down 513-525)
- Create: `client/src/hooks/use-keyboard-repeat-and-scope.test.js` (F3, F8, H6 de-dupe)
- Create: `client/src/pages/editor-undo-selection-reconcile.test.js` (H4 — extract reconcile helper if needed)

## Implementation Steps (TDD)
1. **Test first (H6):** simulate Ctrl+F through both listener paths → assert find bar ends OPEN (one net toggle). Remove ONLY the legacy Ctrl+F branch (`827-831`); assert slide-sorter (Ctrl+Shift+S) branch still fires.
2. **Test first (F3) — scoped:** held Ctrl+K (`repeat:true`) → palette does NOT strobe (toggles once); held Arrow (`repeat:true`) → nudge STILL fires each repeat. Guard only discrete chords.
3. Add per-chord `e.repeat` guard (Ctrl+K/Ctrl+G/Ctrl+M), NOT a global return.
4. **Test first (F8):** game element present + editor (not presenting) → bare Space/`1` do NOT fire game actions; but `G` (HUD) / `R` (reveal) still work in-editor preview. VERIFY a preview flag exists first; if none, scope fix to Space/1-4 only and note the deferral.
5. Gate only nuisance bare-keys; keep HUD/reveal/leaderboard.
6. **Test first (H4):** undo past an element's creation → `selectedElementIds` no longer contains it, editing cleared, AND TipTap content reset. Extract `reconcileSelectionAfterHistory(restoredSlide, selectedIds, editingId)`; chain with existing `reconcileVerticalEdit`. Add a vertical-child + stale-selection case.
7. Wire reconcile into undo/redo (compose with `reconcileVerticalEdit`, don't replace).
8. **Test first (H2):** (a) multi-select then pointer-down on UNSELECTED no-shift element → drag targets that element (group-expanded if grouped); (b) pointer-down on an ALREADY-selected element in a multi-selection → whole selection drags (group-drag NOT broken). Both cases.
9. Fix the synchronous selection hand-off in SlideCanvas preserving the unselected-&-no-shift conditional + group expansion; sync the ref.
10. **F2:** memoize callbacks (or latest-handler-ref); assert bringForward/sendBackward read fresh selection after removing re-subscription.
11. `npm run test` + `npm run lint`.

## Success Criteria
- [x] H6: Ctrl+F opens find bar; slide-sorter shortcut preserved
- [x] H2: grabbing unselected element drags it (group-expanded); grabbing already-selected keeps group-drag
- [x] H4: undo/redo leaves no phantom selection/editing; TipTap content reset; composes with reconcileVerticalEdit
- [x] F3: auto-repeat suppressed for Ctrl+K/G/M only; held-arrow nudge STILL works
- [x] F8: nuisance bare-keys (Space/1-4) inert in editor; HUD/reveal/leaderboard preview preserved
- [x] F2: no per-render listener churn; z-order handlers read fresh selection
- [x] lint clean

## Risk Assessment
- **Risk:** removing the legacy listener could drop slide-sorter shortcuts. **Mitigation:** read the full legacy handler first; migrate any non-Ctrl+F responsibility into the registry or keep the listener minus the Ctrl+F branch.
- **Risk:** H2 fix touches pointer timing — easy to regress single-select drag. **Mitigation:** add tests for both single-select (grab selected) and multi-select (grab unselected) paths.
- **Risk:** F2 memoization could introduce stale closures if deps wrong. **Mitigation:** prefer the latest-handler-ref pattern over manual dep lists; cover bringForward selection freshness with a test.
- **Risk:** F8 present-mode gating may break legit in-editor game preview. **Mitigation:** confirm whether an in-editor game-preview mode exists; gate on it rather than blanket-disabling.
