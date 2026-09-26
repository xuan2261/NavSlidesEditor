---
title: 'Phase 14: Module Decomposition and Registry Cleanup'
description: 'Characterize and decompose four oversized modules without behavior change, while generating shared element-type coverage from canonical ELEMENT_DEFAULTS.'
status: pending
priority: P1
effort: 8d
issue: null
branch: master
phase: 14
dependencies: [13]
tags: [refactor, frontend, backend, socket, registry, tdd]
created: 2026-09-25
---

# Phase 14: Module Decomposition and Registry Cleanup

## Context

- `server/routes/presentations.js` is about 1,387 LOC.
- `server/routes/pptx-import.js` is about 894 LOC.
- `client/src/pages/HomePage.jsx` is about 2,017 LOC.
- `server/services/socket-handler.js` is about 614 LOC.
- `client/src/data/element-defaults.js` and `Object.keys(ELEMENT_DEFAULTS)` remain the repository-canonical element-type source. Server schemas and renderer/export coverage currently maintain separate lists. `divider` is a legacy line preset, not a canonical type.
- This phase runs after Phase 13 and before Phase 15. PowerPoint artifact evidence must exercise the characterized post-decomposition code, not be invalidated by a later module move.

## Goal

Preserve all public behavior while extracting focused modules, generate a mechanically verified shared coverage descriptor from canonical `ELEMENT_DEFAULTS`, and remove only state/hooks proven unreachable by characterization tests plus static usage checks.

## Scope / Non-Goals

### In scope

- Route registration decomposition with identical paths, order, middleware, status, headers, reason codes, and side effects.
- Home dashboard state/controller/component decomposition with identical UI and accessibility.
- Socket event-family decomposition with identical event names, payloads, authorization, ordering, and timers.
- Generated immutable shared coverage descriptor for the 19 canonical element types plus explicit legacy aliases. Generation reads `Object.keys(ELEMENT_DEFAULTS)`; it does not replace canonical ownership.
- Coverage tests for defaults, schemas, canvas rendering classes, PPTX policy, and audit matrix.
- Removal of proven dead local declarations/state/hooks.

### Non-goals

- No API redesign.
- No state-management migration or new framework.
- No visual redesign.
- No new element type.
- No socket protocol change.
- No package authority, import, export, or fidelity behavior change.
- No schema widening/narrowing, warning change, route/event reorder, visual change, performance-policy change, registry-ownership transfer, or PowerPoint evidence generation.
- No “cleanup” based only on lint warnings or intuition.

## Key Insights

- Route order is behavior. `/trash/list` and `/raster-elements` must remain before `/:id`.
- Dependency injection/export seams in `pptx-import.js` are test contracts. Preserve them through compatibility exports.
- Socket handler extraction must share one per-connection context; independently created maps/timers would break authority.
- The canvas registry is intentionally partial because some element types use inline/generic render paths. Coverage needs an explicit classification, not a forced dedicated component.
- Dead code deletion needs three proofs: no production references, no dynamic registry/string reference, and passing focused/full tests.
- A shared descriptor is a generated verification projection, not a new source of truth. Its header records the canonical source path and source hash; CI fails when regeneration would produce a diff.
- Phase 13 shared export IR remains the sole export-planning owner. Decomposition may move adapters/facades only; copied or re-derived planner logic is a blocking behavior change.

## Requirements

### Behavior preservation

1. Capture route manifest before extraction: method, path, middleware count/order, handler owner.
2. Capture representative HTTP snapshots for success/error headers and bodies.
3. Capture socket event manifest and event transcript fixtures.
4. Capture HomePage interaction/a11y screenshots and state transitions.
5. Existing tests remain unchanged first; add characterization tests before moving code.
6. Compatibility import/export paths remain valid during migration.
7. Capture Phase 13 planner entry points and canonical plan snapshots; prove every export path still enters the shared IR exactly once after decomposition.
8. Every extraction is move-only until the complete characterization suite is green. No opportunistic algorithm, validation, error, timing, or UX rewrite.

### File boundaries

- New files target `<200` LOC where practical.
- Composition files may exceed 200 only with documented reason and no embedded domain logic.
- No circular dependency between route modules, socket event modules, or HomePage controllers/components.
- Generated shared coverage data contains no React, Express, DOM, filesystem, or Socket.IO dependency.

### Element types

