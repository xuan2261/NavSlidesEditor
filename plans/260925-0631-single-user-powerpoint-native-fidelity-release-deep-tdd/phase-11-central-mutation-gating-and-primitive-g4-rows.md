---
phase: 11
title: 'Central mutation gating and primitive G4 rows'
description: 'Atomically bind package capability to one client document snapshot, route every actual mutation caller through a fail-closed registry with server authority, and promote only physically manifested plain text, solid fill, basic transform, and whole-image replacement rows.'
status: pending
priority: P0
effort: '8-10 weeks'
issue: null
branch: master
dependencies: [9, 10]
gates: [G4-plain-text, G4-solid-fill, G4-basic-transform, G4-whole-image-replacement]
tags: [frontend, backend, pptx, mutation-policy, native-editability, g4, tdd]
created: 2026-09-25
---

# Phase 11: Central Mutation Gating and Primitive G4 Rows

## Context

- Client mutations currently enter through many handlers: TipTap edits, property panels, canvas pointer gestures, keyboard nudges, clipboard, creation/deletion, grouping, z-order, slide CRUD, and direct presentation updates.
- Server `savePackageProjection()` currently derives a generic journal and can persist unsupported package-backed mutations for later export failure.
- Matrix candidates and adapters exist for text, fill, transform, and image replacement, but only plain text is transaction eligible and none is Level-4 promoted.
- `canonical-shape-fill-journal.js` is separate and lacks the complete matrix/reason authority used by the text journal.
- Primitive adapter unit tests are necessary but insufficient: each row needs client gate, server diff, planner, transaction, native re-import, untouched closure, public-route, and matrix evidence.
- Client document bytes currently live in `EditorPage` local state while `presentation-store.js` can also hold a presentation and was proposed to hold capabilities. Splitting snapshot and capability ownership permits stale capability decisions.
- Phase 10 establishes the canonical physical native-editability manifest. This phase must extend that authority with every positive/negative/R0/R1/native-locator/PowerPoint-expectation file before any primitive row promotion.

## Goal

Create one shared mutation vocabulary and two authoritative enforcement layers:

```text
UI intent
  -> shared registry classification
  -> client gate/disabled state
  -> canonical presentation update
  -> server snapshot diff reclassification
  -> exact row journal
  -> Phase 9 transaction
```

Then promote, one at a time:

1. `primitive.text.run.plain-replacement`
2. `primitive.shape.solid-fill`
3. `primitive.geometry.basic-transform`
4. `primitive.image.whole-replacement`

Each promotion has its own evidence subject and matrix-authority epoch bump. Structural edits remain blocked/deferred.

## Scope

- Shared client/server mutation registry with stable operation IDs and property mappings.
- Central client gate around the authoritative presentation setter and mutation controllers.
- Server-side full snapshot-diff authorization before package-backed save publication.
- Safe capability DTO derived by server; no source refs or package authority sent to client.
- Exact journals/planner dispatch/adapters/native comparators for four primitive rows.
- Independent row qualification and ordered matrix evolution.
- One canonical client document reducer whose state atomically binds presentation snapshot, aggregate generation, package/base revision, matrix/capability subject, and server denial/reload state.
- Exhaustive migration and tests for every actual mutation caller, not only `updateElement`.
- Canonical physical manifest entries and checked-in positive, expected-R1, boundary-negative, and PowerPoint expected-evidence files for all four primitive rows.
- Fail-closed disabled UI plus runtime guard for every mutation surface.
- Audit tests preventing direct package-backed mutation bypass.

## Non-goals

- No slide/element add, delete, duplicate, reorder, group, ungroup, z-order, notes, theme, transition, animation, table, connector, crop, stroke, opacity, shadow, or rich-text promotion.
- No partial rich-text formatting; plain text remains one paragraph/one run only.
- No image crop/type conversion/external URL fetch.
- No chart row; Phase 12 owns charts.
- No family-wide promotion or alias-based capability.
- No client-supplied row/source authority.

## Key Insights

1. Disabling buttons is UX, not authority. Server diff must independently reject unsupported changes.
2. Guarding only `updateElement()` misses clipboard, keyboard, pointer, slide, and modal paths. The final presentation setter needs a package-aware gate.
3. A central registry maps product properties to canonical row/property/operation IDs; the canonical matrix still owns qualification state.
4. Matrix evolution invalidates old journals. Promotion must bump the global epoch and atomically reissue/invalidate live heads.
5. Rows must be promoted sequentially. Later green evidence cannot retroactively qualify an earlier row.
6. Structural edits are especially dangerous because native ID allocation and relationship repair are not closed; block them centrally.
7. Capability is meaningful only for the exact local snapshot that received it. It must never live in an independently updated Zustand field/store.
8. Promotion is a physical-file state transition: unresolved fixture paths, missing negative boundaries, absent expected R1, or incomplete native IDs/parts/relationships make promotion mechanically impossible.

## Requirements

### Shared registry

- Pure module usable by Vite and Node.
- Defines mutation IDs, target kinds, accepted property sets, canonical row/property/operation bindings, and structural classification.
- No matrix qualification booleans duplicated in shared code.
- Unknown intent/property/shape returns `blocked`, never falls through.
- Batch updates are authorized item-by-item; mixed supported/unsupported batch rejects atomically.

