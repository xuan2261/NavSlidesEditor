---
title: 'Phase 13: Shared PPTX Export Plan and Parity'
description: 'Create one pure presentation-to-PPTX export plan consumed by browser and server adapters, with semantic parity tests and unchanged existing media policy.'
status: pending
priority: P1
effort: 6d
issue: null
branch: master
phase: 13
dependencies: [11, 12]
tags: [pptx, export, shared, refactor, tdd, fidelity]
created: 2026-09-25
---

# Phase 13: Shared PPTX Export Plan and Parity

## Context

- Browser export currently plans slides inside `client/src/utils/exportPptx.js`.
- Server round-trip export separately plans slides inside `server/utils/server-export.js`.
- Both already share low-level policies through `revealjs-shared`, but they differ on vertical slides, layout flattening, connectors, actions, hidden state, warning shape, and raster orchestration.
- Existing image, media, chart, and table policies are qualified contracts. This phase composes them; it does not redesign them.
- This phase follows Phase 12 chart/workbook work and must not widen imported-package mutation claims.

## Goal

Produce one deterministic, side-effect-free export intermediate representation (IR), called the **PPTX export plan**. Browser and server exporters consume the same plan. Environment-specific code only resolves raster/media bytes and writes `pptxgenjs` objects.

## Scope / Non-Goals

### In scope

- Parent-first recursive flattening of vertical slide trees.
- Presentation resolution and PowerPoint layout resolution.
- Layout-master resolution and flattening warnings.
- Hidden slide preservation; hidden element omission.
- Smart connector endpoint resolution and attachment-semantics warnings.
- Action normalization, omission, and structured warnings.
- Stable z-order, notes, slide tokens, background descriptors, element bounds, strategy, and raster requests.
- Shared structured warning descriptors with backward-compatible browser/server string projections.
- Browser and server adapters consuming the same pure plan.
- Browser/server semantic parity corpus.

### Non-goals

- No rewrite of `pptx-image-options.js`, `pptx-media-options.js`, native chart mapping, table merge/rotation policy, or fallback eligibility.
- No native PowerPoint master creation.
- No editable conversion for HTML, LaTeX, Markdown, SVG, drawings, timelines, games, or unsupported chart types.
- No package-first mutation, OfficeCLI, PowerPoint oracle, or G3/G5 work.
- No network/file reads in the pure planner.

## Key Insights

- Planning and byte acquisition are different concerns. The planner must emit requests, never perform fetch, filesystem, DOM, Playwright, or `pptxgenjs` work.
- Plan equality is stronger and cheaper than comparing two generated ZIP packages whose metadata may differ.
- Stable source identity must include a slide path such as `0`, `0/0`, `0/1`, `1`; a flat index alone loses vertical ancestry.
- Environment capability must not change semantic strategy. Missing adapters turn a planned raster into a documented fallback/error; they do not silently select a different semantic policy.
- Existing warning strings are UI/API compatibility. Add canonical descriptors first, then derive legacy strings.
- The shared export IR is the long-lived semantic boundary. Later module decomposition may move callers and adapters, but must not fork, inline, regenerate, or transfer ownership of the planner.

## Requirements

### Functional

1. `buildPptxExportPlan(presentation)` returns the same canonical value in Node and browser.
2. It must not mutate the presentation, slides, elements, layout masters, tokens, or connector metadata.
3. Slides flatten depth-first, parent before children.
4. Every plan slide records `flatIndex`, `sourcePath`, `sourceSlideId`, `hidden`, notes, background, effective tokens, and resolved elements.
5. Layout-linked slides use `resolveEffectiveSlide`; warning order is deterministic.
6. Hidden elements never appear in render operations or raster requests.
7. Connected lines contain resolved endpoints; source attachment metadata is not passed as native attachment semantics.
8. Actions are normalized with `normalizeElementAction`, omitted from render payloads, and reported.
9. Every element operation contains canonical bounds, source identity, z-order, strategy from `getPptxElementExportStrategy`, and optional raster request.
10. Duplicate/missing IDs required by raster requests fail before any environment work.
11. Client and server preserve current filenames, notes, backgrounds, primitive rendering, and warning strings.
12. Phase 14 characterization refactors preserve `buildPptxExportPlan` and its schema as the sole browser/server semantic owner; no environment adapter may rebuild an equivalent private plan.

