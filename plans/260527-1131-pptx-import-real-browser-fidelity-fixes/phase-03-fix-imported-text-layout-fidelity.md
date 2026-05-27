# Phase 03 Fix Imported Text Layout Fidelity

## Context Links

- Phase 02 root-cause report: `reports/phase-02-text-overflow-root-cause-report.md`
- Phase 03 report: `reports/phase-03-imported-text-layout-fidelity-report.md`
- Text render: [canvas-element-wrapper.jsx](../../client/src/components/canvas/canvas-element-wrapper.jsx)
- Shape render: [shape-element-renderer.jsx](../../client/src/components/canvas/element-renderers/shape-element-renderer.jsx)
- Acceptance gate: [acceptance-criteria.js](../../server/services/pptx-import/acceptance-criteria.js)

## Overview

Priority: P0. Status: complete. Fix all imported text overflow classes while preserving WYSIWYG editing and export compatibility.

## Key Insights

- Current audit has 655 text overflow hits.
- Large horizontal overflow means browser text wrapping rules are wrong or imported rich HTML contains no-wrap spans.
- Imported PPTX text needs its own layout contract, not global editor behavior changes.

<!-- Updated: Validation Session 1 - Bounded shrink-to-fit is allowed only after CSS/import normalization is insufficient, with min readable font-size/line-count guardrails and before/after visual evidence. -->

## Requirements

- Functional: imported text should fit inside its PPTX text box.
- Functional: normal user-created text behavior unchanged.
- Functional: shape text and text elements share wrapping/inset/fitting policy.
- Functional: support Vietnamese text and long unbroken tokens.
- Functional: fitting must preserve readable visual fidelity; no pass-by-shrinking unreadable text.
- Functional: `_pptxImportMeta` lifecycle is defined for edit, duplicate, copy/paste, `.navslides` export/import, and missing/partial old metadata.
- Non-functional: avoid adding heavy runtime layout loops on every render.

## Architecture

```text
import mapper
  -> mark imported text meta: fit policy + source dimensions
client renderer
  -> imported text class/style
  -> CSS wrap + paragraph reset
  -> optional bounded shrink pass for imported text only
audit
  -> zero text overflow
```

## Related Code Files

- Modify: `C:/Work/NavSlidesEditor/server/services/pptx-import/mapper/utils-text.js`
- Modify: `C:/Work/NavSlidesEditor/server/services/pptx-import/mapper/map-shape.js`
- Modify: `C:/Work/NavSlidesEditor/client/src/components/canvas/canvas-element-wrapper.jsx`
- Modify: `C:/Work/NavSlidesEditor/client/src/components/canvas/element-renderers/shape-element-renderer.jsx`
- Modify: `C:/Work/NavSlidesEditor/shared/src/element-renderers.js`
- Tests:
  - `C:/Work/NavSlidesEditor/server/services/pptx-import/mapper/utils-text.test.js`
  - `C:/Work/NavSlidesEditor/client/src/components/canvas/canvas-element-wrapper.test.jsx`
  - `C:/Work/NavSlidesEditor/client/src/components/canvas/element-renderers/shape-element-renderer.test.jsx`

## Implementation Steps

1. RED: assert imported text boxes from top offenders no longer overflow in component-level DOM test.
2. Add imported text meta fields conservatively:
   - `_pptxImportMeta.textFit = 'shrink-to-fit' | 'wrap'`
   - `_pptxImportMeta.sourceFontSizePx`
   - `_pptxImportMeta.sourceBox`
3. Normalize imported rich text HTML:
   - strip `white-space: nowrap` unless source explicitly requires it for tiny labels
   - convert unsafe/no-wrap spans to wrap-safe spans
   - reset `p` margins to PowerPoint-compatible zero/small value
4. Add CSS for imported text preview:
   - `overflow-wrap: anywhere`
   - `word-break: normal`
   - `white-space: pre-wrap` or equivalent class decided by Phase 02
   - `line-height` from source, clamped to sane range