### Client gate

- Package-backed status and safe row capabilities come from server DTO/fidelity response.
- `EditorPage` replaces independent `useState(presentation)` plus any duplicate presentation/capability store ownership with one `useReducer` document state:
  - `{ presentation, aggregateGeneration, packageRevisionId, baseRevisionId, matrixSubject, capabilitySubject, capabilities, authorityStatus, denial }`;
  - `ADOPT_SERVER_SNAPSHOT` replaces the entire tuple atomically;
  - `APPLY_LOCAL_MUTATION` classifies against the tuple's exact presentation/capability subject and produces one next tuple;
  - `ADOPT_SAVE_RESULT`, conflict recovery, history restore, and export generation adoption update the tuple atomically or force reload;
  - capability data is never merged independently into a newer/older presentation snapshot.
- `presentation-store.js` may retain save-conflict/loading UI state only; it must not be a second owner of presentation or capability authority.
- One guarded reducer dispatcher computes/classifies before/after mutation.
- Low-level controllers also pass explicit intent for actionable disabled state and reason.
- Non-content UI state—selection, zoom, panels, current slide, live controls—remains unaffected.
- Blocked mutation produces accessible reason/status and no local dirty/autosave state.
- Direct runtime calls, keyboard shortcuts, paste/drop, pointer gestures, and modal commits are blocked even if a control forgot `disabled`.
- A stale/missing tuple subject blocks locally with reload guidance. This is UX only; server reclassification remains the sole authority.

### Server gate

- Canonicalize before/after, classify all differences, and require one or more currently promoted exact rows.
- Never accept client row IDs, capabilities, source refs, matrix subjects, or mutation receipts.
- All operations must bind current source map/head/matrix epoch.
- Mixed supported and unsupported changes reject the entire save.
- Net-zero changes produce no journal and no generation bump unless reconciling an existing pending no-op.
- Save response includes bounded mutation-denial reason and current safe capability subject.
- Server response is authoritative even when it disagrees with local classification. Client discards optimistic local mutation on denial/conflict, retains the last acknowledged server snapshot, and atomically adopts or reloads the returned capability tuple.

### Actual client mutation-caller inventory

Every listed production caller must receive `dispatchDocumentMutation(intent, recipe)` or a narrower guarded command; raw setters are forbidden outside reducer hydration/reset code:

| Surface                  | Exact production files / mutations to migrate and test                                                                                                                                                                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rich text                | `client/src/hooks/editor-controller/use-editor-rich-text-controller.js` TipTap `onUpdate`; plain run allowed only after exact row promotion, marks/multi-run blocked.                                                                                                                             |
| History                  | `client/src/hooks/editor-controller/use-editor-history-controller.js` undo/redo restore; history entries include capability tuple subject or are reclassified against current server tuple; unsupported/stale restoration is blocked/reload-required.                                             |
| AI                       | `client/src/hooks/use-ai-actions.js` generated slides, copywriter, translation, notes; only an exact allowed plain-run copywriter change may pass, structural/notes/multi-element changes remain blocked.                                                                                         |
| Primary modals           | `client/src/components/EditorModals.jsx` history restore, sorter reorder/delete/duplicate, code theme, find-replace, HTML/code/LaTeX/timeline commits.                                                                                                                                            |
| Secondary modals         | `client/src/components/editor-modals-secondary.jsx` custom CSS, template replace/insert, file/media/embed insertion, AI callbacks.                                                                                                                                                                |
| Persistence/recovery     | `client/src/hooks/editor-controller/use-editor-persistence-controller.js`, `use-editor-recovery-controller.js`, `use-editor-save-controller.js`, `client/src/hooks/use-autosave.js`; server hydration is atomic adoption, while draft/conflict restore is classified or reload-required.          |
| Clipboard                | `client/src/hooks/use-clipboard.js` paste/cut/duplicate and `client/src/components/ribbon/controls/clipboard-buttons.jsx`.                                                                                                                                                                        |
| Keyboard                 | `client/src/hooks/editor-controller/use-editor-keyboard-controller.js`, `client/src/hooks/use-keyboard.js`; nudge/delete/group/z-order/duplicate/find-replace commands cannot bypass the reducer.                                                                                                 |
| Canvas                   | `client/src/components/canvas/use-canvas-pointer-interaction.js`, `use-canvas-resize-rotate.js`, `canvas-right-click-context-menu-for-slide-elements.jsx`; drag/resize/rotate may pass exact transform, crop/structure/context actions remain blocked.                                            |
| Core controllers         | `client/src/hooks/editor-controller/use-editor-element-controller.js`, `use-editor-layout-controller.js`, `use-editor-selection-controller.js`, `client/src/hooks/use-slide-operations.js`, `use-element-creation.js`, and direct insert/duplicate handlers in `client/src/pages/EditorPage.jsx`. |
| Properties               | `client/src/components/editor/editor-inspector.jsx`, `client/src/components/properties/shape-properties.jsx`, `image-properties.jsx`, `common-element-controls.jsx`, and chart properties for Phase 12.                                                                                           |
| Ribbon/navigation/chrome | `client/src/components/editor/editor-ribbon.jsx`, `editor-navigator.jsx`, `editor-page-chrome.jsx`, `client/src/components/ribbon/ribbon-format-tab-element-position-size-rotation-controls.jsx`, and text/clipboard contextual controls.                                                         |
| Find/replace             | `client/src/components/FindReplaceBar.jsx`, `client/src/components/find-replace-helpers.js`, and the `EditorModals.jsx` `onUpdatePresentation` bridge; batch replacement is item-classified and atomic.                                                                                           |