### Non-functional

- Pure CommonJS-compatible shared module; Vite import remains safe.
- Canonical ordering: slides, elements, raster requests, warnings.
- New focused files under 200 LOC where practical.
- No added remote dependency.
- Planner must handle a 500-slide/10,000-element synthetic deck without superlinear scans.

## Architecture

### Pure plan boundary

```text
presentation JSON
  -> buildPptxExportPlan()
     -> normalized presentation resolution/layout
     -> flattened effective slides
     -> connector-resolved, visible, z-sorted operations
     -> structured warnings
     -> environment-neutral raster/media requests

plan + browser adapters -> pptxgenjs -> download
plan + server adapters  -> pptxgenjs -> file
```

### IR contract

```js
{
  schemaVersion: 1,
  title,
  resolution: { width, height },
  layout: { width, height },
  slides: [{
    flatIndex,
    sourcePath,
    sourceSlideId,
    hidden,
    notes,
    background,
    designTokens,
    operations: [{
      operationId,
      sourceElementId,
      sourceType,
      zIndex,
      bounds,
      strategy,
      element,
      rasterRequestId: null | string
    }]
  }],
  rasterRequests: [{
    id,
    sourcePath,
    elementId,
    elementType,
    strategy,
    required
  }],
  warnings: [{
    code,
    slideNumber,
    sourcePath,
    elementId,
    elementType,
    severity,
    fallback,
    message
  }]
}
```

### Adapter rules

- `client`: resolves required server-prefetch rasters through the existing loopback API, client fallbacks through existing DOM capture, and local media through current browser validation.
- `server`: resolves raster requests through `server-raster`, media through `server-pptx-media`, and filesystem-safe image sources through current server normalization.
- Both pass the same planned operation to existing primitive/background renderers.
- Both set hidden-slide OOXML through the supported `pptxgenjs` surface; package tests verify `<p:sldId show="0">` or equivalent. If the library cannot express it, phase fails rather than dropping hidden state silently.

## Absolute File Inventory

### Create

- `C:\Work\NavSlidesEditor\shared\src\pptx-export-plan.js` — pure plan builder.
- `C:\Work\NavSlidesEditor\shared\src\pptx-export-plan-warnings.js` — canonical warning constructors and legacy message projection.
- `C:\Work\NavSlidesEditor\shared\tests\pptx-export-plan.test.js` — RED/GREEN unit contract.
- `C:\Work\NavSlidesEditor\shared\tests\pptx-export-plan-property.test.js` — immutability, determinism, ordering, and bounded synthetic cases.
- `C:\Work\NavSlidesEditor\tests\fixtures\pptx-export-parity-corpus.js` — semantic fixtures only; no duplicate policy tables.
- `C:\Work\NavSlidesEditor\tests\unit\pptx-export-plan-parity.test.js` — client/server plan equality.
- `C:\Work\NavSlidesEditor\client\src\utils\pptx-export-browser-adapter.js` — browser raster/media adapter.
- `C:\Work\NavSlidesEditor\server\utils\pptx-export-server-adapter.js` — server raster/media adapter.

### Modify

- `C:\Work\NavSlidesEditor\shared\src\index.js` — export planner APIs.
- `C:\Work\NavSlidesEditor\client\src\utils\exportPptx.js` — orchestrate shared plan and browser adapter.
- `C:\Work\NavSlidesEditor\client\src\utils\export-pptx-renderers.js` — consume planned operations without replanning.
- `C:\Work\NavSlidesEditor\client\src\utils\export-pptx-core.js` — delegate shared layout/bounds/warning concerns; retain compatibility exports.
- `C:\Work\NavSlidesEditor\server\utils\server-export.js` — orchestrate shared plan and server adapter.
- `C:\Work\NavSlidesEditor\server\utils\server-renderers.js` — consume planned operations without replanning.
- `C:\Work\NavSlidesEditor\client\src\utils\exportPptx.test.js` — adapter and compatibility assertions.
- `C:\Work\NavSlidesEditor\server\utils\server-export.test.js` — shared-plan integration assertions.
- `C:\Work\NavSlidesEditor\server\utils\server-export-chart-table.test.js` — prove existing policies unchanged.
- `C:\Work\NavSlidesEditor\server\utils\server-export-media.test.js` — prove existing media policy unchanged.
- `C:\Work\NavSlidesEditor\docs\system-architecture.md` — document shared planner boundary.
- `C:\Work\NavSlidesEditor\docs\export-fidelity-and-limits.md` — document parity without widening fidelity claims.

