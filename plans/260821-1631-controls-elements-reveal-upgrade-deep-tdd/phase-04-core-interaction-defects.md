---
title: "Phase 04: Core Interaction and Fan-Out Defects"
status: completed
---

# Phase 04: Core Interaction and Fan-Out Defects

## Goal

Repair the currently source-proven editor defects before new controls depend on the same keyboard, selection, lock, and update fan-out paths.

## Dependencies

- Phase 01 RED characterizations.

## Canonical Files

- `client/src/components/SlideCanvas.jsx`
- `client/src/utils/element-update-fanout.js`
- `client/src/data/element-defaults.js`
- `client/src/utils/element-factory.js`
- `client/src/components/canvas/use-canvas-pointer-interaction.js`
- `client/src/hooks/editor-controller/use-editor-element-controller.js`
- Focused tests beside those modules

## Contracts

### ELC-001: keyboard ownership

- Delete/Backspace may delete selected canvas elements only when the canvas/editor owns the keystroke.
- Inputs, textareas, selects, contenteditable regions, dialogs/popovers, media controls, and nested interactive controls retain native behavior.
- Escape behavior remains scoped to the active interaction layer.

### ELC-005: supported property fan-out

- A type-supported property update must work on a freshly created element even when the property is optional and absent in imported legacy data.
- Support is defined by one canonical type property contract/default schema, not by `hasOwnProperty` on the current instance.
- Multi-selection writes only to compatible unlocked elements; geometry delta semantics and slide/group locks remain unchanged.

### Interaction invariants reused by connectors/layouts

- Batch-derived updates commit through one `updateElements` transaction and one history/autosave entry.
- A zero-motion pointer sequence remains a click; a completed marquee suppresses only its compatibility click.
- Current behavior is changed only where Phase 01 proves a failing contract; stale historical audit findings are not reintroduced without reproduction.

## RED

- [x] Focus `select`, range, button, contenteditable, media controls, and PromptPopover input; Delete/Backspace must not call element deletion.
- [x] Focus canvas with an unlocked selection; Delete and Backspace must call deletion once. Locked slide/element remains unchanged.
- [x] Create every affected fresh type and update each supported optional field from Properties/Format; assert persisted state, not only callback arguments.
- [x] Mixed compatible/incompatible multi-selection updates only compatible elements and preserves group/lock rules.
- [x] Add pointer regressions only for any current reproduced zero-motion/marquee failures found by the Phase 01 harness.

## GREEN

- [x] Replace tag-name-only keyboard guards with a shared `isEditableOrInteractiveTarget` helper that handles semantic and ARIA/contenteditable controls.
- [x] Move element property ownership to canonical per-type metadata derived from/next to `ELEMENT_DEFAULTS`; add explicit defaults for every currently authored property where a real default exists.
- [x] Make `buildSelectionUpdates` consult the canonical ownership contract and keep its existing mixed-value and geometry-delta behavior.
- [x] Route any proven pointer fix through the existing interaction state machine; do not add click-specific exceptions in renderers.
- [x] Preserve current data-testid values and public controller signatures unless a tested API migration covers every caller.

## REFACTOR

- [x] Remove duplicate keyboard target predicates from canvas/hooks after all callers use the shared helper.
- [x] Add a consistency test ensuring Properties/Format authored keys are owned by the matching canonical type.
- [x] Delete dead optional-property special cases replaced by the canonical ownership table.

## Focused Verification

```bash
npm test -- client/src/components/SlideCanvas.test.jsx client/src/utils/element-update-fanout.test.js
npm test -- client/src/components/canvas/use-canvas-pointer-interaction.test.js client/src/hooks/editor-controller/use-editor-element-controller.test.jsx
```

## Success Criteria

- [x] SELECT/input/contenteditable/media keystrokes never delete canvas elements.
- [x] Canvas-owned Delete/Backspace still works once and honors locks.
- [x] Every currently exposed Properties/Format field persists on fresh and legacy elements.
- [x] Multi-select fan-out remains type-safe and one-transaction.
- [x] No new element type or parallel update path is introduced.

## Risks / Rollback

- A broad interactive-target guard can suppress legitimate canvas shortcuts when focus sits on non-editable wrappers. Test positive canvas ownership as strongly as negative cases.
- Adding defaults can change serialized output. Prefer semantic defaults matching existing render/UI fallback and migration tests; use ownership metadata without materialization when serialization stability requires it.
- Roll back at the shared helper/ownership boundary, not with per-control exceptions.