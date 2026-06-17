# Phase 04 Text Content And Embed Element Controls

## Context Links

- `C:/Work/NavSlidesEditor/client/src/components/ribbon/controls/ribbon-text-formatting-controls.jsx`
- `C:/Work/NavSlidesEditor/client/src/components/properties/code-properties.jsx`
- `C:/Work/NavSlidesEditor/client/src/components/properties/misc-properties.jsx`
- `C:/Work/NavSlidesEditor/client/src/components/properties/chart-properties.jsx`
- `C:/Work/NavSlidesEditor/shared/src/element-renderers.js`

## Overview

Priority: P1
Status: Completed
Goal: verify and harden text, code, markdown, HTML, LaTeX, and chart controls across UI, canvas, HTML export, and PPTX policy.

## Key Insights

- Text controls are mostly TipTap; test at command and persisted HTML level.
- Code border radius may be visually partial because wrapper/pre radius interaction needs proof.
- HTML embeds intentionally preserve scripts; security model is trusted author content.
- Chart type options differ between Format and Properties (`scatter` mismatch).

## Requirements

Functional:
- Verify rich text commands update selected text element and survive reload.
- Verify code modal, language, font size, border radius.
- Verify markdown content, color, font size.
- Verify HTML and LaTeX modals save/cancel correctly.
- Define HTML embed trust boundary for editor preview, imported decks, shared links, offline export, and PPTX fallback.
- Fix or document chart type option mismatch.
- Verify chart data, series, area fill, stacked.

Non-functional:
- Preserve trusted HTML embed policy.
- Do not sanitize away author-intended HTML/JS in HTML element.
- Do not mark HTML embed `works` without boundary evidence or an explicit accepted-risk policy row.
- Keep modal tests focused; avoid full visual snapshots unless needed.

## Architecture

```text
TipTap / Modal / Properties / Format tab
  -> element content fields
  -> canvas inline/iframe/renderers
  -> shared element-renderers
  -> PPTX native or fallback/raster
```

## Related Code Files

Tests:
- `C:/Work/NavSlidesEditor/tests/e2e/canvas/text-rich-formatting.spec.js`
- `C:/Work/NavSlidesEditor/client/src/components/properties/code-properties.test.jsx`
- `C:/Work/NavSlidesEditor/client/src/components/properties/markdown-controls.test.jsx`
- `C:/Work/NavSlidesEditor/client/src/components/EditorModals.test.jsx`
- `C:/Work/NavSlidesEditor/client/src/components/properties/chart-properties.test.jsx`
- `C:/Work/NavSlidesEditor/shared/tests/element-renderers.test.js`

Potential source:
- `C:/Work/NavSlidesEditor/client/src/components/canvas/canvas-element-wrapper.jsx`
- `C:/Work/NavSlidesEditor/client/src/components/properties/code-properties.jsx`
- `C:/Work/NavSlidesEditor/client/src/components/properties/misc-properties.jsx`
- `C:/Work/NavSlidesEditor/client/src/components/properties/chart-properties.jsx`
- `C:/Work/NavSlidesEditor/client/src/components/ribbon/ribbon-format-tab-element-position-size-rotation-controls.jsx`
- `C:/Work/NavSlidesEditor/shared/src/element-renderers.js`
- `C:/Work/NavSlidesEditor/client/src/utils/export-pptx-basic-renderers.js`

## Tests First

1. E2E: create text, apply bold/color/font size, reload, assert sanitized persisted HTML contains marks.
2. Unit/RTL: code language/font size/border radius controls update element.
3. Canvas render test: code border radius is visible/effective or matrix marks `partial`.
4. RTL: markdown content/color/font size update element and shared HTML uses them.
5. Modal tests: HTML/LaTeX/Code save and cancel paths.
6. HTML boundary tests or policy checks: editor preview iframe attributes, import/share/export warning behavior, and explicit same-origin/non-goal documentation if scripts can access app-origin APIs.
7. Chart controls parity test: same supported type set or explicit intentional split.
8. Shared renderer tests: chart `areaFill`, `stacked`, markdown sanitization, HTML trusted script preservation.

Commands:

```bash
npm run test -- client/src/components/EditorModals.test.jsx
npm run test -- client/src/components/properties/chart-properties.test.jsx
npm run test -- shared/tests/element-renderers.test.js
npx playwright test tests/e2e/canvas/text-rich-formatting.spec.js
```

## Implementation Steps

1. Write tests for text formatting persistence.
2. Add focused RTL tests for code/markdown/chart properties.
3. Fix chart type mismatch:
   - Option A: remove `scatter` from Format until supported in Properties/PPTX.
   - Option B: add `scatter` to Properties and export handling.
   Recommendation: Option A unless full scatter support already exists.
4. Verify code border radius; fix inner `<pre>` radius if visual test fails.
5. Ensure HTML trusted policy, active-content warning, and execution boundary are documented in matrix rows.
6. Update statuses and evidence links.

## Todo List

- [x] Text rich formatting E2E.
- [x] Code properties tests.
- [x] Markdown properties tests.
- [x] Modal save/cancel tests.
- [x] HTML embed trust-boundary policy/tests.
- [x] Chart type parity fix.
- [x] Matrix update.

## Progress Notes

- Reused the existing text rich-formatting Playwright spec as Phase 04 evidence for seeded rich text render, insert, bold/italic, font family, and alignment persistence.
- Added code property coverage for language, font size, and border radius, plus direct CodeEditorModal save/cancel/language/theme coverage.
- Added markdown property coverage for content, text color, and font size; retained shared/canvas markdown style export evidence.
- Added HTML editor trusted-author warning coverage while preserving the product policy that active HTML/JS is trusted author content, not blanket-sanitized.
- Added LaTeX modal save/cancel coverage and retained renderer/export fallback policy evidence.
- Fixed chart type parity by removing unsupported `scatter` from the Format tab and adding Properties/Format tests for the shared supported chart type set.
- Updated matrix rows for text, code, markdown, HTML, LaTeX, and chart controls with concrete Phase 04 evidence and accepted PPTX/fallback limits.

## Success Criteria

- Text/content rows only say `works` when UI and render evidence exist.
- Chart type list no longer contradicts itself.
- HTML embed rows mention trusted author policy, active-content warning, and any same-origin/editor boundary limitations.
- PPTX fallback/export gaps for content elements are explicit.

## Risk Assessment

- Risk: text E2E brittle due TipTap selection.
  Mitigation: use keyboard shortcuts and stable editor focus helpers.
- Risk: over-scoping chart support.
  Mitigation: normalize UI to supported set first.

## Red Team Review Applied

- Finding 8: HTML script preservation is not enough evidence; rows need explicit boundary or accepted-risk policy.
- Finding 5 security overlap: imported/shared/offline active content must surface a trust warning or documented non-goal before being certified.

## Security Considerations

<!-- Updated: Validation Session 1 - trusted HTML security scope is warning/test/doc focused; sandbox/CSP/runtime redesign is out of scope for this plan. -->

- Keep targeted sanitization for text/markdown/svg.
- Preserve trusted HTML embed scripts by design; do not create false XSS blocker.
- If current product keeps same-origin script capability, record it as trusted-author accepted risk and add tests/docs proving users are warned at import/export/share boundaries.
- Do not broaden this phase into runtime hardening unless the current implementation contradicts the trusted-author policy or leaks editor/admin capability across a trust boundary.

## Next Steps

Phase 05 covers structured, vector, and data-heavy elements.
