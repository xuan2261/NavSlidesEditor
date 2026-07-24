# Stream B — E2E Coverage Gap Audit
**Scope:** fixes shipped in commit e1f53820 ("fix(editor): correct element interaction defects across editor surfaces")
**Date:** 2026-06-09
**Method:** full glob of `tests/e2e/**/*.spec.js` (92 files), read of all candidate specs for each fix area, grep sweeps for key terms (beforeunload, marquee, applyToSelection, groupId remap, drag-unselected, undo-selection, etc.)

---

## Summary Table

| # | Fix area | Status | Browser-dependence | Risk |
|---|----------|--------|--------------------|------|
| 1 | Autosave flush on unmount / navigation / tab-close (beforeunload + keepalive PUT) | **GAP** | HIGH | HIGH |
| 2 | A→B navigation: drain save queue before switching presentations | **GAP** | HIGH | HIGH |
| 3 | History seeding — Undo disabled until first real edit; 50-entry cap | **GAP** | MED | MED |
| 4 | Apply-to-selection: multi-select property fan-out (delta X/Y, absolute W/H, type-gated style, negative coords, rotation wrap) | **GAP** | MED | HIGH |
| 5 | Clipboard: groupId remap on paste/duplicate, paste cascade, skip-locked duplicate, Ctrl+D no-clobber | **PARTIAL** | MED | HIGH |
| 6 | Marquee excludes hidden+locked; align skips locked; z-order neighbor-swap on single+multi-select | **GAP** | HIGH | MED |
| 7 | Rotation-aware resize + clampToSlide; rotated marquee/align/distribute; crop floor; zero-dim aspect guard | **PARTIAL** | HIGH | HIGH |
| 8a | Keyboard: Ctrl+F single-toggle (second press closes) | **PARTIAL** | LOW | LOW |
| 8b | Keyboard: synchronous drag — grabbing unselected element drags THAT element | **GAP** | HIGH | MED |
| 8c | Keyboard: Escape exits text editing (contenteditable focus guard) | **PARTIAL** | MED | MED |
| 8d | Keyboard: undo/redo selection + TipTap reconcile | **GAP** | MED | MED |
| 8e | Keyboard: scoped e.repeat (held-arrow nudge still fires; game keys blocked in editor) | **PARTIAL** | MED | LOW |
| 8f | Keyboard: listener-churn fix (no duplicate handlers after rapid element switches) | **GAP** | HIGH | MED |

**Totals: 7 GAP · 4 PARTIAL · 2 COVERED (resize aspect-lock snap in coverage-gaps-resize-guides.spec.js; Escape modal close in editor.spec.js)**

---

## GAP / PARTIAL Detail

### 1. GAP — Autosave flush on unmount / beforeunload / tab-close
**Why jsdom insufficient:** `beforeunload` does not fire in jsdom. `fetch` with `keepalive:true` is not supported in jsdom (no real network stack). Unit tests can only mock the debounce flush; they cannot verify the keepalive PUT actually reaches the server before the page unloads.

**Browser-only scenario to test:**
- Make an edit, wait < debounce threshold, then `page.close()` or navigate away via `page.goto('/')`.
- After page close, re-fetch the presentation via API and assert the edit was persisted.
- Second variant: intercept the PUT and assert `request.headers()['connection'] === 'keep-alive'` or that it is fired during unload.

**Extend/create:** new file `tests/e2e/autosave-flush-on-leave.spec.js`

---

### 2. GAP — A→B navigation drain save queue
**Why jsdom insufficient:** Real router navigation (`page.goto`) triggers actual React unmount/cleanup. jsdom unmount is synchronous and never exercises the HTTP drain timing race.