The inventory test resolves these exact files, scans the production import graph for mutation sinks (`setPresentation`, store setters, `updateElement(s)`, slide array replacement, and direct presentation assignment), and fails when a new sink is not registered with a guarded test case.

### Ordered row contracts

#### Plain text

- One ordinary text object, one paragraph, one run, literal text replacement only.
- No marks, formatting, field, break, list, hyperlink, paragraph count, geometry, or metadata changes.

#### Solid fill

- Existing ordinary shape with direct solid RGB fill.
- Change only six-digit RGB value.
- No theme/scheme color, alpha, gradient, pattern, stroke, effects, geometry, or group inheritance.

#### Basic transform

- Existing ordinary shape/image native object.
- Exact properties: `x`, `y`, `width`, `height`, `rotation`.
- Finite bounded values; fixed EMU conversion; no flip, crop, connector, group transform, skew, anchor, or z-order.
- A batch may change multiple listed transform properties on one object but remains one row-qualified atomic operation set.

#### Whole-image replacement

- Existing embedded raster image relationship and existing media part.
- Replace bytes only; preserve object XML, relationship ID, crop, transform, effects, alt text, and content type.
- Same allowlisted MIME/content type and bounded byte size.
- No URL, SVG/EMF/WMF, animated image, external relationship, part rename, or relationship creation.

### Canonical physical evidence

- Extend `server/data/test-corpus/native-editability/native-editability-manifest.json`; no phase-local alternative manifest.
- Every promoted primitive row must resolve:
  - one positive R0 and one checked-in expected R1 with exact byte length/SHA-256;
  - at least two physical boundary-negative fixtures covering the closest overbroad property/type boundary;
  - exact slide/object native IDs, object names/types, part URIs, relationship IDs/types/targets, media/content types, dependent parts, and allowed changed-part/relationship closure;
  - fixed requested mutation and expected before/after property values;
  - one `powerpoint-expected.json` describing the later Phase 15 select/edit/save/reopen evidence and unchanged properties. Observed G5 evidence is not required for G4, but the expectation file is mandatory.
- The row qualifier loads files only through `native-editability-manifest.js`, verifies all paths/hashes/locators before server start, imports positive R0 and every negative via public routes, and requires downloaded R1 to equal the declared expected-R1 hash.
- `canonical-feature-matrix.js` promotion accepts a manifest row-entry hash plus physical qualification receipt. Missing/unresolved physical files or mismatched R0/R1 hashes return `PHYSICAL_EVIDENCE_INCOMPLETE`; matrix version/epoch cannot advance.

## Architecture and Data Flow

### Shared classification

`classifyPptxMutation(before, after, registryContext)` returns:

- `no-op`;
- exact ordered intents with registry IDs;
- or `blocked` with canonical safe reason.

It detects structure first, then properties. No heuristic “closest row”.

### Client

- `EditorPage` owns the sole client document-authority reducer.
- `useEditorMutationGate` exposes guarded dispatch and `canMutate(intent)` over that same reducer tuple.
- All editor controllers receive only guarded setters/dispatchers.
- `PptxMutationGateContext` lets panels/ribbon/canvas display disabled states.
- An audit test scans production client mutation modules for raw setter escape hatches.

### Server

- `authorizePackageMutation()` uses the same shared registry vocabulary but server-owned source map and matrix.
- It builds one canonical primitive journal with current matrix/reason subjects.
- `generation-safe-save.js` publishes only authorized pending journals.
- Phase 9 planner/transaction consumes the journal; no route-specific adapter path.

### Promotion

For each row, in exact order:

1. Keep row unpromoted; write RED tests.
2. Complete client/server/journal/planner/adapter/native/public-route evidence.
3. Run physical exact-row qualification.
4. Resolve and hash the canonical manifest entry; fail if any positive/R1/negative/native-locator/PowerPoint-expectation file is absent.
5. Change only that row/catalog binding with the physical row-entry/receipt hash.
6. Increment matrix version/hash and atomically bump `matrixAuthorityEpoch`.
7. Reissue all live heads or invalidate them fail-closed.
8. Run prior-row regression before beginning next row.

## Absolute File Inventory

### Modify

