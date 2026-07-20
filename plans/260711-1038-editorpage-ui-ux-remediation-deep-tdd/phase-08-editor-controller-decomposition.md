---
phase: 8
title: "Editor Controller Decomposition"
status: complete
priority: P1
effort: "5-7 dev-days"
dependencies: [1, 2, 3, 4, 5, 6, 7]
---

# Phase 8: Editor Controller Decomposition

<!-- Updated: Validation Session 1 - preserve explicit warned force-save and latest-generation authority -->

## Overview

Turn `EditorPage.jsx` into a composition root after behavior has stabilized. Extract controllers by lifecycle and responsibility while preserving the current user-owned generation-safe save, PPTX fidelity, vertical-slide, TipTap, history, command, game, AI and export behavior.

## Requirements

### Functional

- Persistence controller owns load, debounce, queue, retry, generation adoption/conflict and teardown flush.
- Persistence controller rejects stale route-load resolutions through an epoch or AbortController.
- Persistence controller owns the accepted-generation ref used by every queued and future snapshot.
- Active-slide controller owns parent/vertical routing and stale-child reconciliation.
- History controller owns seed, bounded undo/redo and selection reconciliation.
- Rich-text controller owns TipTap synchronization and edit lifecycle.
- Existing `use-keyboard` and `use-clipboard` remain owners. A pure command model only assembles descriptors/callback groups for keyboard, palette and game consumers.
- Existing public helper exports and page props remain stable.

### Non-functional

- `EditorPage.jsx` becomes composition-focused with no persistence, history, TipTap, migration or interaction state machine. Use a realistic measured target of ≤650 LOC and record remaining composition-only debt; every new production module remains below 200 LOC.
- Controllers have one-way dependencies and no component imports.
- Existing specialized hooks remain composed, not replaced without need.
- No markup/CSS change in this phase.
- Extract one controller at a time with a green gate after each.

## Architecture

```text
EditorPage
  -> persistence controller -> API / generation/conflict store / save queue
  -> active-slide controller -> parent/vertical mapping and refs
  -> rich-text controller -> TipTap + active-slide updates
  -> history controller -> active-slide refs + editor bridge
  -> existing element/slide hooks
  -> existing useKeyboard/useClipboard owners
  -> pure command model -> palette / game / callback descriptors
  -> EditorShell composition
```

Dependency direction is one-way. Controllers cannot import `EditorPage` or rendered shell components.

## File Inventory

| Action | File | Planned impact |
|---|---|---:|
| Modify | `client/src/pages/EditorPage.jsx` | Remove 850-1150 controller LOC |
| Modify | Existing EditorPage characterization/lifecycle tests | Boundary and dirty-tree contracts |
| Create | `hooks/editor-controller/use-editor-persistence-controller.js` + test | 180-195 LOC each |
| Create | `use-editor-active-slide-controller.js` + test | 150-180 LOC each |
| Create | `use-editor-history-controller.js` + test | 150-190 LOC each |
| Create | `use-editor-rich-text-controller.js` + test | 170-195 LOC each |
| Create | `use-editor-command-model.js` + test | 120-170 LOC each; no listeners or clipboard execution |
| Create | `utils/editor-presentation-migration.js` + test | 70-120 LOC |
| Delete | None | Existing specialized hooks retained |

## Interfaces To Protect

- Default `EditorPage` export and route props.
- `getElementForActiveSlideEdit`, `getSelectionIdsForActiveSlideElement`, `getGameElementForActiveSlide`.
- Save queue generation/idempotency/conflict behavior from Phase 1.
- Accepted-generation authority from Phase 2 and explicit stale-conflict resolution.
- Parent/vertical active-slide mapping and refs.
- TipTap setting-content guard and PPTX fit metadata invalidation.
- History cap 50, first edit, redo and selection reconciliation.
- Existing `use-element-creation`, `use-slide-operations`, `use-keyboard`, `use-clipboard`, export, AI and game hooks.

## Controller Test Matrix

| Priority | Controller/scenario | Expected |
|---|---|---|
| Critical | Persistence debounce | One PUT after 1.5s burst |
| Critical | In-flight mutation | Exactly one queued successor |
| Critical | Generation conflict | Local snapshot retained; conflict exposed |
| Critical | Route switch/unmount | Pending outgoing save flushes once |
| Critical | Out-of-order route loads | Stale success/error cannot replace active presentation |
| Critical | Active vertical slide | Mutation targets child, never parent |
| Critical | History seed/first edit | Undo disabled on load, enabled after first edit |
| Critical | TipTap programmatic update | No update loop |
| Critical | Command model dispatch | Existing keyboard/clipboard owners invoke one shared callback descriptor |
| High | Undo removes edited element | Editing state exits safely |
| High | Stale child after delete/reorder | Active routing reconciles deterministically |
| High | Listener stability | No growth after rerenders or route changes |
| High | Game/AI/export wiring | Existing characterization suites remain green |
| Medium | Public helper re-export | Existing imports continue without change |
| Medium | Dependency cycle/file size | Static guard passes |

