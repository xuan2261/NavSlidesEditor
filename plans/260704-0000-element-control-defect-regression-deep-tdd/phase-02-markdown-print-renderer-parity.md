---
phase: 2
title: "Markdown Print Renderer Parity"
status: completed
priority: P1
dependencies: [1]
---

# Phase 02: Markdown Print Renderer Parity

## Overview

Make Markdown elements render consistently in print/PDF export by using rendered Markdown HTML instead of escaped raw Markdown text.

## Requirements

- Functional: `opts.forPrint` Markdown output renders headings, lists, links, emphasis, and fenced code as HTML.
- Non-functional: preserve existing content-safety expectations and avoid enabling arbitrary unescaped raw HTML beyond current Markdown renderer policy.
- Non-functional: keep shared rendering synchronous; do not use dynamic ESM imports inside `renderMarkdown()`.

## Architecture

`shared/src/element-renderers.js` is CommonJS and renders synchronously. The print branch must use a verified synchronous Markdown strategy: either a CommonJS-compatible parser entry that is proven by tests, an existing local helper that can be called synchronously, or a minimal scoped renderer for the Markdown features covered by tests. Do not use browser iframe runtime or dynamic `import('marked')` for print output.

## Related Code Files

- Modify: `shared/src/element-renderers.js`
- Modify: `shared/tests/markdown-reveal-textcolor-fontsize.test.js`
- Review: `client/src/components/canvas/element-renderers/markdown-element-renderer.jsx`
- Review: `client/src/utils/markdown-utils.js`

## Implementation Steps

1. Confirm Phase 01 D1 test fails because print output contains raw Markdown.
2. Record D1 red evidence in `reports/implementation-evidence.md`: command, failing assertion, old-bug reason, and setup-noise exclusion.
3. Select and document the synchronous parser strategy before implementation. If using `marked`, prove the import path works in CommonJS tests; otherwise implement a minimal sync helper for heading, list, link, emphasis, and fenced code test scope.
4. Add a targeted decision-gate test proving the selected parser/helper works synchronously in `shared/src/element-renderers.js` without dynamic ESM import or browser iframe runtime.
5. Keep print-specific wrapper styles: padding, color, font size, overflow, and line height.
6. Ensure generated output escapes or sanitizes according to existing shared renderer policy.
7. Extend tests with:
   - heading/list conversion.
   - link conversion with safe URL.
   - code fence conversion.
   - text color and font size still applied under print mode.
   - unsafe link such as `[x](javascript:alert(1))`.
   - raw `<script>`, `<img onerror=...>`, and inline raw HTML payloads.
   - visible-output assertion that avoids false failure from source-only occurrences.
8. Run targeted shared renderer tests and record green evidence in `reports/implementation-evidence.md`.

## Success Criteria

- [x] `forPrint` Markdown output contains rendered HTML tags for Markdown syntax.
- [x] Raw markers like `## Title` are not visible as escaped text for valid Markdown.
- [x] Unsafe Markdown/raw HTML payloads are sanitized or escaped per existing content-safety policy.
- [x] Renderer remains synchronous and does not depend on browser iframe runtime for print output.
- [x] D1 red/green evidence is recorded in `reports/implementation-evidence.md`.
- [x] Existing Markdown text color/font-size tests remain green.
- [x] No change to non-print Markdown export behavior unless tests prove parity improvement.

## Risk Assessment

Risk: parser behavior differs from client preview. Mitigation: use existing shared renderer dependency and add tests for common syntax only.