- Exactly 19 canonical base types.
- `divider` maps explicitly to `line` as a legacy alias and is never counted.
- Plugin types remain dynamic `plugin:<slug>` and are not inserted into the base list.
- `Object.keys(ELEMENT_DEFAULTS)` is canonical. No shared or server module may become a competing hand-edited owner.
- A deterministic generator emits the shared coverage descriptor from canonical keys plus explicit accepted legacy aliases.
- Server Zod schemas derive from the generated descriptor plus explicit accepted legacy aliases.
- Every type has declared canvas rendering mode and PPTX export strategy.
- Generation and verification fail on duplicate keys, unstable order, unknown aliases, source-hash mismatch, hand edits, or a stale generated descriptor.

## Architecture

### Presentations routes

```text
presentations.js (router composition)
  -> presentations-collection-routes
  -> presentations-package-routes
  -> presentations-lifecycle-routes
  -> presentations-output-routes
  -> presentations-upload-routes
  -> shared route helpers/dependencies
```

### PPTX import routes

```text
pptx-import.js (compatibility facade)
  -> pptx-upload-admission
  -> pptx-import-runner
  -> pptx-import-job-view
  -> pptx-import-capability
  -> pptx-import-route-registration
```

### HomePage

```text
HomePage.jsx (compatibility export)
  -> home/home-page.jsx
     -> dashboard controller hooks
     -> import controller hooks
     -> focused view components
     -> constants/pure selectors
```

### Socket handler

```text
socket-handler.js (setup facade)
  -> create connection context
  -> register join/presentation handlers
  -> register navigation/pointer handlers
  -> register annotation handlers
  -> register timer handlers
  -> register disconnect handler
```

### Canonical type coverage

```text
client ELEMENT_DEFAULTS keys (repository canonical)
  -> deterministic generator + source hash
  -> shared generated coverage descriptor
  -> server Zod enum
  -> canvas rendering-mode registry
  -> PPTX strategy coverage
  -> feature/audit coverage checks
```

## Absolute File Inventory

### Create — generated shared element coverage

- `C:\Work\NavSlidesEditor\scripts\generate-element-type-coverage.js`
- `C:\Work\NavSlidesEditor\shared\src\generated\element-type-coverage.js`
- `C:\Work\NavSlidesEditor\shared\tests\element-types.test.js`
- `C:\Work\NavSlidesEditor\scripts\generate-element-type-coverage.test.js`
- `C:\Work\NavSlidesEditor\client\src\components\canvas\element-renderers\element-rendering-modes.js`
- `C:\Work\NavSlidesEditor\client\src\components\canvas\element-renderers\element-rendering-modes.test.js`

### Create — presentations route decomposition

- `C:\Work\NavSlidesEditor\server\routes\presentations-route-context.js`
- `C:\Work\NavSlidesEditor\server\routes\presentations-collection-routes.js`
- `C:\Work\NavSlidesEditor\server\routes\presentations-package-routes.js`
- `C:\Work\NavSlidesEditor\server\routes\presentations-lifecycle-routes.js`
- `C:\Work\NavSlidesEditor\server\routes\presentations-output-routes.js`
- `C:\Work\NavSlidesEditor\server\routes\presentations-upload-routes.js`
- `C:\Work\NavSlidesEditor\server\routes\presentations-route-manifest.test.js`

### Create — PPTX import route decomposition

- `C:\Work\NavSlidesEditor\server\routes\pptx-import-upload-admission.js`
- `C:\Work\NavSlidesEditor\server\routes\pptx-import-runner.js`
- `C:\Work\NavSlidesEditor\server\routes\pptx-import-job-view.js`
- `C:\Work\NavSlidesEditor\server\routes\pptx-import-capability.js`
- `C:\Work\NavSlidesEditor\server\routes\pptx-import-route-registration.js`
- `C:\Work\NavSlidesEditor\server\routes\pptx-import-route-manifest.test.js`

### Create — HomePage decomposition

