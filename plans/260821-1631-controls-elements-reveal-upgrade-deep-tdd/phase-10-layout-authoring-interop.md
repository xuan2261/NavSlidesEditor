---
title: "Phase 10: Slide Master/Layout Authoring and Interop"
status: completed
---

# Phase 10: Slide Master/Layout Authoring and Interop

## Goal

Expose bounded master/layout creation and slide application workflows, then route canvas, Reveal/offline, and PPTX through the Phase 09 resolver.

## Dependencies

- Phase 05 semantic controls.
- Phase 09 schema, adapter, commands, and resolver.

## Canonical Files

- `client/src/components/TemplatePickerModal.jsx`
- `client/src/components/SlidePanel.jsx`
- `client/src/components/ribbon/design-tab-content.jsx`
- `client/src/components/editor/editor-inspector.jsx`
- `client/src/components/SlideCanvas.jsx`
- `client/src/pages/EditorPage.jsx` and editor controller state for master-edit context
- Recommended new bounded surface: `client/src/components/LayoutManagerModal.jsx`
- `shared/src/htmlGenerator.js`, `shared/src/element-renderers.js`
- `client/src/utils/offlineExport.js`, `client/src/utils/exportPptx.js`
- `server/services/pptx-import/mapper/map-presentation.js`
- Component/shared/export/import/E2E tests

## Authoring Contract

- Design tab opens one Layout Manager. Users can create a blank custom master, duplicate a system/custom layout, rename custom layouts, and delete an unused custom layout or choose an explicit replacement for linked slides.
- Built-in system layouts are read-only; duplicate before editing.
- Dedicated master-edit mode reuses the canvas/controllers with an explicit context. Master fixed elements and placeholders are editable there, never in normal slide mode.
- Master mode supports existing element insertion/editing for fixed elements plus bounded placeholder creation for the Phase 09 roles. It does not add a separate element registry.
- Slide UI offers Apply layout, Change layout with preserve-content preview, and Detach layout. Current template insertion remains a separate materialized-slide action.
- Design Ideas invokes the same `changeLayout` command rather than mutating text geometry independently.
- Safe area is shown as an authoring guide and warning boundary, not hard clipping.

## Render/Interop Contract

- `SlideCanvas`, Reveal HTML, vertical children, share/preview/offline, and PPTX all call the same effective-slide resolver before sorting/rendering.
- Fixed master elements are visible but non-selectable in normal slide mode; placeholders bind to slide-owned elements and remain editable.
- PPTX export flattens resolved elements into ordinary objects. Do not claim native PowerPoint master preservation.
- PPTX import remains flattened with `layoutId` absent. Preserve relevant imported placeholder metadata only where already available; do not synthesize masters.
- User deck templates may contain `layoutMasters` as part of the presentation, but template catalog semantics remain distinct from the built-in layout adapter.

## RED

- [x] Layout Manager tests for create/duplicate/rename/delete/replace, duplicate names, system-layout immutability, dialog focus, keyboard operation, and limits.
- [x] Master-edit context tests prove writes target the master definition, normal slide selection cannot mutate fixed elements, and exit restores prior slide/focus.
- [x] TemplatePicker/Design/SlidePanel tests distinguish Insert template from Apply/Change/Detach layout and expose linked/detached state accessibly.
- [x] Preserve-content preview tests cover title/body/image role matching, unmatched content retention, cancel, undo/redo, locks, autosave, and vertical children.
- [x] Canvas/shared HTML tests render identical effective IDs/order/geometry/tokens and exclude hidden overrides.
- [x] Offline export works with layout registry and no editor state/network.
- [x] PPTX package tests prove flattened master fixed/placeholder/slide-owned elements and deterministic warnings; import tests prove no false native-master claim.
- [x] End-to-end test creates a custom master, applies it to parent/child slides, edits master and sees linked updates, detaches one slide, reloads, presents, and exports.

## GREEN

- [x] Implement one Layout Manager and master-edit state; reuse existing UI primitives, element factory, Properties, Format, history, and autosave boundaries.
- [x] Route apply/change/detach and Design Ideas through Phase 09 pure commands.
- [x] Pass effective slide context into canvas rendering while keeping persisted slide/master objects separate.
- [x] Resolve effective slides centrally in `htmlGenerator` for parent and vertical child sections.
- [x] Resolve before PPTX render dispatch; add one matrix capability row for linked layout flattening.
- [x] Keep import flattened and emit provenance/limitation notes where native masters were present but unsupported.

## REFACTOR

- [x] Remove layout-specific geometry mutation from Design Ideas after migration.
- [x] Avoid a second canvas/editor implementation for master mode; differences are explicit capability/ownership rules.
- [x] No automatic rebasing, cross-deck linked packages, arbitrary constraints, or PowerPoint-native hierarchy in this delivery.

## Focused Verification

```bash
npm test -- client/src/components/LayoutManagerModal.test.jsx client/src/components/TemplatePickerModal.test.jsx client/src/components/SlidePanel.test.jsx
npm test -- client/src/components/SlideCanvas.test.jsx shared/tests/htmlGenerator.test.js shared/tests/element-renderers.test.js
npm test -- client/src/utils/offlineExport.test.js client/src/utils/exportPptx.test.js server/services/pptx-import/mapper/map-presentation.test.js
```

Browser smoke must use the real editor and presentation surfaces for the complete custom-master/apply/edit/detach/reload/export workflow.

## Success Criteria

- [x] Users can create/edit custom masters and safely apply/change/detach layouts.
- [x] System layouts remain read-only and derive from the existing template source.
- [x] Linked master edits update every linked slide except explicit overrides/detached slides.
- [x] Canvas, Reveal/offline, and PPTX flattening render the same effective content.
- [x] Vertical child slides, duplicate, undo/redo, locks, autosave, and reload preserve references correctly.
- [x] Import/export limitations are explicit and tested.

## Risks / Rollback

- Reusing normal slide controllers in master mode can write to the wrong owner. Require explicit editing context and ownership tests at every write boundary.
- Deleting a linked master can orphan slides. Block deletion until replacement/detach is chosen transactionally.
- Rollback keeps decks readable by rendering slide-owned content; preserve master metadata so a later forward version can recover it.