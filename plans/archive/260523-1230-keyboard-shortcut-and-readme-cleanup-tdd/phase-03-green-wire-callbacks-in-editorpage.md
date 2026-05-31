---
phase: 3
title: "GREEN Wire 8 Callbacks in EditorPage"
status: completed
priority: P0
effort: "2h"
dependencies: [1]
---

# Phase 3: GREEN — Wire 8 Callbacks in EditorPage

## Overview

Add 8 callback props to the `useKeyboard({...})` invocation in `EditorPage.jsx` (~line 1119-1187). Each callback uses the canonical action verified by Researcher 2. Also adds `zoom` and `setZoom` to the editor-store destructures (currently absent in EditorPage scope).

After this phase, the contract test passes fully and the 8 keyboard chords trigger their actions in editor mode.

## Requirements

### Functional
- `Ctrl+M` opens template modal (insert slide).
- `Ctrl+G` groups currently selected elements.
- `Ctrl+Shift+G` ungroups.
- `Ctrl+]` brings selected element forward.
- `Ctrl+[` sends selected element backward.
- `Ctrl+0` resets zoom to 1.
- `Ctrl+=` zooms in (clamp 3).
- `Ctrl+-` zooms out (floor 0.2).
- 3 stale `console.log` stubs in the commands array (EditorPage:1106-1108) replaced with real calls — command palette and keyboard now share behavior.

### Non-functional
- No new state, no new hooks.
- `zoom`/`setZoom` selectors stable (Zustand selector form already used elsewhere in EditorPage).
- Wiring matches existing ribbon button behavior (parity with `canvas-controls.jsx`, `arrange-controls.jsx`).

## Red-Team Adjustments (Session 1 — 2026-05-23)

- **F1 (Critical):** Use `editor-store.js` canonical zoom actions (`zoomIn`, `zoomOut`, `resetZoom`) instead of inlining `canvas-controls.jsx` expressions. Store actions exist at `editor-store.js:71-75` with clamps (0.25 ≤ zoom ≤ 4, step 0.25). Canvas-controls.jsx uses different values (0.2-3, step 0.1) — those were hand-rolled before the store actions existed, and using them from the keyboard would diverge from store-level behavior. Canonical = store actions. Side effect: no need to destructure `zoom` in EditorPage (store actions self-read).
- **F10 (Low):** `setZoom`/`zoomIn`/`zoomOut`/`resetZoom` already exist in `editor-store.js:72-75`. Removed the "ADD if missing" hedge in step 3.1.

## Architecture

EditorPage already has all source values needed:
- `setShowTemplateModal` (line ~198) — for `onInsertSlide`.
- `groupElements`, `ungroupElements` (line ~909-910, from `useSlideOperations`) — for `onGroup`/`onUngroup`.
- `bringElementForward`, `sendElementBackward` (line ~928, 937 inline) — for `onBringForward`/`onSendBackward`.
- `selectedElementIds` — already destructured for ribbon arrange controls.

For zoom: pull canonical actions from `useEditorStore` — they self-contain the state read and clamp:
- `zoomIn`, `zoomOut`, `resetZoom` at `editor-store.js:73-75`.
- No need to destructure `zoom` itself.

## Related Code Files

- **Modify:** `client/src/pages/EditorPage.jsx`
- **Read for context:** `client/src/components/ribbon/controls/canvas-controls.jsx:74,83,92` (canonical zoom expressions), `client/src/hooks/use-slide-operations.js:93,113`, `client/src/stores/editor-store.js` (verify `setZoom` action exists)

## Implementation Steps

### 3.1 — Add zoom actions to EditorPage store reads

Locate the cluster of `useEditorStore((s) => ...)` selectors. Add:

```jsx
const zoomIn = useEditorStore((s) => s.zoomIn)
const zoomOut = useEditorStore((s) => s.zoomOut)
const resetZoom = useEditorStore((s) => s.resetZoom)
```

`zoomIn`/`zoomOut`/`resetZoom` and `setZoom` already exist at `editor-store.js:72-75`. No store edits needed — pulling existing actions.

### 3.2 — Add 8 callbacks to `useKeyboard({...})`