- `C:\Work\NavSlidesEditor\client\src\pages\home\home-page.jsx`
- `C:\Work\NavSlidesEditor\client\src\pages\home\home-page-constants.js`
- `C:\Work\NavSlidesEditor\client\src\pages\home\home-page-selectors.js`
- `C:\Work\NavSlidesEditor\client\src\pages\home\use-dashboard-data.js`
- `C:\Work\NavSlidesEditor\client\src\pages\home\use-dashboard-creation.js`
- `C:\Work\NavSlidesEditor\client\src\pages\home\use-dashboard-imports.js`
- `C:\Work\NavSlidesEditor\client\src\pages\home\use-pptx-import-controller.js`
- `C:\Work\NavSlidesEditor\client\src\pages\home\use-marketplace-data.js`
- `C:\Work\NavSlidesEditor\client\src\pages\home\home-header.jsx`
- `C:\Work\NavSlidesEditor\client\src\pages\home\home-sidebar.jsx`
- `C:\Work\NavSlidesEditor\client\src\pages\home\presentation-grid.jsx`
- `C:\Work\NavSlidesEditor\client\src\pages\home\template-gallery.jsx`
- `C:\Work\NavSlidesEditor\client\src\pages\home\trash-view.jsx`
- `C:\Work\NavSlidesEditor\client\src\pages\home\import-actions.jsx`
- `C:\Work\NavSlidesEditor\client\src\pages\home\creation-modal.jsx`
- `C:\Work\NavSlidesEditor\client\src\pages\home\home-page-characterization.test.jsx`

### Create — socket decomposition

- `C:\Work\NavSlidesEditor\server\services\live-socket-context.js`
- `C:\Work\NavSlidesEditor\server\services\live-socket-join-handlers.js`
- `C:\Work\NavSlidesEditor\server\services\live-socket-navigation-handlers.js`
- `C:\Work\NavSlidesEditor\server\services\live-socket-annotation-handlers.js`
- `C:\Work\NavSlidesEditor\server\services\live-socket-timer-handlers.js`
- `C:\Work\NavSlidesEditor\server\services\live-socket-disconnect-handler.js`
- `C:\Work\NavSlidesEditor\server\services\live-socket-event-manifest.test.js`

### Modify

- `C:\Work\NavSlidesEditor\shared\src\index.js`
- `C:\Work\NavSlidesEditor\client\src\data\element-defaults.js`
- `C:\Work\NavSlidesEditor\client\src\data\element-defaults.test.js`
- `C:\Work\NavSlidesEditor\client\src\components\canvas\element-renderers\registry.js`
- `C:\Work\NavSlidesEditor\server\middleware\schemas.js`
- `C:\Work\NavSlidesEditor\shared\src\pptx-export-policy.js`
- `C:\Work\NavSlidesEditor\server\routes\presentations.js`
- `C:\Work\NavSlidesEditor\server\routes\pptx-import.js`
- `C:\Work\NavSlidesEditor\client\src\pages\HomePage.jsx`
- `C:\Work\NavSlidesEditor\server\services\socket-handler.js`
- `C:\Work\NavSlidesEditor\server\services\socket-handler.test.js`
- `C:\Work\NavSlidesEditor\client\src\pages\HomePage.pptx-import-lifecycle.test.jsx`
- `C:\Work\NavSlidesEditor\docs\code-standards.md`
- `C:\Work\NavSlidesEditor\docs\system-architecture.md`
- `C:\Work\NavSlidesEditor\README.md`

### Delete

- Only proven dead declarations/hooks/state after the proof checklist. Known first candidate: shadowing module-level `pdfInputRef` and `mdInputRef` declarations in `HomePage.jsx`; component refs remain.
- No production file deletion is pre-authorized beyond proven dead code and emptied compatibility-free modules.

## RED Tests

1. Route manifest equality before/after extraction.
2. Presentations characterization: list/create/get/update/trash/restore/permanent/duplicate/export/present/template/uploads and package routes.
3. PPTX import characterization: admission, busy, timeout, cancel, stream, durable recovery, pending visibility, reconcile, shutdown cleanup.
4. HomePage characterization: load/retry, create, duplicate, trash, restore, template, marketplace, PDF/Markdown/project/PPTX import, unmount cancellation.
5. Socket transcript: join roles, stale async join, presenter reconnect, navigation, remote control, cursor, laser, annotations, timer lifecycle, disconnect.
6. Element contract fails while schema still contains uncounted `divider`.
7. Rendering-mode coverage fails if any canonical type is undeclared.
8. PPTX policy coverage fails if any canonical type lacks strategy.
9. Static dead-code test fails for shadow declarations and any approved unreachable state.
10. Module-boundary test rejects cycles and new oversized files without allowlist rationale.
11. Descriptor verification fails if canonical `ELEMENT_DEFAULTS` changes without regeneration, the generated file is hand-edited, source hash/order differs, or a second hand-maintained base-type list appears.
12. Phase 13 planner characterization fails if an export adapter bypasses, invokes twice, or duplicates the shared IR.

