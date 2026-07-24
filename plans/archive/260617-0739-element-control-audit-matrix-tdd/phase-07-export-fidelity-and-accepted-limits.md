# Phase 07 Export Fidelity And Accepted Limits

## Context Links

- `C:/Work/NavSlidesEditor/shared/src/element-renderers.js`
- `C:/Work/NavSlidesEditor/shared/src/htmlGenerator.js`
- `C:/Work/NavSlidesEditor/client/src/utils/export-pptx-basic-renderers.js`
- `C:/Work/NavSlidesEditor/client/src/utils/export-pptx-renderers.js`
- `C:/Work/NavSlidesEditor/client/src/utils/export-pptx-fallback-renderer.js`
- `C:/Work/NavSlidesEditor/docs/export-fidelity-and-limits.md`

## Overview

Priority: P0
Status: Completed
Goal: make every `export-gap` row explicit and test-backed: either fix, rasterize/fallback with warning, or document as accepted format limit.

## Key Insights

- HTML export has broad support via shared renderers.
- PPTX export is hybrid: native for stable primitives, raster/fallback for complex DOM/live elements.
- Silent fallback is worse than documented limitation.
- Accepted limits must be visible in docs and matrix.

## Requirements

<!-- Updated: Validation Session 1 - export warnings must be user-visible through export result modal/panel and machine-readable through an export report. -->

Functional:
- Verify shared HTML export for matrix-critical controls.
- Verify PPTX native support for text/image/shape/line/callout/table/code/chart where claimed.
- Verify fallback/warnings for html/markdown/latex/video/audio/icon/qrcode/drawing/svg/timeline/game.
- Define a machine-readable export warning/report contract: `elementId`, `elementType`, `control`, `surface`, `matrixRowId`, `severity`, `message`, `fallback`.
- Require fallback warnings to be user-visible in an export result modal/panel and emitted in the machine-readable export report, not only logged to console or internal arrays.
- Document accepted limits: CSS filters, image radius, drop shadow, live games, iframes, dynamic scripts, audio/video native embedding.
- Document export security limits for active HTML/iframes/scripts, external network access, local paths, sandbox/referrer/CSP policy where compatible.

Non-functional:
- No fake native PPTX support.
- No brittle visual-only assertions without state/warning evidence.
- Keep export tests hermetic; no network required.
- Use matrix-driven export contract tests where possible to avoid duplicating assertions across phases.

## Architecture

```text
presentation JSON
  -> shared HTML renderers
  -> print/offline renderers
  -> PPTX native renderers for stable primitives
  -> fallback/raster renderers for complex/live-only elements
  -> machine-readable warnings/export report + docs + matrix statuses
```

## Related Code Files

Tests:
- `C:/Work/NavSlidesEditor/shared/tests/element-renderers.test.js`
- `C:/Work/NavSlidesEditor/shared/tests/htmlGenerator.test.js`
- `C:/Work/NavSlidesEditor/client/src/utils/export-pptx-basic-renderers.test.js`
- `C:/Work/NavSlidesEditor/client/src/utils/export-pptx-renderers.test.js`
- `C:/Work/NavSlidesEditor/client/src/utils/export-pptx-raster.test.js`
- `C:/Work/NavSlidesEditor/tests/e2e/export/element-control-export-fidelity.spec.js`

Potential source/docs:
- `C:/Work/NavSlidesEditor/shared/src/element-renderers.js`
- `C:/Work/NavSlidesEditor/client/src/utils/export-pptx-basic-renderers.js`
- `C:/Work/NavSlidesEditor/client/src/utils/export-pptx-renderers.js`
- `C:/Work/NavSlidesEditor/client/src/utils/export-pptx-fallback-renderer.js`
- `C:/Work/NavSlidesEditor/docs/export-fidelity-and-limits.md`

## Tests First

