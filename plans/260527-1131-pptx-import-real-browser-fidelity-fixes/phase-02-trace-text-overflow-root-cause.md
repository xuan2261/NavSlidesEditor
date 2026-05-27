# Phase 02 Trace Text Overflow Root Cause

## Context Links

- Report: [Real Browser Audit](../reports/pptx-import-real-browser-audit.md)
- Report: [Phase 02 Text Overflow Root Cause Report](./reports/phase-02-text-overflow-root-cause-report.md)
- Top offenders from JSON: `Bai_2_5#21`, `Bai_2_5#9`, `Bai_2_2#22/#23`, `Bai_2_1#2`, `STTre_Duc#11`
- Import mapper: [utils-text.js](../../server/services/pptx-import/mapper/utils-text.js)
- Client text render: [canvas-element-wrapper.jsx](../../client/src/components/canvas/canvas-element-wrapper.jsx)

## Overview

Priority: P0. Status: complete. Add source-to-DOM trace tests proving why the dominant text overflow classes happen. This phase is investigation only; no product renderer/mapper behavior changes.

## Key Insights

- Most overflows are horizontal, often huge: `3657px`, `2891px`, `2709px`.
- This suggests wrapping/white-space/paragraph structure issue more than just 33% font-size issue.
- Shape text also overflows in `STTre_Duc`, so both text and shape text renderers need inspection.

## Requirements

- Functional: identify whether overflow comes from font size, line-height, white-space, text box width, missing wraps, paragraph margins, text insets, or transform.
- Functional: inventory available PowerPoint layout metadata: autofit, theme/fallback fonts, text inset, rotation, baseline, paragraph spacing, bullet indentation, and source crop/clip behavior where parser exposes it.
- Functional: classify the top root causes by count/impact and explicitly bucket `unknown/insufficient-source-data` instead of forcing false certainty.
- Functional: preserve editable text where possible; raster fallback is not acceptable for normal text.
- Non-functional: add minimal diagnostic metadata only if helpful; avoid storing large source dumps in presentation.

## Architecture

```text
pptxtojson text runs
  -> map text style metadata
  -> sanitize HTML
  -> NavSlides element content/font fields
  -> React render CSS
  -> DOM scrollWidth/clientWidth audit
```

## Related Code Files

- Modify only if needed for diagnostics/tests, not product behavior: `C:/Work/NavSlidesEditor/tests/e2e/pptx-import-real-browser-audit.spec.js`
- Modify only if needed for diagnostics/tests, not product behavior: `C:/Work/NavSlidesEditor/tests/e2e/pages/pptx-import-audit-helper.js`
- Create/modify tests:
  - `C:/Work/NavSlidesEditor/server/services/pptx-import/mapper/utils-text.test.js`
  - `C:/Work/NavSlidesEditor/server/services/pptx-import/acceptance-criteria.test.js`
  - `C:/Work/NavSlidesEditor/tests/e2e/pptx-import-real-browser-audit.spec.js`
  - Product files may be read for context; move product behavior edits to Phase 03.

## Implementation Steps

1. RED: add focused fixtures from imported corpus for top overflow classes:
   - long Vietnamese paragraph box
   - title line with explicit fit/shrink
   - narrow label text
   - shape with rich text
2. Add diagnostic helper that records for each text issue:
   - element `fontSize`, `lineHeight`, `width`, `height`
   - first 80 chars plain text
   - computed `white-space`, `word-break`, `overflow-wrap`, paragraph margins
   - source font size if available in `_pptxImportMeta`
3. Compare source PPTX style fields to NavSlides fields for top offenders.
4. Classify top offenders into root-cause buckets:
   - `nowrap-or-unbreakable`
   - `font-too-large`
   - `line-height-too-large`
   - `paragraph-margin`
   - `text-inset-shrinks-box`
   - `shape-text-foreign-object`
   - `unknown/insufficient-source-data`
5. Stop condition: cover the top 3 root causes or at least 80-90% of text overflow hits by count, whichever gives a smaller focused implementation set. Remaining buckets become documented backlog or explicit Phase 03 decision items.
6. Write phase report with counts by root cause and data gaps.

## Tests

- Unit tests:
  - `utils-text.test.js` preserves paragraph breaks while enabling browser wrap.
  - source font pt -> canvas px remains within tolerance.
  - rich HTML has no raw pt/in/cm/mm.
- Component tests:
  - imported text preview computed styles include wrapping rules.
  - shape rich text uses same wrapping policy.
- E2E diagnostic:
  ```bash
  PPTX_IMPORT_AUDIT_TRACE_TEXT=1 npx playwright test tests/e2e/pptx-import-real-browser-audit.spec.js --project=chromium --workers=1 --retries=0
  ```

## Todo List

- [x] Add trace fields to audit report, not product model unless required.
- [x] Build top-offender fixture set.
- [x] Produce root-cause counts.
- [x] Decide exact fix target for Phase 03.

## Completion Evidence

- Targeted unit test passed: `npx vitest run tests/unit/pptx-import-audit-helper.test.js`.
- Targeted lint passed: `npx eslint tests/e2e/pptx-import-real-browser-audit.spec.js tests/e2e/pages/pptx-import-audit-helper.js tests/e2e/pages/pptx-import-audit-report-helper.js tests/unit/pptx-import-audit-helper.test.js`.
- Non-strict browser audit passed and produced `textRootCauses`: `nowrap-or-unbreakable=616`, `shape-text-foreign-object=25`, `font-too-large=12`, `unknown/insufficient-source-data=2`.
- Product behavior files were read for context only; no mapper/renderer behavior changed in this phase.

## Success Criteria

- Dominant text overflow classes have named root causes and failing RED tests.
- Unknown parser/source-data gaps are explicit and do not become silent “allowed overflow.”
- Phase 03 has a bounded fix target based on top-count/impact buckets.

## Risk Assessment

- Risk: source PPTX parser lacks exact fit metadata. Mitigation: use DOM fit algorithm for imported text when source fit is unavailable.
- Risk: overfitting to 5 decks. Mitigation: tests use behavior classes, not deck names only.

## Security Considerations

- Diagnostics must not write raw unsafe HTML into Markdown without escaping.

## Next Steps

Use findings to implement imported text layout in Phase 03.