| Absolute path                                                                                                        | Change                                                                                                  |
| -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `C:\Work\NavSlidesEditor\shared\src\index.js`                                                                        | Export shared mutation registry/classifier.                                                             |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\canonical-feature-matrix.js`                                    | Promote exact rows sequentially; version/hash changes per promotion.                                    |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\matrix-catalog-contract.js`                                     | Enforce qualified/promoted registry bindings and no broad aliases.                                      |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\source-map.js`                                                  | Authoritative refs for eligible ordinary shapes and embedded raster pictures.                           |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\transactional-patch-planner.js`                                 | Generic exact-row dispatch; remove seed-only branching.                                                 |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\primitive-adapter-registry.js`                                  | Register four row adapters with exact evidence IDs.                                                     |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\primitive-ooxml-adapters.js`                                    | Enforce row property/type/content constraints and declared impact.                                      |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\native-reimport-comparator.js`                                  | Row-specific semantic comparison inside full Phase 9 proof.                                             |
| `C:\Work\NavSlidesEditor\server\services\generation-safe-save.js`                                                    | Reject unsupported/mixed package mutations before pending publication.                                  |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\package-store\index.js`                                         | Explicit ordered matrix epoch evolution/reissue API.                                                    |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\fidelity-contract.js`                                           | Safe row/property capability DTO; exact matrix subject.                                                 |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\package-store\dto.js`                                           | Emit safe capabilities, strip them on client write.                                                     |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\authority-sanitizer.js`                                         | Reject forged capability/registry fields.                                                               |
| `C:\Work\NavSlidesEditor\server\routes\presentations.js`                                                             | Return typed mutation denials; use server gate for PUT.                                                 |
| `C:\Work\NavSlidesEditor\client\src\pages\EditorPage.jsx`                                                            | Replace split local/store ownership with the canonical document reducer; remove raw setter exposure.    |
| `C:\Work\NavSlidesEditor\client\src\stores\presentation-store.js`                                                    | Remove duplicate presentation/capability authority; retain bounded loading/save-conflict UI state only. |
| `C:\Work\NavSlidesEditor\client\src\hooks\editor-controller\use-editor-rich-text-controller.js`                      | Route TipTap `onUpdate` through exact rich-text intent.                                                 |
| `C:\Work\NavSlidesEditor\client\src\hooks\editor-controller\use-editor-history-controller.js`                        | Guard undo/redo snapshot restoration and stale tuple subjects.                                          |
| `C:\Work\NavSlidesEditor\client\src\hooks\use-ai-actions.js`                                                         | Gate AI generated slides/copywriter/translation/notes mutations.                                        |
| `C:\Work\NavSlidesEditor\client\src\components\EditorModals.jsx`                                                     | Gate restore/reorder/delete/duplicate/theme/find-replace/editor commits.                                |
| `C:\Work\NavSlidesEditor\client\src\components\editor-modals-secondary.jsx`                                          | Gate CSS/template/media/embed/AI modal commits.                                                         |
| `C:\Work\NavSlidesEditor\client\src\hooks\use-ai-actions.test.js`                                                    | Allowed copywriter and blocked structural/translation tests.                                            |
| `C:\Work\NavSlidesEditor\client\src\components\EditorModals.test.jsx`                                                | Restore/reorder/delete/duplicate/theme/find-replace bypass tests.                                       |
| `C:\Work\NavSlidesEditor\client\src\components\content-editor-modals.test.jsx`                                       | Modal content commits use guarded intents.                                                              |
| `C:\Work\NavSlidesEditor\client\src\hooks\editor-controller\use-editor-element-controller.js`                        | Intent-aware update/delete/slide-update entry.                                                          |
| `C:\Work\NavSlidesEditor\client\src\hooks\editor-controller\use-editor-layout-controller.js`                         | Block layout/master structural mutations.                                                               |
| `C:\Work\NavSlidesEditor\client\src\hooks\editor-controller\use-editor-selection-controller.js`                      | Preserve intent through batch and z-order fanout.                                                       |
| `C:\Work\NavSlidesEditor\client\src\hooks\use-slide-operations.js`                                                   | Gate batch geometry and block structural operations.                                                    |
| `C:\Work\NavSlidesEditor\client\src\hooks\use-element-creation.js`                                                   | Gate append/modal commits.                                                                              |
| `C:\Work\NavSlidesEditor\client\src\hooks\use-clipboard.js`                                                          | Gate paste/cut/duplicate.                                                                               |
| `C:\Work\NavSlidesEditor\client\src\hooks\editor-controller\use-editor-keyboard-controller.js`                       | Gate nudge/delete/group/z-order shortcuts.                                                              |
| `C:\Work\NavSlidesEditor\client\src\hooks\use-keyboard.js`                                                           | Route shortcut commands through guarded controller commands.                                            |
| `C:\Work\NavSlidesEditor\client\src\components\canvas\use-canvas-pointer-interaction.js`                             | Gate drag/resize/rotate/crop commits.                                                                   |
| `C:\Work\NavSlidesEditor\client\src\components\canvas\use-canvas-resize-rotate.js`                                   | Preserve exact transform intent and block crop/unsupported geometry.                                    |
| `C:\Work\NavSlidesEditor\client\src\components\canvas\canvas-right-click-context-menu-for-slide-elements.jsx`        | Gate context duplicate/delete/z-order/group actions.                                                    |
| `C:\Work\NavSlidesEditor\client\src\components\editor\editor-inspector.jsx`                                          | Remove direct presentation writes from property bridges.                                                |
| `C:\Work\NavSlidesEditor\client\src\components\editor\editor-ribbon.jsx`                                             | Remove direct presentation writes from ribbon commands.                                                 |
| `C:\Work\NavSlidesEditor\client\src\components\editor\editor-navigator.jsx`                                          | Gate layout/apply/detach and navigator slide mutations.                                                 |
| `C:\Work\NavSlidesEditor\client\src\components\editor\editor-page-chrome.jsx`                                        | Gate presentation title mutation.                                                                       |
| `C:\Work\NavSlidesEditor\client\src\components\FindReplaceBar.jsx`                                                   | Classify replacement batches atomically.                                                                |
| `C:\Work\NavSlidesEditor\client\src\components\find-replace-helpers.js`                                              | Return exact replacement mutation descriptions.                                                         |
| `C:\Work\NavSlidesEditor\client\src\components\properties\shape-properties.jsx`                                      | Property-level fill gating.                                                                             |
| `C:\Work\NavSlidesEditor\client\src\components\properties\image-properties.jsx`                                      | Whole-image replacement gating; crop remains disabled.                                                  |
| `C:\Work\NavSlidesEditor\client\src\components\properties\common-element-controls.jsx`                               | Transform-only capability controls.                                                                     |
| `C:\Work\NavSlidesEditor\client\src\components\ribbon\ribbon-format-tab-element-position-size-rotation-controls.jsx` | Match central transform capability.                                                                     |
| `C:\Work\NavSlidesEditor\client\src\utils\api.js`                                                                    | Preserve typed mutation denial/capability fields.                                                       |
| `C:\Work\NavSlidesEditor\package.json`                                                                               | Add row qualification and mutation-surface audit commands.                                              |
| `C:\Work\NavSlidesEditor\server\data\test-corpus\native-editability\native-editability-manifest.json`                | Add/resolve/promote exact primitive physical row entries.                                               |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\native-editability-manifest.js`                                 | Enforce complete positive/R1/negative/native/PowerPoint file mapping.                                   |