## Implementation

### A. Characterize first

1. Freeze route manifests and representative HTTP snapshots.
2. Freeze HomePage DOM/a11y and import lifecycle behavior.
3. Freeze socket event transcripts using current fake Socket.IO harness.
4. Freeze canonical type, schema, renderer mode, and export strategy coverage.
5. Freeze Phase 13 plan snapshots and planner call-count/ownership tests.

### B. Generated element coverage

1. Keep `ELEMENT_DEFAULTS` unchanged as the repository-canonical source.
2. Add a deterministic generator that loads canonical keys, validates exactly 19 unique names, attaches `LEGACY_ELEMENT_TYPE_ALIASES = { divider: 'line' }`, records source path/hash, and writes the shared generated descriptor with a do-not-edit header.
3. Add `--check` mode that generates in memory and fails on any byte diff; run it in tests, audit, and release rehearsal.
4. Derive the server enum from the generated descriptor; accept the legacy alias only at the existing compatibility boundary.
5. Assert the descriptor keys exactly match current `Object.keys(ELEMENT_DEFAULTS)` order/set. The descriptor never drives defaults generation.
6. Add canvas mode map: `dedicated`, `inline`, or `media`.
7. Assert PPTX policy covers every descriptor type without moving Phase 13 planner ownership.
8. Keep plugin types separate.

### C. Presentations routes

1. Extract shared dependencies/helpers into context.
2. Move routes by domain while preserving registration order.
3. Keep `presentations.js` as the router composition/export compatibility owner.
4. Keep route-specific locks, package readers, reason codes, and response headers unchanged.
5. Run focused tests after every route group move.

### D. PPTX import routes

1. Extract upload timers/multer admission.
2. Extract pure durable-job serialization and visibility helpers.
3. Extract `runImport` unchanged, then reduce through named stage helpers only after GREEN.
4. Extract capability middleware and job route registration.
5. Preserve named exports used by tests/shutdown.

### E. HomePage

1. Move constants and pure selectors.
2. Extract PPTX lifecycle controller first; it has the highest cancellation risk.
3. Extract remaining import controllers.
4. Extract data/creation/marketplace hooks.
5. Extract view components with props, not hidden global state.
6. Keep `HomePage.jsx` as a compatibility re-export.

### F. Socket handler

1. Create one connection context containing socket, io, liveRooms, findById, connectedSockets, and emit helpers.
2. Move join/presentation handlers.
3. Move navigation/pointer handlers.
4. Move annotations.
5. Move timers and timer helpers.
6. Move disconnect cleanup.
7. Keep `setupSocketHandlers` public signature unchanged.

### G. Dead code

1. Generate production import/reference list.
2. Search registry/string/dynamic references.
3. Delete one candidate at a time.
4. Run focused tests plus full lint/test after each batch.
5. If proof is ambiguous, retain code and document it; do not guess.

## Refactor

- Remove compatibility facades only if no imports remain and route/module tests prove safety.
- Prefer dependency objects over long argument lists.
- Avoid “utils” dumping grounds; each module owns one domain.
- No new global store for HomePage.
- No singleton timer state outside existing live-room authority.
- Target orchestrators under 200 LOC; document unavoidable route composition exceptions.
- Keep every change characterization-only: move code with compatibility facades, preserve exact branches/side effects, and defer simplification until after Phase 16.
- Do not inline, fork, or regenerate the Phase 13 shared PPTX export IR.

## GREEN Tests

```powershell
npx vitest run server/routes/presentations*.test.js
npx vitest run server/routes/pptx-import*.test.js server/services/pptx-import-job-manager.test.js
npx vitest run client/src/pages/HomePage*.test.jsx client/src/pages/home/
npx vitest run server/services/socket-handler.test.js server/services/live-rooms.test.js server/services/live-capability-separation.test.js
npx vitest run shared/tests/element-types.test.js client/src/data/element-defaults.test.js client/src/components/canvas/element-renderers/
node scripts/generate-element-type-coverage.js --check
npm run test:audit
npm run matrix:gate
npm run test
npm run test:e2e
npm run lint
npm run build
```