5. Prefer deterministic import-time/shared-helper fitting over runtime-only measurement. Add bounded shrink only if Phase 02 proves CSS/import normalization is insufficient:
   - wait for `document.fonts.ready`
   - use a single measured container and bounded iterations
   - expose a settled signal for Playwright before audit measurement
   - apply the same computed contract in export/shared render paths, or persist/import-compute the final fit value
   - do not shrink below a readability threshold approved in the phase report
   - record before/after screenshots or metrics for representative offenders before treating `text=0` as success
   - measure after render
   - shrink font-size by scale factor
   - store persistent/import-computed changes only when needed for shared/export parity
6. Mirror same policy for `ShapeRenderer` foreignObject.
7. Update shared renderer to match editor output for presentation/export.
8. Define `_pptxImportMeta` lifecycle:
   - version metadata, e.g. `_pptxImportMeta.version`
   - preserve for imported untouched elements
   - invalidate or recompute fit policy on manual content/style edits
   - keep duplicate/copy behavior explicit
   - fallback safely for old saved presentations with no/partial/corrupt metadata
9. Add representative visual/reference checks: compare worst offender screenshots before/after and enforce min readable font-size/line-count constraints so `text=0` is not the only proof.

## Tests

- RED/GREEN unit:
  - HTML sanitizer removes/import-normalizes no-wrap style.
  - font and line-height clamp.
  - text inset does not shrink content below zero.
- Component:
  - text element with long Vietnamese paragraph fits width/height.
  - narrow label fits without horizontal scroll.
  - shape rich text fits foreignObject.
- E2E:
  - audit strict text gate: `text=0`; no residual text overflow is allowed in P0 strict pass.
  - representative visual checks show no unreadable shrink or worse PowerPoint-like line breaking on top offenders.
- Commands:
  ```bash
  npx vitest run server/services/pptx-import/mapper/utils-text.test.js
  npx vitest run client/src/components/canvas/canvas-element-wrapper.test.jsx client/src/components/canvas/element-renderers/shape-element-renderer.test.jsx
  npx playwright test tests/e2e/pptx-import-real-browser-audit.spec.js --project=chromium --workers=1 --retries=0
  ```

## Todo List

- [x] Add failing tests first.
- [x] Implement imported text normalization.
- [x] Implement render wrapping/shrink policy.
- [x] Mirror shared renderer.
- [x] Verify text count drops from 655 to 0.

## Completion Evidence

- Text overflow dropped from baseline `655` to `0` across all 5 decks and 227 slides.
- Component/shared tests cover imported-only wrapping behavior and shared export parity.
- Mapper tests cover `_pptxImportMeta` version, fit policy, source/fitted font size, source box, text length, and font-size stripping.
- `npm run build` passed.
- Browser audit non-strict passed; remaining strict failures are image, out-of-canvas, and console categories for later phases.

## Success Criteria

- Browser audit reports `text=0` across 227 slides.
- No user-created text regression in existing editor tests.
- No raw CSS units or unsafe style tokens reintroduced.
- Shared/export renderers use the same deterministic fitting contract; editor-only post-render effects cannot be the sole source of correctness.
- Old imported presentations without new metadata render safely and predictably.

## Risk Assessment

- Risk: shrink makes text smaller than original. Mitigation: only shrink when overflow exists; record before/after metric.
- Risk: editing mode differs from preview. Mitigation: apply same imported style to `EditorContent`.
- Risk: metric passes while visual fidelity worsens. Mitigation: add representative screenshot/reference review and readability constraints.

## Security Considerations

- Keep `sanitizeRichTextHtml` as boundary with explicit adversarial tests for `on*`, `javascript:`, protocol-relative URLs, `data:` where not allowed, CSS `url()`, `position:fixed`, SVG/foreignObject tags, malformed nested HTML, and unsafe style units/tokens.
- Do not write raw unsafe HTML or unredacted slide text into reports.

## Next Steps

Fix shape geometry and console errors in Phase 04.
