# Code Review — R2: Editor UI + Controls + State Workflow

Date: 2026-06-11
Scope: EditorPage.jsx, stores (editor/presentation/ui), properties/, ribbon/, hooks (keyboard/clipboard/slide-ops/save), FindReplaceBar, snapping helper.
Mode: READ-ONLY. Findings only.

## Counts
- Critical: 0
- Important: 4
- Minor: 8

---

## Important

### I1. Find & Replace ignores vertical child slides (search + replace gap)
File: `client/src/components/FindReplaceBar.jsx:34-52`, `:72-119`; helper `find-replace-helpers.js:118-144`
- `matches` iterates `presentation.slides[].elements` only. Vertical child slides (`slide.children[].elements`, created by `addChildSlide` in `use-slide-operations.js:342`) are never searched.
- `handleReplace` / `handleReplaceAll` / `replaceAllInSlides` likewise only rewrite parent `slide.elements`, never `children`.
- Impact: text living on a vertical child is invisible to Find, and Replace All silently skips it. Users editing a deck with vertical stacks get partial/incorrect replace results.
- Fix: extend match collection and replace mapping to recurse into `slide.children`. `onNavigateToSlide` also needs a child target (currently only sets parent `currentSlideIndex` via `EditorModals.jsx:168`).

### I2. Ribbon arrange (forward/backward/front/back) only moves the PRIMARY element on multi-select
File: `EditorPage.jsx:1450-1453` (RibbonPanel) and `:1574-1575` (PropertiesPanel)
- `onBringForward/onSendBackward/onBringToFront/onSendToBack` are wired to `bringElementForward(selectedElementId)` etc., where `selectedElementId = selectedElementIds[last]` (`:213`). With N elements selected, the ribbon/property buttons restack only one.
- Keyboard Ctrl+]/Ctrl+[ correctly uses `stepSelectedZOrder` (whole selection, `:839-847`). So the same intent gives different results depending on entry point.
- Impact: inconsistent z-order behavior; multi-select reorder via UI buttons appears broken.
- Fix: route ribbon arrange buttons through `stepSelectedZOrder` / a multi-aware to-front/back when `selectedElementIds.length > 1`.

### I3. Redo history depth capped at 20 while undo is 50 — comment contradicts code
File: `EditorPage.jsx:935` vs `:630-636`
- `handleUndo` pushes redo as `redoStackRef.current.slice(-19)` + 1 = max 20 entries. The history-push comment at `:630` claims "matches redo-push cap at 49"; actual cap is 19/20.
- Impact: after >20 sequential undos, the oldest redo states are dropped — user cannot redo forward to where they were. Asymmetric, surprising, and the comment is factually wrong (maintenance hazard).
- Fix: align caps (use `slice(-49)` for redo) or correct the comment to reflect an intentional 20-step redo limit.

### I4. Format-ribbon position/size/rotation controls have no mixed/indeterminate state on multi-select
File: `ribbon-format-tab-element-position-size-rotation-controls.jsx:248-302`
- X/Y/W/H/Rotation inputs bind directly to `selectedElement.*` (the primary). Only Opacity computes `computeMixedValues` (`:237`). The Properties panel (`common-element-controls.jsx:28-41`) DOES blank divergent numeric fields with "—".
- Impact: with a divergent multi-selection the ribbon shows the primary's concrete X/W/rotation as if shared; editing then fans a delta/absolute to all (`element-update-fanout.js`), so the displayed number does not represent the selection and an accidental edit silently reshapes every element. Inconsistent with the Properties panel contract.
- Fix: feed `elements`/`selectedElementIds` into mixed-value detection for geometry keys here too, blanking + showing "—" like the panel.

---

## Minor

### M1. Single-element delete leaves a stale editing ref
File: `EditorPage.jsx:659-672`
- `deleteElement` calls `setEditingElementId(null)` but does NOT clear `editingElementIdRef.current` (contrast `deleteSelectedElements` at `:93-94`). A late TipTap `onUpdate` would target a removed id. Harmless today (map finds no match) but fragile.
- Fix: clear `editingElementIdRef.current = null` when the edited element is deleted.

### M2. Arrow-key nudge issues one setPresentation per selected element
File: `EditorPage.jsx:1179-1183`
- Loops `updateElement(id, …)` per id instead of a single `updateElements` batch. For large multi-selections this is N store writes + N renders per keypress.
- Fix: build one batch and call `updateElements`.

### M3. Ctrl+D duplicate does not select the new copies
File: `EditorPage.jsx:1064-1079`
- `handleDuplicate` adds duplicated elements but never updates selection to the new ids (the pure helper returns `lastId`/ids but they're discarded). PowerPoint/Keynote select the duplicate. Selection stays on originals.
- Fix: `setSelectedElementIds` to the duplicated ids (the op already computes them).

### M4. `addToSelection` store action does not dedupe
File: `stores/editor-store.js:11-14`
- `[...prev, id]` with no `includes` guard → duplicate ids if called twice for one element. Currently only exercised by tests (production uses `toggleElementSelection`), so latent.
- Fix: guard `prev.includes(id)`.

### M5. setState side effect inside setPresentation updater
File: `use-slide-operations.js:271, 283, 296, 308, 320` (addSlide/delete/duplicate); also `EditorPage` moveSlide
- `setCurrentSlideIndex(...)` is invoked inside the `setPresentation((prev) => …)` reducer. Reducers must be pure; React 18 StrictMode double-invokes them in dev. Values set are idempotent so it works, but it's an anti-pattern that hides real bugs if logic grows.
- Fix: compute next index from the result and call `setCurrentSlideIndex` after, outside the updater.

### M6. Teardown flush cannot recover an in-flight save that fails after unmount
File: `EditorPage.jsx:350-372`, `:407-440`
- If a normal save is in flight at unmount, `queuedSaveRef` is already nulled (`:354`), so `flushPendingSaveNow` sends nothing. If that in-flight request then rejects (`:369` re-queues), no retry path exists post-unmount → edit lost.
- Low probability; documented transport limits acknowledged. Note as known edge.

### M7. Late save resolution can setState after unmount
File: `EditorPage.jsx:327-344`
- `persistPresentation` resolves after teardown and calls `setSaveStatus/setLastSavedAt`. `attemptId` guard prevents stale-status overwrite but not the post-unmount setState (React warning only).
- Fix: optional mounted ref guard.

### M8. `dangerously`-style raw fill default mismatch hides "mixed" for unset props
File: `selection-mixed-values.js:21-23` used by `shape-properties.jsx:10`
- Two shapes both lacking `fill` (undefined) read as not-mixed, but each renders a different *default* swatch (`'#6366f1'`/`'#3b82f6'`). Editing fans a value that may differ from what the user saw. Cosmetic edge.

---

## Verified-OK (checked, not defects)
- `use-autosave.js` is dead code (not imported by EditorPage); no double-autosave. EditorPage uses its own `schedulePresentationSave` queue.
- Clipboard paste: fresh `crypto.randomUUID` ids, cascading offset via `pasteCount`, group remap (≥2 members) — no id collision; paste routes to active child via `mapActiveSlide`.
- `useKeyboard`: single document listener with ref-read options (no stale closure / no churn); INPUT/TEXTAREA/SELECT/contentEditable guarded; repeat-suppression for one-shot chords.
- `snapWithRef` receives a pre-bound 1-arg `snap` from SlideCanvas (`SlideCanvas.jsx:155`); the 3-arg `snapToGrid` export is a separate helper — no arity bug.
- Align/distribute: locked elements filtered then re-checks `els.length < 2`; operates on rotated AABB. Correct.
- Undo seeding (`seededRef`) prevents an empty first-edit undo; vertical-edit + selection reconciliation on restore is handled.

## Unresolved Questions
- Is the 20-step redo cap (I3) intentional? If so, comment must be corrected; if not, raise to 50.
- Should ribbon arrange buttons act on the whole selection (I2)? Confirm intended parity with keyboard.
- Are vertical child slides expected to be searchable by Find & Replace (I1)? If yes this is Important; if children are considered out-of-scope, downgrade.