In the `useKeyboard({...})` invocation (~line 1119-1187), append:

```jsx
onInsertSlide: () => setShowTemplateModal(true),
onGroup: () => groupElements(),
onUngroup: () => ungroupElements(),
onBringForward: () => {
  if (selectedElementIds.length === 1) bringElementForward(selectedElementIds[0])
},
onSendBackward: () => {
  if (selectedElementIds.length === 1) sendElementBackward(selectedElementIds[0])
},
onResetZoom: () => resetZoom(),
onZoomIn: () => zoomIn(),
onZoomOut: () => zoomOut(),
```

### 3.3 — Replace 3 command-palette stubs (lines 1106-1108)

The commands array still has placeholder logs for zoom. Replace with the same canonical store actions:

```diff
- { id: 'zoomIn',    label: 'Zoom in',    action: () => console.log('[zoom] in') },
- { id: 'zoomOut',   label: 'Zoom out',   action: () => console.log('[zoom] out') },
- { id: 'resetZoom', label: 'Reset zoom', action: () => console.log('[zoom] reset') },
+ { id: 'zoomIn',    label: 'Zoom in',    action: () => zoomIn() },
+ { id: 'zoomOut',   label: 'Zoom out',   action: () => zoomOut() },
+ { id: 'resetZoom', label: 'Reset zoom', action: () => resetZoom() },
```

Verify line numbers via Grep before edit (drift since scout snapshot is possible).

### 3.4 — Run contract test + manual smoke

```powershell
npx vitest run client/src/hooks/use-keyboard-contract.test.js
```

All 8 previously-failing subtests must pass. Total green for editor-scope shortcuts.

Manual smoke (post Phase 5 sweep also covers this):
- Open `/editor/<any-presentation>`, click body (deselect TipTap focus).
- Press each of Ctrl+M, Ctrl+G, Ctrl+Shift+G, Ctrl+], Ctrl+[, Ctrl+0, Ctrl+=, Ctrl+-.
- Verify expected behavior. Document any anomalies in Phase 5 evidence.

## Success Criteria

- [x] `EditorPage.jsx` `useKeyboard({...})` block contains the 8 new callback props.
- [x] `zoomIn`, `zoomOut`, `resetZoom` destructured from `useEditorStore`.
- [x] 3 stale `console.log` stubs replaced with the same store actions in commands array.
- [x] Contract test green for all editor-scope shortcuts (8 previously-RED now GREEN).
- [x] Manual smoke: all 8 chords trigger expected actions in the editor.
- [x] Zoom keyboard clamp matches ribbon zoom button behavior (both call same store actions).
- [x] `npm run lint` passes; no new warnings on `EditorPage.jsx`.
- [x] No regressions in existing keyboard behavior (Ctrl+S, Ctrl+Z, Delete, etc.).

## Risk Assessment

| Risk | Mitigation |
|---|---|
| `setZoom`/`zoomIn`/`zoomOut`/`resetZoom` may not exist as Zustand actions | RESOLVED — all four exist at `editor-store.js:72-75`. No store edits needed. |
| Canvas-controls.jsx zoom expressions (step 0.1, clamp 0.2-3) diverge from store actions (step 0.25, clamp 0.25-4) | RESOLVED — keyboard uses store actions = canonical. Canvas-controls.jsx divergence is pre-existing; out of scope for this plan but flagged for future cleanup. |
| Closure on stale state | Not applicable — store actions read state internally via `set((s) => ...)` form. No closure on stale values. |
| Multi-select bringForward/sendBackward UX divergence | Researcher 2 noted current ribbon uses `selectedElementId` (singular). Callbacks guard on `selectedElementIds.length === 1` — matches ribbon. Multi-element z-order is OUT OF SCOPE for this plan; track separately if needed. |
| `setShowTemplateModal` requires React batch flush before Ctrl+M dispatch | React 18+ auto-batches; modal opens on next render. No timing issue in normal use. |
| Stale stub replacement: command palette may already work via different path | Verified at scout time: lines 1106-1108 are dead-code logs. Replacement is safe. |

## Next Steps

Phase 4 (README) is parallel-safe with Phase 3. Phase 5 runs after both phases complete to do a full regression sweep.
