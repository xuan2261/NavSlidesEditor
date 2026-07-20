---
phase: 2
title: "Canonical Zoom And Save Commands"
status: complete
priority: P0
effort: "2-3 dev-days"
dependencies: [1]
---

# Phase 2: Canonical Zoom And Save Commands

<!-- Updated: Validation Session 1 - confirmed warned force-save with latest remote generation -->

## Overview

Eliminate split-brain zoom state and expose one generation-safe manual-save command across every editor surface. This phase fixes correctness before layout refactoring.

## Requirements

### Functional

- `ui-store` is the only zoom source consumed by canvas, status bar, ribbon, keyboard, wheel, and command palette.
- Preserve auto-fit through `userZoomMode`; Fit means remeasure, not force 100%.
- `Ctrl+S` and `Meta+S` invoke the same canonical manual-save callback as Quick Access, File menu, and command palette.
- Transient Retry remains a separate controller path that resubmits the exact rejected snapshot with its original idempotency key.
- Save prevents the browser Save Page action and dispatches exactly once.
- Successful saves update a call-time accepted-generation authority used by idle future edits and queued successors.
- Transient Retry reuses the rejected snapshot and idempotency key through `retryPendingSave`; it never creates a new logical attempt.
- `STALE_GENERATION` exposes explicit Keep Local/Use Remote conflict resolution. Generic Retry is disabled for this failure class.
- Existing debounce and teardown contracts remain intact.

### Non-functional

- No new state library or command framework.
- Reuse `use-keyboard`, shortcut registry, Zustand actions, and the existing queue.
- Preserve stored shortcut IDs and current zoom range `10%-400%`.

## Architecture

```text
Zoom surfaces --------------------> ui-store canonical zoom
  StatusBar / CanvasControls         zoom, setZoom, zoomIn/out, fitZoom
  keyboard / palette / wheel          -> SlideCanvas transform
                                      -> StatusBar percentage

Save surfaces --------------------> EditorPage.handleManualSave
  Ctrl/Meta+S / File / QuickAccess    -> schedule latest logical snapshot
  palette                              -> existing serialized queue

Transient Retry ------------------> retryPendingSave
                                      -> same snapshot + same Idempotency-Key

409 conflict ---------------------> explicit resolution controller/dialog
                                      -> Use Remote: guarded reload
                                      -> Keep Local: fetch current generation,
                                         explicit overwrite confirmation,
                                         new logical attempt/idempotency key
```

## File Inventory

| Action | File | Planned impact |
|---|---|---:|
| Modify | `client/src/stores/editor-store.js` | Remove obsolete zoom state/actions |
| Modify | `client/src/stores/editor-store.test.js` | Remove dead-state expectations |
| Modify | `client/src/stores/ui-store.js` | Canonical zoom constants/actions |
| Modify | `client/src/stores/ui-store.test.js` | Boundaries, fit and manual-mode tests |
| Modify | `client/src/components/ribbon/controls/canvas-controls.jsx` | Consume canonical actions |
| Modify | `client/src/components/layout/StatusBar.jsx` | Preserve canonical status controls |
| Modify | `client/src/pages/EditorPage.jsx` | Stable save callback and canonical commands |
| Modify | `client/src/hooks/use-keyboard.js` and tests | Register save callback and suppression policy |
| Modify | `client/src/utils/default-keyboard-shortcut-definitions-registry.js` | Add `save` |
| Modify | Quick Access and ribbon File menu files/tests | Route all save surfaces to one callback |
| Create | `client/src/components/editor/save-conflict-dialog.jsx` and test | Explicit stale-generation recovery |
| Create | `tests/e2e/editor-command-surfaces.spec.js` | Cross-surface browser contract |
| Delete | None | Remove dead fields by code edit, not file deletion |

## Interfaces To Protect

- `zoom`, `setZoom`, `zoomIn`, `zoomOut`, `fitZoom`, `userZoomMode`.
- `SlideCanvas` ResizeObserver fit behavior.
- Status slider test IDs, range and accessible names.
- Dynamic keyboard callback mapping in `use-keyboard`.
- File menu roving focus, Escape behavior and trigger restoration.
- Save queue functions characterized in Phase 1.
- Actual API contract: `updatePresentation(id, data)` maps `data.idempotencyKey` to the request header.

## Test Scenario Matrix

| Priority | Surface | Assertion |
|---|---|---|
| Critical | Ribbon zoom | Canvas transform and status percentage update together |
| Critical | Keyboard zoom | Same step/clamp/manual mode as status controls |
| Critical | Command palette | Uses canonical action, no dead store mutation |
| Critical | Fit | Clears manual mode and allows next ResizeObserver fit |
| Critical | Ctrl/Meta+S | Prevents default and queues exactly one latest snapshot |
| Critical | Idle sequential saves | Second save uses generation returned by first idle save |
| Critical | Transient Retry | Reuses exact snapshot and idempotency header |
| Critical | Stale conflict | Generic Retry hidden/disabled; explicit resolution preserves or reloads data |
| Critical | All normal save surfaces | Invoke the same manual-save callback; Retry remains a separate recovery command |
| High | Editable focus | Save chord is recognized first, always prevents browser default, then follows explicit modal policy |
| High | File menu Save | Keyboard/pointer activate once, menu closes, focus returns |
| High | Wheel zoom | Shares clamp and manual mode |
| Medium | Shortcut labels | Registry, tooltip and command palette display agree |