### Delete

- None initially. Remove duplicated private planning helpers only after parity tests are GREEN.

## RED Tests

1. Client flattens vertical slides but server does not: assert shared expected order fails on server.
2. Layout-linked fixture: assert server/client effective element IDs and warnings match.
3. Smart connector fixture: assert resolved endpoints equal and one structured flattening warning exists.
4. Hidden fixture: assert hidden elements absent and hidden slide flag retained.
5. Action fixture: assert URL/navigation action omitted and warning code/fallback exact.
6. Raster fixture: assert stable IDs, duplicate-ID rejection, request ordering, and required/optional status.
7. Deep-freeze input; planner must not mutate.
8. Run planner twice and compare canonical JSON bytes.
9. Policy sentinel tests snapshot image/media/chart/table strategy results before refactor.
10. Generate client/server PPTX packages and inspect semantic OOXML: slide count/order, hidden state, notes, shape/media/chart/table counts, and warnings.

## Implementation

1. Capture pre-refactor policy and generated-package semantic baselines.
2. Add small shared traversal helpers: source-path creation, parent-first flatten, effective-slide resolution.
3. Build canonical slide descriptors with resolution, layout, notes, background, tokens, and hidden state.
4. Resolve connectors once per effective slide.
5. Filter hidden elements; stable-sort by `zIndex`, then original index.
6. Normalize actions and emit omission warnings.
7. Classify strategy only through existing `getPptxElementExportStrategy`.
8. Emit raster requests without reading bytes.
9. Validate raster IDs in one pass with source-path diagnostics.
10. Expose the planner through `shared/src/index.js`.
11. Implement client/server adapter interfaces:
    - `resolveRasterRequests(plan)`
    - `resolveMedia(operation)`
    - `resolveImageSource(operation)`
    - `renderPlan(plan, assets, target)`
12. Convert browser export to plan-first orchestration.
13. Convert server export to the same orchestration.
14. Preserve legacy return shapes: browser warning array plus non-enumerable `exportReport`; server `{ warnings }`.
15. Inspect generated OOXML for hidden slides, notes, vertical order, connectors, and actions.

## Refactor

- Delete `flattenPptxSlides`, duplicate resolution/layout logic, connector replanning, and warning assembly from environment owners.
- Keep rendering primitives in their current client/server modules; do not force DOM and filesystem code into shared.
- Keep compatibility re-exports until all callers migrate.
- Split planner traversal, warnings, and adapter code if any file approaches 200 LOC.
- Run a duplicate-policy audit. Any copied image/media/chart/table switch is a blocker.

## GREEN Tests

```powershell
npx vitest run shared/tests/pptx-export-plan.test.js shared/tests/pptx-export-plan-property.test.js
npx vitest run tests/unit/pptx-export-plan-parity.test.js
npx vitest run client/src/utils/exportPptx.test.js client/src/utils/export-pptx-core.test.js
npx vitest run server/utils/server-export.test.js server/utils/server-export-chart-table.test.js server/utils/server-export-media.test.js
npm run test:pptx:corpus-metrics
npm run test:pptx:browser-audit
npm run lint
npm run build
```

## Scenario Matrix

