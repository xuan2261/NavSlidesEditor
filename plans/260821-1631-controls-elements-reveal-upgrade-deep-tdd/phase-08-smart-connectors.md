---
title: "Phase 08: Smart Connector Metadata and Geometry"
status: completed
---

# Phase 08: Smart Connector Metadata and Geometry

## Goal

Extend the existing `line` element with same-slide endpoint attachments that follow target geometry, preserve editor transaction invariants, and flatten predictably for exports.

## Dependencies

- Phase 04 canonical property ownership, keyboard ownership, and one-transaction update path.

## Canonical Files

- `shared/src/types/presentation.js`
- `client/src/data/element-defaults.js`, `client/src/utils/editor-presentation-migration.js`
- Recommended shared pure geometry module: `shared/src/connector-geometry.js` (client reuses it; no React/DOM dependency)
- `client/src/components/canvas/element-renderers/line-element-renderer.jsx`
- `client/src/components/canvas/canvas-element-wrapper.jsx`
- `client/src/components/canvas/use-canvas-pointer-interaction.js`
- `client/src/utils/element-update-fanout.js`
- `client/src/hooks/editor-controller/use-editor-element-controller.js`
- `client/src/components/properties/shape-properties.jsx`
- `client/src/utils/export-pptx-basic-renderers.js`, `client/src/utils/exportPptx.js`, `client/src/utils/offlineExport.js`
- Focused geometry/controller/renderer/export/browser tests

## Data Contract

Extend `line` with:

```js
connections?: {
  start?: { targetId: string, anchor: 'center'|'n'|'ne'|'e'|'se'|'s'|'sw'|'w'|'nw' },
  end?:   { targetId: string, anchor: 'center'|'n'|'ne'|'e'|'se'|'s'|'sw'|'w'|'nw' }
}
```

- Persist IDs and anchor names only. `x1/y1/x2/y2` remain finite last-resolved fallback coordinates.
- Targets are other renderable elements on the same slide. Reject self, missing/cross-slide references, and connector-to-connector targets in this bounded phase.
- Anchors derive from target bounds plus rotation; non-shape elements expose rectangular anchors. Existing `cx/cy` curve control remains independent and receives no auto-routing.
- Target move/resize/rotate computes dependent line endpoint patches once from the post-mutation slide snapshot and commits them in the same history/autosave transaction.
- Target deletion detaches the endpoint and retains its last resolved coordinates. Connector deletion affects no target.
- Duplicate remaps target IDs only when both connector and target are duplicated in the same operation; otherwise external same-slide targets remain referenced.

## RED

- [x] Pure geometry tests for every anchor, rotation, resize, group transform, finite fallback, invalid references, self/connector targets, and O(E+C) indexed resolution.
- [x] Renderer tests for attached/free/missing-target endpoints, arrows, dash, curve compatibility, deterministic marker IDs, and accessible connected-state description.
- [x] Controller tests prove move/resize/rotate/group batch updates target plus dependents in one state/history/autosave mutation with no recursive callbacks.
- [x] Delete, duplicate, copy/paste, group/ungroup, lock, hidden target, vertical child, undo/redo, reload, and malformed migration tests.
- [x] Properties tests for start/end target and anchor selectors, attach/detach, missing-target status, unique labels, keyboard operation, and connector lock.
- [x] PPTX tests flatten resolved straight endpoints to native lines with arrows/dash and emit an explicit note that live attachment semantics are not preserved.
- [x] Offline HTML resolves from persisted JSON without editor state.

## GREEN

- [x] Implement one shared pure resolver that builds an element ID index once and returns derived endpoint patches/effective lines.
- [x] Normalize connection metadata on load; preserve free fallback coordinates when dropping invalid refs.
- [x] Integrate dependency fan-out at the controller transaction boundary. Pointer preview may derive ephemeral endpoints but commits once on pointerup.
- [x] Add bounded attachment controls to existing line Properties/Format surfaces; no new Insert gallery item/type.
- [x] Use the resolver in canvas, shared HTML, offline, and PPTX paths so geometry cannot drift.
- [x] Surface a non-blocking `Target unavailable` state rather than throwing.

## REFACTOR

- [x] Remove renderer-local anchor math and duplicated lookup loops.
- [x] Keep complexity O(E+C) per committed slide batch; no per-frame global React writes.
- [x] Explicitly exclude graph routing, collision avoidance, arbitrary path anchors, cross-slide links, collaboration conflict semantics, and editable PPTX attachment metadata.

## Focused Verification

```bash
npm test -- shared/src/connector-geometry.test.js client/src/components/canvas/element-renderers/line-element-renderer.test.jsx
npm test -- client/src/utils/element-update-fanout.test.js client/src/hooks/editor-controller/use-editor-element-controller.test.jsx
npm test -- client/src/components/properties/shape-properties.test.jsx client/src/utils/exportPptx.test.js client/src/utils/offlineExport.test.js
```

Browser smoke: attach both endpoints, move/resize/rotate/group target, undo/redo, duplicate subsets/full set, delete target, reload/autosave, edit a vertical child, and inspect PPTX/offline output.

## Success Criteria

- [x] Attached endpoints follow target geometry during preview and committed state.
- [x] One user mutation produces one history/autosave transaction including derived connector patches.
- [x] Missing/deleted targets fall back without crash or coordinate loss.
- [x] Duplicate/group/lock/vertical-child behavior matches the contract.
- [x] Canvas, Reveal/offline, and PPTX use identical resolved endpoints.
- [x] No new element type or auto-routing subsystem exists.

## Risks / Rollback

- Recursive update fan-out can loop or multiply history entries. Only the controller computes one derived batch; renderers remain pure.
- Rotation/group coordinate spaces are the highest geometry risk. Keep normalized anchors and test transformed bounds directly.
- Rollback treats connections as inert metadata and renders persisted fallback coordinates; preserve metadata on round-trip.