**Browser-only scenario to test:**
- Open editor for presentation A, make an edit (don't wait for autosave debounce).
- Immediately navigate to editor for presentation B (simulate clicking a presentation from the home sidebar or direct `page.goto`).
- Assert presentation A's edit is persisted via API before B loads.

**Extend/create:** `tests/e2e/autosave-flush-on-leave.spec.js` (same file as fix 1, second test)

---

### 3. GAP — History seeding: Undo disabled until first edit; 50-entry cap
**Why jsdom insufficient:** The 50-cap test requires 50+ real dispatched actions through the Zustand store, which jsdom can simulate, but the "Undo disabled on fresh load" relies on the real UI rendering the undo button as disabled — a DOM + aria state that jsdom fakes without real browser rendering constraints.

**Browser-only scenario to test:**
- Open editor for a fresh presentation → assert Undo toolbar button has `disabled` attribute or `aria-disabled="true"`.
- Add one element → assert Undo is now enabled.
- For cap: duplicate element 55 times, then undo 55 times — assert undo bottoms out at 50 (not 55).

**Extend/create:** extend `tests/e2e/undo-redo.spec.js` (add 2 tests: "undo disabled on fresh load", "history capped at 50 entries")

---

### 4. GAP — Apply-to-selection multi-select property fan-out
**Why jsdom insufficient:** No existing E2E touches multi-select property edits at all (grep returned zero matches for `applyToSelection`, `multi.*property`, `fan.*all`). The real behavior requires real pointer events to establish multi-selection and real DOM input events on the properties panel to trigger fan-out.

**Browser-only scenarios to test:**
- Shift-click 3 shapes → change X in properties panel → assert all 3 shifted by delta (not set to absolute).
- Shift-click 2 shapes → change Width → assert both set to the absolute value entered.
- Shift-click a text + a shape → apply a text-only style → assert only text element updated (type-gating).
- Shift-click with negative X input → assert clamping doesn't break; elements move correctly.

**Extend/create:** new file `tests/e2e/canvas/apply-to-selection.spec.js`

---

### 5. PARTIAL — Clipboard: groupId remap, paste cascade, skip-locked duplicate, Ctrl+D no-clobber
**What's covered:** `canvas/clipboard.spec.js` covers basic copy/paste offset, Ctrl+D offset, cut+paste restore. `element-lifecycle.spec.js` covers locked element blocks duplicate.

**What's missing:**
- No test verifies groupId is remapped (pasted group gets a NEW groupId, not the original — collision risk). The arrange spec only checks `groupId` exists/is-cleared after group/ungroup, not remap on paste.
- No test verifies Ctrl+D does not mutate the clipboard (copy then Ctrl+D then paste still produces the copied element, not the duplicate).
- No test for paste cascade (paste multiple times produces increasing offsets).

**Browser-only scenario:**
- Seed two grouped elements, copy, paste → assert new groupId !== original groupId.
- Copy element, Ctrl+D, then Ctrl+V → assert clipboard is still the original element (not the Ctrl+D duplicate).

**Extend:** `tests/e2e/canvas/clipboard.spec.js`

---

### 6. GAP — Marquee excludes hidden+locked; align skips locked; z-order neighbor-swap
**Why jsdom insufficient:** Marquee selection requires real pointer `mousedown`/`mousemove`/`mouseup` drag across the canvas at precise coordinates. jsdom pointer events are not rendered; bounding boxes are all zero.

**Browser-only scenarios to test:**
- Hide element A, lock element B, marquee-drag across all three → assert only the visible/unlocked element ends up selected.
- Select element A + locked element B → click Align Left → assert only A moved, B unchanged.
- Select one element → click "Send Backward" → assert its zIndex decremented by 1 (neighbor-swap, not send-to-back).
- Select two elements → click "Bring Forward" → assert both incremented.

**Extend/create:** new file `tests/e2e/canvas/marquee-and-zorder.spec.js`

---

### 7. PARTIAL — Rotation-aware resize + clampToSlide; rotated align/distribute; zero-dim guard
**What's covered:** `coverage-gaps-resize-guides.spec.js` tests resize aspect-lock (SE handle drag + Shift) and rotation-snap (drag rotation handle + Shift snaps to 15°). This exercises real pointer drag on a rotated element.

**What's missing:**
- No test verifies clampToSlide: resize a rotated element toward the slide edge and assert it doesn't exceed slide bounds.
- No test for rotated align: align-left on a 45° element should use its bounding-box left edge, not its raw X.
- No test for zero-dimension guard (resize to 0px width should floor to 1px, not produce NaN).
- Crop floor (image crop to 0 area should be prevented).

**Browser-only scenario:**
- Seed element at x=0 rotated 45°, resize left → assert width ≥ 1 (zero-dim guard).
- Seed element near slide edge rotated 30°, resize toward edge → assert element stays within slide bounds.

**Extend:** `tests/e2e/coverage-gaps-resize-guides.spec.js`

---

### 8a. PARTIAL — Ctrl+F single-toggle
**What's covered:** `find-replace.spec.js` tests open with Ctrl+F and close with Escape. `keyboard-shortcuts.spec.js` has one Ctrl+F open test.

**What's missing:** no test presses Ctrl+F a second time to verify the bar closes (toggle behavior, not open-only).

**Extend:** `tests/e2e/find-replace.spec.js` — add: "second Ctrl+F closes the bar"

---

### 8b. GAP — Synchronous drag: grabbing unselected element drags THAT element
**Why jsdom insufficient:** Requires real `pointerdown` on an element that is not currently selected. jsdom fires synthetic events but does not exercise the editor's `pointerdown` → immediate selection → drag initiation sequence.

**Browser-only scenario:**
- Seed two elements, select element A.
- `mouse.down()` directly on element B (no click first) then drag.
- Assert element B moved, element A did not move, and element B is now selected.

**Extend/create:** `tests/e2e/canvas/marquee-and-zorder.spec.js` (or a dedicated `drag-interactions.spec.js`)

---

### 8c. PARTIAL — Escape exits text editing / contenteditable focus guard
**What's covered:** `editor-history-errors.spec.js` (hardening) tests Escape closes modals. `editor.spec.js` has a test where Escape is pressed and `proseMirrorCount` drops to 0. This is close but tied to the modal-close path.

**What's missing:** no test specifically targets the contenteditable focus guard (double-clicking a text element that is already in another text element's editing mode — should blur the first and focus the second without leaving orphaned contenteditable).