1. Matrix-driven export contract unit: for every `export-gap` row, assert its classification is `fix-now`, `fallback-warning`, or `accepted-limit`.
2. Shared HTML unit: representative rows render critical control fields without unsafe/local path leaks.
3. PPTX native unit: supported native rows map geometry, rotation, opacity where claimed.
4. PPTX fallback unit: unsupported rows emit placeholder or raster image with an `ExportWarning` object.
5. Export docs test or static check: every accepted limit in matrix appears in `docs/export-fidelity-and-limits.md`.
6. E2E smoke: export a deck with representative elements; assert no empty output and warnings are visible to the user.

Commands:

```bash
npm run test -- shared/tests/element-renderers.test.js shared/tests/htmlGenerator.test.js
npm run test -- client/src/utils/export-pptx-basic-renderers.test.js client/src/utils/export-pptx-renderers.test.js
npm run test:pptx:browser-audit
```

## Implementation Steps

1. Enumerate all `export-gap` rows from matrix.
2. Classify each row:
   - Fix now.
   - Fallback/raster with warning.
   - Accepted limit, docs only.
3. Define the `ExportWarning` schema and user-visible delivery path.
4. Add matrix-driven contract tests for each classification.
5. Update `docs/export-fidelity-and-limits.md`.
6. Update matrix status and decision fields.
7. Run strict PPTX audit only after unit/fallback tests pass.

## Todo List

- [x] Export-gap classification table.
- [x] Export warning/report schema.
- [x] Shared HTML representative tests.
- [x] PPTX native mapping tests.
- [x] PPTX fallback warning tests.
- [x] Export security policy checks.
- [x] Export limits docs update.
- [x] Matrix update.

## Completion Evidence

- `docs/export-fidelity-and-limits.md` now documents the PPTX warning schema, user-visible browser export-result modal path, machine-readable `exportReport`, export-gap classification table, and trusted-author export security limits.
- `client/src/utils/export-pptx-core.js` defines `recordPptxExportWarning` with `elementId`, `elementType`, `control`, `surface`, `matrixRowId`, `severity`, `message`, and `fallback`.
- `client/src/utils/export-pptx-renderers.js` and `client/src/utils/export-pptx-fallback-renderer.js` record structured warnings for server raster, client raster, media cover, placeholder, and export-error paths while preserving the existing string warning array.
- Unsupported chart variants now report `chart.chart-data-options.pptx-export`; slide background fallbacks also emit structured report entries instead of string-only warnings.
- `client/src/hooks/use-export-actions.js` keeps warnings user-visible and stores `globalThis.__NAVSLIDES_LAST_PPTX_EXPORT_REPORT__` for machine-readable inspection.
- Targeted verification passed: `npm run test -- client/src/utils/exportPptx.test.js client/src/hooks/use-export-actions.test.js`.

## Success Criteria

- No export gap is silent.
- Docs and matrix agree.
- PPTX warnings identify unsupported/fallback element, control, surface, and matrix row.
- Fallback warnings are visible to the user during export.
- Current product claims remain honest.

## Risk Assessment

- Risk: making all export gaps native is too expensive.
  Mitigation: warnings/docs are acceptable when format limit is real.
- Risk: browser audit slow.
  Mitigation: run unit tests first; full audit as release gate.

## Red Team Review Applied

- Finding 13: fallback warnings need a concrete schema and user-visible contract.
- Finding 14: export coverage should be matrix-driven to avoid duplicated, drifting assertions across phases.
- Finding 8: active HTML/export security limits require docs and warning coverage, not only fidelity notes.

## Security Considerations

<!-- Updated: Validation Session 1 - export security scope preserves trusted-author behavior and adds warnings/tests/docs without broad sandbox/CSP redesign. -->

- HTML/iframe export keeps trusted author policy; docs must state trust boundary.
- Avoid embedding unsafe local paths in exported assets.
- Active content exports must document sandbox/referrer/CSP limitations and warn about same-origin hosting risks where the product intentionally preserves scripts.
- Do not redesign HTML export sandbox/CSP/runtime in this plan unless required to enforce a specific accepted policy row.

## Next Steps

Phase 08 wires governance and final verification.