### Create

| Absolute path                                                                                                                              | Purpose                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| `C:\Work\NavSlidesEditor\shared\src\pptx-native-mutation-registry.js`                                                                      | Single shared mutation vocabulary/classifier.                               |
| `C:\Work\NavSlidesEditor\shared\src\pptx-native-mutation-registry.test.js`                                                                 | Unknown/mixed/structural/property classification tests.                     |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\native-mutation-policy.js`                                                            | Server-owned source/matrix authorization.                                   |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\native-mutation-policy.test.js`                                                       | Forgery/mixed/current-epoch tests.                                          |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\canonical-primitive-journal.js`                                                       | One journal builder for four exact rows.                                    |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\canonical-primitive-journal.test.js`                                                  | Independent row and mixed-operation tests.                                  |
| `C:\Work\NavSlidesEditor\client\src\hooks\editor-controller\use-editor-mutation-gate.js`                                                   | Guarded setter, capability checks, accessible denial.                       |
| `C:\Work\NavSlidesEditor\client\src\hooks\editor-controller\editor-document-reducer.js`                                                    | Sole atomic client snapshot/capability/generation owner.                    |
| `C:\Work\NavSlidesEditor\client\src\hooks\editor-controller\editor-document-reducer.test.js`                                               | Atomic adoption, stale subject, history, conflict, and server-denial tests. |
| `C:\Work\NavSlidesEditor\client\src\hooks\editor-controller\use-editor-rich-text-controller.test.js`                                       | TipTap plain-run allow and rich/multi-run block tests.                      |
| `C:\Work\NavSlidesEditor\client\src\hooks\editor-controller\use-editor-history-controller.test.js`                                         | Undo/redo capability binding and blocked restoration tests.                 |
| `C:\Work\NavSlidesEditor\client\src\hooks\editor-controller\use-editor-mutation-gate.test.jsx`                                             | UI/store/hook bypass tests.                                                 |
| `C:\Work\NavSlidesEditor\client\src\utils\pptx-mutation-surface-audit.test.js`                                                             | Static audit of mutation entry points.                                      |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\primitive-row-qualification.test.js`                                                  | Per-row transaction/native/closure evidence.                                |
| `C:\Work\NavSlidesEditor\tests\e2e\pptx-native-primitive-editability.spec.js`                                                              | Public UI/API row scenarios.                                                |
| `C:\Work\NavSlidesEditor\server\data\test-corpus\native-editability\primitive-shape-solid-fill\positive-r0.pptx`                           | Direct solid-RGB positive R0.                                               |
| `C:\Work\NavSlidesEditor\server\data\test-corpus\native-editability\primitive-shape-solid-fill\expected-r1.pptx`                           | Expected fixed-RGB R1.                                                      |
| `C:\Work\NavSlidesEditor\server\data\test-corpus\native-editability\primitive-shape-solid-fill\negative-theme-color.pptx`                  | Theme/scheme-color boundary.                                                |
| `C:\Work\NavSlidesEditor\server\data\test-corpus\native-editability\primitive-shape-solid-fill\negative-gradient-or-alpha.pptx`            | Gradient/alpha boundary.                                                    |
| `C:\Work\NavSlidesEditor\server\data\test-corpus\native-editability\primitive-shape-solid-fill\powerpoint-expected.json`                   | Fill property PowerPoint expectation.                                       |
| `C:\Work\NavSlidesEditor\server\data\test-corpus\native-editability\primitive-geometry-basic-transform\positive-r0.pptx`                   | Ungrouped transform positive R0.                                            |
| `C:\Work\NavSlidesEditor\server\data\test-corpus\native-editability\primitive-geometry-basic-transform\expected-r1.pptx`                   | Expected transform R1.                                                      |
| `C:\Work\NavSlidesEditor\server\data\test-corpus\native-editability\primitive-geometry-basic-transform\negative-flip-or-group.pptx`        | Flip/group boundary.                                                        |
| `C:\Work\NavSlidesEditor\server\data\test-corpus\native-editability\primitive-geometry-basic-transform\negative-crop-or-zorder.pptx`       | Crop/z-order boundary.                                                      |
| `C:\Work\NavSlidesEditor\server\data\test-corpus\native-editability\primitive-geometry-basic-transform\powerpoint-expected.json`           | Transform property PowerPoint expectation.                                  |
| `C:\Work\NavSlidesEditor\server\data\test-corpus\native-editability\primitive-image-whole-replacement\positive-r0.pptx`                    | Embedded raster positive R0.                                                |
| `C:\Work\NavSlidesEditor\server\data\test-corpus\native-editability\primitive-image-whole-replacement\expected-r1.pptx`                    | Expected same-type replacement R1.                                          |
| `C:\Work\NavSlidesEditor\server\data\test-corpus\native-editability\primitive-image-whole-replacement\negative-external-or-svg.pptx`       | External/vector boundary.                                                   |
| `C:\Work\NavSlidesEditor\server\data\test-corpus\native-editability\primitive-image-whole-replacement\negative-shared-or-type-change.pptx` | Shared target/content-type boundary.                                        |
| `C:\Work\NavSlidesEditor\server\data\test-corpus\native-editability\primitive-image-whole-replacement\powerpoint-expected.json`            | Image replacement PowerPoint expectation.                                   |

### Retire after migration

| Absolute path                                                                         | Action                                                                                |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\canonical-plain-text-journal.js` | Fold into canonical primitive journal; keep compatibility export until tests migrate. |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\canonical-shape-fill-journal.js` | Replace with central primitive journal; delete only after all imports/tests move.     |

## RED Tests

### Central gating

1. Raw `setPresentation` from any editor controller mutates a package-backed deck without classification.
2. Keyboard nudge works while transform row is unpromoted.
3. Pointer drag/resize/rotate or property input bypasses gate.
4. Paste, duplicate, delete, group, z-order, slide CRUD, notes/theme/title edits persist.
5. Client forges capabilities/row IDs and enables a blocked control.
6. Server PUT accepts mixed text + title or fill + stroke.
7. Server accepts unknown property because client omitted an intent.
8. Stale matrix epoch journal saves or exports.
9. Presentation snapshot is updated while capability/generation remains from another response, or capability is independently updated while the snapshot remains old.
10. Undo/redo, draft recovery, remote-conflict adoption, save response, or export generation adoption restores only presentation data and leaves a mismatched capability tuple.
11. Any inventoried mutation caller reaches a raw setter/store sink without a registered guarded intent test.

### Row-specific

- Text: bold/multi-run/field/line break/paragraph change rejected.
- Fill: gradient/theme/alpha/stroke/effect/group-inherited fill rejected.
- Transform: NaN/out-of-bounds/flip/crop/z-order/group transform rejected.
- Image: URL, external relation, media type change, crop change, oversized bytes, missing media target rejected.
- Each row: native semantic mismatch, unexpected part drift, stale source hash, and restart replay failure.
- Each row: missing positive/R1/negative/PowerPoint-expectation file, bad hash, wrong native ID/part/relationship, or downloaded R1 mismatch prevents promotion and epoch bump.

## Implementation Steps

1. Define shared registry IDs and exact property/operation bindings; write unknown/mixed/structural RED tests.
2. Add server safe-capability projection from current matrix/head/source map.
3. Implement the canonical editor document reducer and migrate server hydration, save/export adoption, conflicts, history, and recovery before adding controls. Remove presentation/capability authority from Zustand.
4. Add guarded dispatch/context. Keep reducer raw adoption actions private to server hydration/reconciliation.
5. Route every inventoried caller in the table through guarded commands; add static import-graph/sink audit and direct behavioral tests for rich text, undo/redo, AI, both modal modules, persistence, clipboard, keyboard, canvas, properties, ribbon, navigator, chrome, context menu, and find-replace.
6. Add disabled/read-only states to primitive controls while preserving runtime enforcement.
7. Implement server `authorizePackageMutation()` and place it before generation-safe save publication.
8. Build central canonical primitive journal with full matrix/reason authority.
9. Generalize planner dispatch by exact row definition; remove text/fill special-case switch.
10. Harden source-map builders for ordinary shape/picture identity without promoting heuristic refs.
11. Check in and resolve every primitive positive R0, expected R1, boundary negative, exact native locator, and PowerPoint expectation in the canonical manifest.
12. Qualify plain text end-to-end. Require manifest row-entry/R0/R1 hashes, then bump matrix version/hash/epoch and reissue heads.
13. Qualify solid fill independently. Repeat manifest proof, epoch evolution, and all prior regressions.
14. Qualify basic transform independently. Repeat manifest proof, epoch evolution, and all prior regressions.
15. Qualify whole-image replacement independently. Repeat manifest proof, epoch evolution, and all prior regressions.
16. Keep every structural registry entry blocked with explicit deferred reason.
17. Remove legacy journal modules only after import graph and focused tests are clean.
18. Run public route/UI, transaction, physical exact-row, negative-fixture, corpus, lint, unit, and build gates after each promotion.

## Refactor

- One shared registry vocabulary; one server authorization service; one primitive journal; one planner; one transaction.
- Do not put qualification booleans in UI constants.
- Do not expose source refs or adapter IDs as client authority.
- Prefer an intent-aware guarded setter over edits scattered across property components.
- Preserve feature-specific adapters, but require the central registry/planner to reach them.
- Keep files under 200 LOC by splitting registry definitions, diff classifier, and React context if needed.

## GREEN Tests

- Every content mutation surface is either authorized by an exact row or blocked before local state changes.
- Presentation and capability/generation subjects are never independently observable; reducer tests prove atomic tuple adoption across load/save/export/conflict/history/recovery.
- Every inventoried caller is covered by a guarded behavioral test and static sink audit.
- Server independently reaches the same verdict from canonical snapshots.
- Mixed batches fail atomically.
- Each row publishes a valid R1 through Phase 9 and reimports with exact semantics.
- Earlier promoted rows remain green after every later matrix epoch.
- Structural edits remain disabled and server-blocked.
- Forged/stale capabilities have no effect.
- Each row has a distinct evidence receipt and exact matrix subject.
- Each row has resolved positive R0/expected R1/negative/native-locator/PowerPoint-expectation files and downloaded R1 hash equality before promotion.

## Scenario Matrix

| Mutation                           | Before promotion        | After exact promotion                          |
| ---------------------------------- | ----------------------- | ---------------------------------------------- |
| Single plain-run text              | Blocked/unverified      | Allowed only for exact text row.               |
| Shape solid RGB fill               | Blocked                 | Allowed only for direct solid RGB.             |
| Shape x/y/width/height/rotation    | Blocked                 | Allowed within exact transform contract.       |
| Whole embedded raster replacement  | Blocked                 | Allowed with same type/target and byte bounds. |
| Fill + stroke                      | Entire mutation blocked | Still blocked.                                 |
| Transform + crop                   | Entire mutation blocked | Still blocked.                                 |
| Image URL replacement              | Blocked                 | Still blocked.                                 |
| Slide/element structure            | Blocked                 | Deferred.                                      |
| Unknown direct setter              | Blocked and audited     | Blocked and audited.                           |
| Stale capability/matrix epoch      | Reload required         | Reload required.                               |
| Snapshot/capability tuple mismatch | Blocked locally; reload | Server remains authoritative; no save journal. |
| Physical fixture path/hash missing | Candidate only          | Promotion and epoch bump rejected.             |

## Exact Failure Responses

| Boundary                                          | Response                                                                                                                                       |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Local stale/missing capability tuple              | No local mutation/dirty/autosave; accessible `reload-required` denial.                                                                         |
| Server unsupported/mixed/structural diff          | `422` with `{ reasonCode: "NATIVE_MUTATION_BLOCKED", reasonCodes, reasonCodeSubject, capabilitySubject }`; no pending journal/generation bump. |
| Server stale generation/matrix/capability subject | `409` with `STALE_GENERATION` or `STALE_MATRIX_AUTHORITY`; current safe tuple subject included, client atomically reloads/adopts.              |
| Forged client capability/row/source fields        | `400`/`422` registered authority-sanitizer reason; fields never influence authorization.                                                       |
| Missing/unresolved physical evidence              | Qualifier non-zero and promotion API/test returns `PHYSICAL_EVIDENCE_INCOMPLETE`; matrix/epoch unchanged.                                      |
| Expected R1 hash mismatch                         | `PHYSICAL_R1_HASH_MISMATCH`; row remains unpromoted.                                                                                           |

## Regression Commands

```powershell
npx vitest run shared/src/pptx-native-mutation-registry.test.js
npx vitest run client/src/hooks/editor-controller/editor-document-reducer.test.js client/src/hooks/editor-controller/use-editor-mutation-gate.test.jsx client/src/utils/pptx-mutation-surface-audit.test.js
npx vitest run client/src/hooks/editor-controller/use-editor-rich-text-controller.test.js client/src/hooks/editor-controller/use-editor-history-controller.test.js client/src/hooks/use-ai-actions.test.js client/src/components/EditorModals.test.jsx client/src/components/content-editor-modals.test.jsx
npx vitest run client/src/hooks/editor-controller/use-editor-persistence-controller.test.jsx client/src/hooks/use-clipboard.test.js client/src/hooks/editor-controller/use-editor-keyboard-controller.test.js client/src/hooks/use-keyboard.test.js
npx vitest run client/src/hooks/use-slide-operations.test.js client/src/hooks/use-clipboard.test.js client/src/components/canvas/use-canvas-pointer-interaction.test.js
npx vitest run client/src/components/canvas/use-canvas-resize-rotate.deep.test.js client/src/components/canvas/canvas-right-click-context-menu-for-slide-elements.test.jsx client/src/components/PropertiesPanel.test.jsx client/src/components/ribbon/ribbon-multiselect-arrange-geometry.test.jsx
npx vitest run server/services/pptx-import/native-editability-manifest.test.js
npx vitest run server/services/pptx-import/native-mutation-policy.test.js server/services/pptx-import/canonical-primitive-journal.test.js
npx vitest run server/services/pptx-import/transactional-patch.test.js server/services/pptx-import/primitive-ooxml-adapters.test.js server/services/pptx-import/primitive-row-qualification.test.js
npx vitest run server/services/generation-safe-save.test.js server/routes/presentations.test.js
npx playwright test tests/e2e/pptx-native-primitive-editability.spec.js --project=chromium --workers=1
npm run test:pptx:g2:physical
npm run test:pptx:importer-qualification
npm run test:pptx:package:no-officecli
npm run lint
npm run test
npm run build
```

Run the exact row qualifier after each promotion, not once after all rows:

```powershell
npm run test:pptx:g4:primitive -- --row primitive.text.run.plain-replacement
npm run test:pptx:g4:primitive -- --row primitive.shape.solid-fill
npm run test:pptx:g4:primitive -- --row primitive.geometry.basic-transform
npm run test:pptx:g4:primitive -- --row primitive.image.whole-replacement
```

## Todos

- [ ] Create shared mutation registry and tests.
- [ ] Add guarded client setter/context and mutation-surface audit.
- [ ] Replace split client presentation/capability authority with one atomic document reducer.
- [ ] Migrate and test every actual rich-text/history/AI/modal/persistence/clipboard/keyboard/canvas/properties/ribbon/context/find-replace caller.
- [ ] Add server snapshot-diff authorization.
- [ ] Consolidate primitive journals/planner dispatch.
- [ ] Promote plain text and bump matrix epoch.
- [ ] Promote solid fill and bump matrix epoch.
- [ ] Promote basic transform and bump matrix epoch.
- [ ] Promote whole-image replacement and bump matrix epoch.
- [ ] Resolve positive R0, expected R1, boundary negatives, native IDs/parts/relationships, and PowerPoint expectation for every promoted row.
- [ ] Prove structural edits remain blocked.
- [ ] Run full regressions after every promotion.

## Success Criteria

- [ ] No package-backed presentation mutation bypasses the central client gate or server authority gate.
- [ ] Client presentation, generation, package revision, matrix subject, capability subject, and capabilities are atomically bound in one canonical reducer; no duplicate store authority exists.
- [ ] Unknown, mixed, structural, stale, or forged mutations fail closed.
- [ ] Four primitive rows are promoted only in required order and each has independent evidence.
- [ ] No row promotion is possible unless every canonical physical file resolves and its exact R0/R1 hash/native locator/negative/PowerPoint expectation validates.
- [ ] Every promotion changes canonical matrix subject and advances durable matrix authority epoch without regression.
- [ ] Prior row evidence stays valid only for its historical subject; current heads bind current authority.
- [ ] Structural edits remain deferred and unavailable.
- [ ] No duplicate mutation/transaction engine is introduced.

## Risks, Signals, Responses

| Risk                                   | Signal                                    | Response                                                                                       |
| -------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------- |
| UI bypass remains                      | Static audit finds raw setter/write       | Fail CI; route through guarded dispatcher.                                                     |
| Shared/server classifiers diverge      | Same diff gets different row              | Shared vocabulary plus server-only authority tests; server verdict wins.                       |
| Matrix epoch churn strands heads       | Heads retain old epoch                    | Atomic global reissue or explicit invalidation before release.                                 |
| Overbroad transform row                | Flip/crop/group tests pass unexpectedly   | Exact property allowlist and row fixture.                                                      |
| Image replacement corrupts shared part | Multiple refs to same media               | Require unshared target for first row or prove all references intentionally share replacement. |
| Client capability leaks authority      | DTO contains source/hash/path             | DTO schema test and sanitizer rejection.                                                       |
| Split client authority reappears       | Snapshot and capability update separately | Reducer-only ownership, store contract test, and raw-setter audit fail CI.                     |
| Mutation surface omitted               | New direct setter/import-graph sink       | Exact caller registry plus static sink audit and required behavioral test.                     |
| Metadata claims physical evidence      | Matrix row points to missing fixture      | Manifest loader resolves/hash-checks all files before promotion transaction.                   |

## Security

- Server never trusts client capability, row, adapter, source, or matrix fields.
- Image replacement accepts uploaded/decoded bounded bytes only; no network fetch.
- Validate MIME by bytes and existing content type, not filename.
- Reject accessor/prototype-polluted mutation objects through plain-data parsing.
- Bound diff cost, batch size, strings, image bytes, and operation count before canonicalization.
- Keep active content security preflight from Phase 9 mandatory for every row.

## Dependencies and Next

- Requires physical G2 closure from Phase 10 and Phase 9 transaction durability.
- Phase 12 consumes the same central registry/gate for one chart property row.
- Phase 13 can unify reconstructed export parity but must not bypass native mutation gating.
- Phase 15 supplies G5 evidence; it does not change G4 authorization.
