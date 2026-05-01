---
phase: 7
title: "Targeted Content Safety Without HTML Embed Regression"
status: completed
priority: P2
effort: "5h"
dependencies: [1, 5, 6]
---

# Phase 7: Targeted Content Safety Without HTML Embed Regression

## Context Links
- [Plan](./plan.md)
- `client/src/components/SlideCanvas.jsx`
- `client/src/components/SlidePanel.jsx`
- `client/src/components/TransitionPreview.jsx`
- `client/src/components/SlideSorterView.jsx`
- `shared/src/element-renderers.js`
- `shared/src/shapeUtils.js`

## Overview
Apply targeted safety to text, markdown, and SVG surfaces only. Preserve HTML embed scripts and custom interactive content.

## Key Insights
- Text/Markdown/SVG do not need arbitrary JS to serve their purpose.
- HTML embed does need arbitrary JS by design.
- Tests must prove both: unsafe non-HTML content blocked, HTML embed still runs.

## Requirements
- Functional: text preview strips event handlers and unsafe links but keeps TipTap formatting.
- Functional: markdown renderer/import blocks unsafe href and raw script/event handlers.
- Functional: SVG element blocks `<script>`, `<foreignObject>`, event attrs, unsafe href.
- Functional: shape text escapes plain text.
- Functional: HTML embed remains script-capable.
- Non-functional: avoid broad dependency churn if possible.

## Architecture
Add content-specific safety helpers:
- `client/src/utils/content-safety.js`
- `shared/src/content-safety.js` or duplicate minimal pure helper if shared cannot use browser DOM.

Policies:
- TipTap text allowlist: headings, paragraphs, spans, strong/em/u/s, lists, tables, links with safe href, inline style subset if already used.
- Markdown: generate HTML then sanitize markdown output only.
- SVG: parse or sanitize SVG with strict allowlist.
- HTML embed: no sanitizer; keep iframe behavior.

## Related Code Files
- Create: `client/src/utils/content-safety.js`
- Create/Modify: `shared/src/content-safety.js`
- Modify: `client/src/components/SlideCanvas.jsx`
- Modify: `client/src/components/SlidePanel.jsx`
- Modify: `client/src/components/TransitionPreview.jsx`
- Modify: `client/src/components/SlideSorterView.jsx` only if needed.
- Modify: `shared/src/element-renderers.js` only for text/markdown/svg/shape text, not html embed.
- Modify: `shared/src/shapeUtils.js`
- Modify tests:
  - `client/src/utils/content-safety.test.js`
  - `shared/tests/element-renderers.test.js` if present/create
  - `shared/tests/shapeUtils.test.js`
  - `tests/e2e/html-embed-regression.spec.js` if needed

## Implementation Steps
1. Define content policy constants.
2. Implement text/markdown sanitizer keeping existing formatting.
3. Implement SVG sanitizer with strict allowlist.
4. Escape shape text in `shapeUtils`.
5. Apply helpers:
   - `SlideCanvas` text/markdown/svg renderers.
   - `SlidePanel` text thumbnails.
   - `TransitionPreview` text interpolation.
   - shared text/markdown/svg/shape paths only.
6. Add explicit comments/tests: HTML embed intentionally trusted.
7. Do not change `renderHtml()` behavior except comments/docs.

## Todo List
- [x] Add content policy helper.
- [x] Patch text renderer paths.
- [x] Patch markdown renderer/import paths.
- [x] Patch SVG renderer paths.
- [x] Escape shape text.
- [x] Add HTML embed regression tests.

## Tests / Verification
- Unit:
  - text `<img onerror=...>` stripped in preview.
  - TipTap formatting remains.
  - markdown `[x](javascript:alert(1))` blocked.
  - raw markdown `<script>` blocked.
  - SVG `<script>`, `onload`, `foreignObject` blocked.
  - SVG path/rect/circle/fill/stroke remain.
  - shape text `<script>` renders as text, not markup.
- Regression:
  - HTML embed script still executes in iframe.
  - export/present path for HTML embed still includes script.
- Commands:
  - `npm run test -- client/src/utils/content-safety.test.js`
  - `npm run test -- shared/tests/shapeUtils.test.js shared/tests/element-renderers.test.js`
  - `npm run test:e2e -- tests/e2e/html-embed-regression.spec.js`
  - `npm run build`

## Success Criteria
- [x] Non-HTML content safety tests pass.
- [x] HTML embed regression tests pass.
- [x] No blanket sanitizer over full presentation.

## Risk Assessment
- Risk: sanitizer strips legitimate TipTap inline styles.
- Mitigation: start with current TipTap output samples; add fixtures.
- Risk: SVG allowlist too strict for user icons.
- Mitigation: include common SVG fixtures from existing app.

## Security Considerations
- Targeted safety only.
- Trusted HTML remains explicit accepted risk and core feature.

## Next Steps
- Phase 8 repairs broad test harness and load tests.
