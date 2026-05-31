---
phase: 2
title: "GREEN Forward 8 Callbacks Through useKeyboard"
status: completed
priority: P0
effort: "1-2h"
dependencies: [1]
---

# Phase 2: GREEN — Forward 8 Callbacks Through useKeyboard

## Overview

Add 8 new callback parameters to `useKeyboard` so they reach `createKeyboardHandler`. Three locations per callback: destructure, callbacks bag, dep array. After this phase, contract test passes for all editor-scope shortcuts.

**Strictly forwarding only.** No new handler logic, no dispatch refactor.

## Requirements

### Functional
- 8 new params destructured from hook args: `onInsertSlide`, `onGroup`, `onUngroup`, `onBringForward`, `onSendBackward`, `onResetZoom`, `onZoomIn`, `onZoomOut`.
- Each passed into `createKeyboardHandler({...})` callbacks bag.
- Each listed in the handler `useMemo` dep array.
- No change to API contract for existing callers — new params are optional (default `undefined`, hook still no-ops gracefully if caller doesn't pass them, matching existing pattern).

### Non-functional
- React hook exhaustive-deps lint passes.
- No new ESLint warnings introduced on changed file.
- Hot-reload behavior unchanged.

## Red-Team Adjustments (Session 1 — 2026-05-23)

- **F8:** `useMemo` dep array MUST include all 8 callbacks. Explicitly listed in step 2.4. Verify React `exhaustive-deps` lint passes (it will — leaf callbacks are stable identity refs from caller).
- **F11:** Removed claim that LiveViewPage/SpeakerViewPage use `useKeyboard`. Verified via `grep`: only `EditorPage.jsx` imports `useKeyboard`. Risk row updated.

## Architecture

The hook signature pattern (verified at `use-keyboard.js:94-132`, `142-174`, `176-214`):

```js
export function useKeyboard({
  onSave, onDelete, /* ...30+ existing... */
  // ADD 8 here:
  onInsertSlide, onGroup, onUngroup,
  onBringForward, onSendBackward,
  onResetZoom, onZoomIn, onZoomOut,
}) {
  // ...
  const handler = useMemo(() => createKeyboardHandler({
    onSave, onDelete, /* ...existing... */
    // ADD 8 here:
    onInsertSlide, onGroup, onUngroup,
    onBringForward, onSendBackward,
    onResetZoom, onZoomIn, onZoomOut,
  }), [
    onSave, onDelete, /* ...existing... */
    // ADD 8 here:
    onInsertSlide, onGroup, onUngroup,
    onBringForward, onSendBackward,
    onResetZoom, onZoomIn, onZoomOut,
  ])
}
```

Three lists must stay in sync. Alphabetical grouping within each block aids future review.

## Related Code Files

- **Modify:** `client/src/hooks/use-keyboard.js`
- **Read for context:** `client/src/utils/keyboard-handler.js` (or wherever `createKeyboardHandler` lives — verify import path at edit time), `client/src/hooks/use-keyboard-contract.test.js`

## Implementation Steps

### 2.1 — Verify current hook structure

Read `client/src/hooks/use-keyboard.js` end-to-end before editing. Confirm:
- Line range of destructure block.
- Line range of `createKeyboardHandler` invocation.
- Line range of `useMemo` deps.

If structure has drifted from scout snapshot, adjust ranges. **Do NOT edit if line numbers in plan don't match — re-scout first.**

### 2.2 — Add 8 destructure entries

Insert into the param destructure block (line ~94-132). Group at the end of the list with a brief comment to call out the addition:

```js
// Editor shortcuts wired in 260523-1230 cleanup plan
onInsertSlide,
onGroup,
onUngroup,
onBringForward,
onSendBackward,
onResetZoom,
onZoomIn,
onZoomOut,
```

Remove the comment if/once the rest of the destructure block has no provenance comments — match existing style.

### 2.3 — Add 8 entries to callbacks bag

Insert into `createKeyboardHandler({...})` call (line ~142-174). Same 8 names, same order, no value transformation:

```js
onInsertSlide,
onGroup,
onUngroup,
onBringForward,
onSendBackward,
onResetZoom,
onZoomIn,
onZoomOut,
```

### 2.4 — Add 8 entries to `useMemo` dep array

Insert into deps array (line ~176-214). Same 8 names in same order:

```js
onInsertSlide,
onGroup,
onUngroup,
onBringForward,
onSendBackward,
onResetZoom,
onZoomIn,
onZoomOut,
```

### 2.5 — Run lint + contract test

```powershell
npm run lint
npx vitest run client/src/hooks/use-keyboard-contract.test.js
```

Lint must pass with no new warnings. Contract test must show 8 previously-failing subtests now passing — provided EditorPage is also updated in Phase 3. If running Phase 2 alone, contract test will still fail because EditorPage doesn't pass the callbacks; the unit test `use-keyboard.test.js` wiring smoke (Step 1.2) is the standalone Phase 2 gate.

**Phase 2 alone GREEN means:** `use-keyboard.test.js` wiring smoke passes + `npm run lint` clean. Contract test full green requires Phase 3.

## Success Criteria

- [x] `use-keyboard.js` destructure, callbacks bag, and dep array all contain the 8 new entries.
- [x] `npm run lint` passes; no new warnings on `use-keyboard.js`.
- [x] `use-keyboard.test.js` wiring smoke test passes.
- [x] Existing `use-keyboard.test.js` tests still pass (no regressions in the 30+ other shortcuts).
- [x] No new files created.

## Risk Assessment

| Risk | Mitigation |
|---|---|
| Inconsistent ordering across 3 lists → silent forwarding gap | Use the same 8 names in same order across all 3 blocks; alphabetize within each block; visually diff before commit. |
| `createKeyboardHandler` ignores keys not destructured internally | Verified at scout time: handler dispatches via `callbacks['on' + capitalize(id)]?.()` — any key in the bag with matching `on<Id>` name dispatches. No allow-list. |
| Adding params widens hook API; downstream consumers may break | Only `EditorPage.jsx` imports `useKeyboard` (verified by grep). New params default to `undefined`. No other call sites. |
| Future shortcut added without updating these 3 lists | Phase 1 contract test is the regression guard — adding a registry entry without hook update fails the test. |

## Next Steps

Phase 3 wires the actual callback values in EditorPage. Phases 2 and 3 are parallel-safe by file ownership.