## Tests Before

1. Add store tests that expose conflicting current zoom bounds/steps.
2. Add component tests proving ribbon zoom currently fails to affect visible canvas state.
3. Add RED tests for idle sequential generation adoption and retry-key continuity.
4. Add shortcut test proving Save is advertised but unregistered and opens browser behavior under editable focus.
5. Add mounted EditorPage tests asserting one queue entry per normal save surface and a separate retry path.
6. Add stale-conflict resolution tests for both Use Remote and Keep Local.
7. Add E2E checks against the visible canvas/status and actual request body/header, not store internals only.

## Refactor

1. Define canonical zoom constants and actions in `ui-store`.
2. Migrate every consumer.
3. Repository-search for remaining `editor-store` zoom consumers.
4. Remove dead zoom fields/tests only after all consumers are migrated.
5. Add an accepted-generation ref/state update on every successful save and apply it to every future snapshot.
6. Add one stable `handleManualSave` callback for new logical snapshots.
7. Add `retryPendingSave` that drains the rejected queue item without replacing key or content.
8. Add explicit stale-generation resolution UI/protocol; never route it through transient Retry.
9. Register Save before generic editable suppression: always prevent default in editor scope, then run or defer save according to active modal policy.
10. Route File, Quick Access and palette through manual save; route Retry only through retry command.

## Tests After

- Add Fit/ResizeObserver and manual-mode transition coverage.
- Add focus suppression, key-repeat and Meta-key parity.
- Verify no direct API call bypasses the save queue.
- Verify all labels reference the shortcut registry.
- Verify two idle sequential saves and an in-flight successor all use the latest accepted generation.
- Verify the exact body key and `Idempotency-Key` header remain stable across transient retry.
- Verify warned force-save first fetches the latest remote generation, preserves local content, and creates a new logical attempt/key only after explicit confirmation.

## Implementation Steps

1. Freeze Phase 1 tests and record focused diff/ownership manifests for EditorPage and dirty ribbon files.
2. Write RED cross-surface zoom and save tests.
3. Canonicalize zoom in `ui-store`.
4. Migrate canvas controls, EditorPage commands and status interactions.
5. Add the canonical save callback and shortcut.
6. Add transient Retry and stale-conflict resolution.
7. Add File menu Save with existing menu semantics.
8. Remove dead zoom state.
9. Run targeted and full gates.

## Regression Gate

```powershell
npx vitest run client/src/stores/editor-store.test.js client/src/stores/ui-store.test.js client/src/components/layout/StatusBar.test.jsx client/src/components/QuickAccessToolbar.test.jsx client/src/components/ribbon/ribbon-file-dropdown-menu.test.jsx client/src/hooks/use-keyboard-contract.test.js client/src/utils/shortcut-registry-unit-tests-for-lookup-override-merge.test.js client/src/pages/__tests__/editor-page-command-palette-actions.characterization.test.jsx client/src/pages/__tests__/editor-page-history-autosave.characterization.test.jsx
npx playwright test tests/e2e/editor-command-surfaces.spec.js tests/e2e/autosave-flush-on-leave.spec.js tests/e2e/keyboard-shortcuts.spec.js --project=chromium
git diff --check
npm run lint
npm run test
npm run build
```

## Success Criteria

- [x] Repository contains one production zoom state.
- [x] All zoom surfaces update canvas and status synchronously.
- [x] Fit re-enables responsive auto-fit.
- [x] `Ctrl/Meta+S` never opens browser Save Page.
- [x] Every normal save surface dispatches one canonical queued save.
- [x] Transient Retry preserves snapshot, generation and idempotency key.
- [x] Idle future saves use the latest accepted server generation.
- [x] Stale-generation conflicts provide explicit recovery and cannot loop through Retry.
- [x] Save conflict/idempotency/autosave tests from Phase 1 remain green.
- [x] Dirty ribbon/PPTX hunks remain intact.

## Completion Evidence

Completed 2026-07-13. Canonical zoom and save surfaces, accepted-generation adoption, retry continuity, and stale-conflict recovery are implemented and covered by the passing focused editor gates.

## Risk Assessment

- **Fit semantics drift:** test measured fit after resize, not an assumed 100%.
- **Save/autosave race:** never call API directly from manual save.
- **Shortcut conflict in editables/modals:** resolve Save before editable suppression; always prevent native Save Page and test modal policy explicitly.
- **Conflict data loss:** Keep Local requires explicit confirmation, latest remote generation and a new logical attempt/key; Use Remote warns about local replacement.
- **Dirty-file collision:** patch current ribbon and EditorPage content narrowly.

## Security And Data Integrity

Manual save must preserve stale-generation conflict handling and idempotency headers. No payload logging or browser storage additions.

## Rollback

Apply the verified Phase 2 reverse patches for each owned hunk. Do not revert Phase 1 baseline logic or unrelated user-owned diffs.

## Next Steps

Phase 3 may begin only after dead zoom state is removed and all command-surface tests pass.