**Extend:** `tests/e2e/elements/text-element-rich-formatting-and-prosemirror-editing-and-persistence.spec.js` — add: "clicking a second text element while editing the first exits the first"

---

### 8d. GAP — Undo/redo selection + TipTap reconcile
**Why jsdom insufficient:** TipTap is a real ProseMirror instance that interacts with the browser's Selection API. jsdom's Selection API is a stub. The reconcile path (undo moves editor to prev state AND restores cursor position) is untestable in jsdom.

**Browser-only scenario:**
- Double-click text element, type "hello", press Escape.
- Ctrl+Z → assert the text element returns to its prior content AND no stale cursor/selection state leaves the editor in a broken input mode (try typing again after undo).

**Extend:** `tests/e2e/undo-redo.spec.js` — add: "undo after text edit restores content and editor remains usable"

---

### 8e. PARTIAL — Scoped e.repeat / game-key gating
**What's covered:** `games/keyboard-shortcuts.spec.js` tests G, L, Enter, R, P in game context — confirms game keys don't throw in game view. `keyboard-shortcuts.spec.js` does not test held-arrow nudge.

**What's missing:** no test holds an arrow key for >1 repeat cycle and asserts the element nudged multiple times (scoped `e.repeat` still fires). No test verifies game keys (G, L) are suppressed in the regular editor (not game mode).

**Extend:** `tests/e2e/keyboard-shortcuts.spec.js`  add held-arrow nudge test

---

### 8f. GAP — Listener-churn fix (no duplicate handlers after rapid element switches)
**Why jsdom insufficient:** The bug manifests as multiple simultaneous keyboard handlers firing on the same event after rapid selection changes. This requires real browser event dispatch and real React effect cleanup timing, which jsdom does not replicate.

**Browser-only scenario:**
- Seed 3 elements. Rapidly click each in sequence (no wait).
- Press Delete once → assert exactly 1 element was removed (not 2 or 3 from duplicate handlers).
- Alternatively: press Ctrl+Z once after rapid switching → assert undo fires exactly once (not multiple times).

**Extend/create:** `tests/e2e/keyboard-shortcuts.spec.js` or `tests/e2e/canvas/marquee-and-zorder.spec.js`

---

## Prioritized E2E Specs to Write (risk × browser-dependence)

| Priority | Spec to create/extend | Fix areas covered | Justification |
|----------|----------------------|-------------------|---------------|
| **1** | `tests/e2e/autosave-flush-on-leave.spec.js` (new) | Fix 1 + Fix 2 | Data-loss path; `beforeunload`+keepalive untestable in jsdom; prior phase confirmed symptom didn't reproduce in jsdom at all |
| **2** | `tests/e2e/canvas/apply-to-selection.spec.js` (new) | Fix 4 | Zero existing browser coverage; multi-select property fan-out is a core editing surface; high regression surface area |
| **3** | `tests/e2e/canvas/marquee-and-zorder.spec.js` (new) | Fix 6 + Fix 8b + Fix 8f | Covers 3 gaps that all require real pointer coordinates and real browser event dispatch; groups naturally into one spec |
| **4** | `tests/e2e/undo-redo.spec.js` (extend) | Fix 3 + Fix 8d | Undo-disabled-on-load is a subtle UI state; TipTap reconcile requires real Selection API; both belong in the existing undo spec |
| **5** | `tests/e2e/canvas/clipboard.spec.js` (extend) | Fix 5 | groupId remap and Ctrl+D no-clobber are correctness bugs (silent data corruption on paste) that only surface with real DOM state |

---

## Limitations

- Did not run the existing Playwright suite; coverage judgements are static (read-only audit of spec source).
- `tests/e2e/coverage-gaps-*.spec.js` files suggest prior gap-filling rounds; those were read but no new gaps were found in them for these specific fixes.
- The autosave keepalive assertion may need `page.route` interception rather than a pure network check, since Playwright's request interception is not guaranteed to catch keepalive fetches fired during `beforeunload` — the spec design itself needs care (intercept before navigation, assert after).
- Game-key gating in non-game editor context (8e) was not verifiable without reading `EditorPage` implementation; classified PARTIAL conservatively.