## Tests Before

1. Complete direct RED contracts for each proposed controller.
2. Add generation/idempotency continuity and stale-generation tests if not already covered.
3. Add listener-count and callback-identity tests.
4. Add TipTap-after-undo and vertical reorder/delete edge cases.
5. Add static dependency-direction and new-file-size checks; measure EditorPage responsibility reduction without an impossible absolute target.

## Refactor

Implement sequentially:

1. Extract pure presentation migration helpers.
2. Extract active-slide controller and refs.
3. Extract persistence controller as one atomic save lifecycle.
4. Extract rich-text controller.
5. Extract history controller.
6. Extract a pure command model last; keep listener and clipboard execution in existing hooks.
7. Replace EditorPage blocks with narrow hook composition.
8. Re-export public helpers from their new pure modules.

After each extraction, run its direct tests plus all EditorPage characterization suites.

## Tests After

- Verify controller rerenders do not duplicate window/document listeners.
- Verify callback identities do not send stale IDs or active-slide references.
- Verify no controller imports shell/component modules.
- Verify no new production file exceeds 200 LOC and EditorPage contains only composition/wiring responsibilities.
- Verify no screenshot drift or DOM hierarchy change.

## Implementation Steps

1. Capture current focused diffs and ownership map.
2. Add controller tests and static architecture gates.
3. Extract migration and active-slide logic.
4. Extract persistence with save/conflict gates.
5. Extract TipTap and history with undo/edit gates.
6. Extract palette/game command descriptors while retaining keyboard/clipboard hook ownership.
7. Reduce EditorPage to state assembly and shell composition.
8. Run every characterization, focused E2E and full phase validator.

## Regression Gate

```powershell
npx vitest run client/src/hooks/editor-controller/ client/src/utils/editor-presentation-migration.test.js
npx vitest run client/src/pages/__tests__/editor-page-renderability-spike.test.jsx client/src/pages/__tests__/editor-page-history-autosave.characterization.test.jsx client/src/pages/editor-autosave-lifecycle.test.jsx client/src/pages/__tests__/editor-page-element-ops.characterization.test.jsx client/src/pages/__tests__/editor-page-vertical-slides.test.jsx client/src/pages/__tests__/editor-page-present-wiring.test.jsx client/src/pages/__tests__/editor-page-command-palette-actions.characterization.test.jsx client/src/pages/__tests__/editor-page-ai-generate.characterization.test.jsx
npx playwright test tests/e2e/keyboard-shortcuts.spec.js tests/e2e/undo-redo.spec.js tests/e2e/autosave-flush-on-leave.spec.js --project=chromium
npm run lint
npm run test
npm run build
```

## Success Criteria

- [x] EditorPage contains composition/wiring only, measured target ≤650 LOC; any remaining composition-only excess is documented rather than hidden through arbitrary fragmentation.
- [x] Every new production controller stays below 200 LOC.
- [x] Save, generation, idempotency and teardown behavior remain exact.
- [x] Parent and vertical-child mutations remain correct.
- [x] TipTap, history, keyboard, clipboard, game, AI and export flows retain parity.
- [x] No dependency cycle or listener growth exists.
- [x] No DOM/CSS or visual baseline change occurs.

## Completion Evidence

Completed 2026-07-13. Persistence, active-slide, rich-text, history, command-model, and migration responsibilities are extracted into focused modules; composition and focused characterization gates pass.

## Risk Assessment

- **Dirty EditorPage conflict:** extract from current working tree, never clean `HEAD`.
- **Stale closures:** preserve call-time refs and test route/slide transitions.
- **Out-of-order load:** use epoch/abort checks for both success and error paths.
- **Save loss:** persistence extraction is atomic and independently gated.
- **TipTap loops:** keep programmatic-content suppression in one controller.
- **Arbitrary fragmentation:** split by lifecycle, not line count alone.
- **Command duplication:** build one pure command map while keeping `useKeyboard` and `useClipboard` as execution owners.

## Security And Data Integrity

Persistence controller remains the only generation/conflict authority. Do not log presentation payloads, downgrade stale-generation errors or bypass content normalization.

## Rollback

Land and validate one controller/model at a time. Before each extraction, save a focused diff/ownership manifest and verify a reverse patch against the Phase 1 baseline. Roll back only its import/wiring hunk and new files.

## Next Steps

Phase 9 performs the integrated release gate. No further feature work is allowed before it passes.