## Scenario Matrix

| Surface       | Scenario                          | Preservation proof                     |
| ------------- | --------------------------------- | -------------------------------------- |
| Presentations | Static path before `/:id`         | Route manifest                         |
| Presentations | Package-backed stale/missing head | Same fail-closed code                  |
| Presentations | Duplicate/restore races           | Existing focused suites                |
| PPTX import   | Busy admission and timeout        | Same status/body                       |
| PPTX import   | Cancel before/after publication   | Same rollback/visibility               |
| HomePage      | Unmount active import             | Cancel/close, no late open/toast       |
| HomePage      | Retry failed load                 | Existing data retained                 |
| Socket        | Stale presenter join              | No stale payload                       |
| Socket        | Remote without capability         | No navigation                          |
| Socket        | Vertical annotations              | Same scoped key                        |
| Socket        | Timer reconnect                   | Same remaining-time scheduling         |
| Registry      | Every base type                   | Declared defaults/schema/render/export |
| Registry      | `divider`                         | Legacy alias only                      |
| Registry      | `plugin:*`                        | Dynamic and outside base count         |

## Regression Gates

- No route manifest diff.
- No socket event/payload transcript diff.
- No HomePage screenshot/a11y diff unless caused by test stabilization and reviewed.
- No public import path break.
- Exactly 19 canonical types; README count remains generated/guarded.
- `ELEMENT_DEFAULTS` remains the documented canonical source; generated coverage descriptor is current and byte-verified.
- No fidelity/matrix row promotion.
- No Phase 13 shared-plan snapshot, planner call count, or ownership diff.
- Full test, E2E, lint, build, and matrix gates pass.
- New files satisfy size/cycle checks.

## Todos

- [ ] Add characterization tests.
- [ ] Add generated shared coverage descriptor and `--check` verification.
- [ ] Extract presentations route modules.
- [ ] Extract PPTX import route modules.
- [ ] Extract HomePage controllers/components.
- [ ] Extract socket handler event modules.
- [ ] Remove only proven dead code.
- [ ] Run focused and full regression gates.
- [ ] Update architecture/code standards/README drift text.

## Success Criteria

- Four oversized owners become small composition facades.
- Behavior snapshots and existing tests show no broad behavior change.
- Canonical `ELEMENT_DEFAULTS` generates a verified shared descriptor covering server schema, canvas mode, and PPTX strategy without transferring ownership.
- `divider` remains a line alias, not type 20.
- Proven dead state/hooks are removed; ambiguous candidates remain.
- New files are under 200 LOC where practical.

## Risks / Signals / Responses

| Risk                         | Signal                         | Response                                |
| ---------------------------- | ------------------------------ | --------------------------------------- |
| Route shadowing/order change | Manifest or status diff        | Restore exact registration order        |
| Lost dependency injection    | Focused test cannot stub owner | Re-export/inject through facade         |
| Home cancellation race       | Late open/toast after unmount  | Keep one controller-owned lifecycle ref |
| Socket split authority       | Duplicate maps/timers          | One connection context only             |
| Type drift                   | Set mismatch                   | Fail CI through shared coverage test    |
| Canonical ownership drift    | Second hand-maintained list    | Delete duplicate; regenerate projection |
| Shared export IR fork        | Plan snapshot/call-count diff  | Restore Phase 13 planner boundary       |
| Dead-code false positive     | Dynamic reference found        | Retain code                             |
| Cosmetic churn               | Screenshot diff                | Revert markup/class change              |

## Security

- Preserve all current capability, package authority, path containment, validation, and rate-limit middleware.
- Never move capability checks after state mutation.
- Socket role/capability checks stay adjacent to event handlers or in named guards.
- Shared type aliases must not broaden arbitrary input acceptance.
- Refactor must not log capabilities, tokens, presentation content, or import diagnostics more broadly.

## Dependencies

- Phases 1–13 green baseline.
- Phase 13 shared export plan stabilizes export ownership before route/module movement.
- Existing route, socket, HomePage, matrix, and E2E characterization infrastructure.
- Phase 15 is blocked by this phase and consumes the post-cleanup characterized modules for Windows/PowerPoint artifact evidence.
- Phase 16 is the mandatory full proof; Phase 14 focused green alone is insufficient.

## Unresolved Questions

- None. Any extraction with unclear behavior ownership stays in the facade until characterized.