| Scenario                    | Planned result                           | Required evidence                  |
| --------------------------- | ---------------------------------------- | ---------------------------------- |
| Horizontal deck             | One plan slide per source slide          | Plan equality + OOXML order        |
| Nested vertical deck        | Depth-first parent-first flatten         | Exact source paths and slide count |
| Layout master               | Resolved objects, no native master claim | Effective IDs + warning            |
| Hidden slide                | Slide retained as hidden                 | OOXML hidden flag                  |
| Hidden element              | Omitted                                  | No operation/raster request        |
| Smart connector             | Resolved native line                     | Exact endpoints + flatten warning  |
| Browser action              | Omitted                                  | Structured warning                 |
| HTML/LaTeX                  | Required server-prefetch raster          | Same request in both environments  |
| Unsupported raster type     | Existing fallback                        | Existing policy sentinel unchanged |
| Image effects               | Existing image policy                    | Same strategy/warning              |
| Local media                 | Existing media policy                    | Same embed/fallback decision       |
| Native chart/table          | Existing native policy                   | Same OOXML object class            |
| Raster ID missing/duplicate | Fail before environment work             | Stable error code                  |

## Regression Gates

- Current client export tests remain green without weaker assertions.
- Current server export and round-trip corpus remain green.
- No image/media/chart/table policy diff without a separately approved phase.
- Browser and server canonical plan JSON must be byte-equal for every parity fixture.
- Warning order and legacy warning text remain stable.
- No external URL fetch added to the server path.
- Planner performance remains linear within a documented tolerance.
- Phase 14 module-boundary characterization proves every PPTX export path still enters this shared IR exactly once and contains no copied planner policy.

## Todos

- [ ] Freeze pre-refactor semantic baselines.
- [ ] Add RED planner and parity tests.
- [ ] Implement pure IR.
- [ ] Add browser adapter.
- [ ] Add server adapter.
- [ ] Migrate both exporters.
- [ ] Remove proven duplicate planning helpers.
- [ ] Run focused, corpus, browser, lint, and build gates.
- [ ] Update architecture and fidelity docs.

## Success Criteria

- One shared pure plan owns slide/element export semantics.
- Client and server produce identical plans for the parity corpus.
- Vertical, layout, connector, hidden, action, strategy, and warning cases are covered.
- Existing image/media/chart/table policy tests show no behavior rewrite.
- Generated packages retain expected semantic OOXML.
- No mandatory gate is skipped.

## Risks / Signals / Responses

| Risk                                       | Signal                        | Response                                      |
| ------------------------------------------ | ----------------------------- | --------------------------------------------- |
| Hidden slide silently lost                 | OOXML lacks hidden marker     | Block phase; do not downgrade to warning      |
| Planner mutates source                     | Deep-freeze failure           | Clone only required plan fields; fix owner    |
| Browser/server capability changes strategy | Plan JSON differs             | Move decision back to shared policy           |
| Warning compatibility breaks               | UI/server snapshots differ    | Derive legacy strings from canonical warnings |
| Raster collision                           | Duplicate request ID          | Fail before fetch/render                      |
| Scope creep into media policy              | Strategy sentinel diff        | Revert policy change; open separate phase     |
| Large-deck slowdown                        | Synthetic benchmark nonlinear | Replace nested scans with maps/sets           |

## Security

- The planner performs no I/O and never dereferences URLs or filesystem paths.
- Server adapter retains upload-root containment, MIME/signature checks, and external-URL denial.
- Browser adapter retains same-origin `/uploads/` checks.
- Trusted active HTML remains trusted-author content; rasterization is not a sanitization claim.
- Warning/error text uses bounded identifiers; no source secrets or raw HTML in logs.

## Dependencies

- Phase 12 native chart/workbook behavior and policy sentinels.
- Existing `resolveEffectiveSlide`, `resolveConnectorGeometry`, `normalizeElementAction`, design tokens, notes, and PPTX strategy modules.
- Existing browser/server raster and media adapters.
- Phase 15 consumes deterministic export semantics but is not required to implement this phase.
- Phase 14 may reorganize surrounding modules before Phase 15 runs, but cannot replace or duplicate this shared IR.

## Unresolved Questions

- None. If `pptxgenjs` cannot encode hidden slides in the pinned version, treat it as a blocking implementation gap, not an accepted silent loss.
