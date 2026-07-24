---
phase: 1
title: "Regression Harness and Baseline"
status: completed
priority: P0
dependencies: []
---

# Phase 01: Regression Harness and Baseline

## Overview

Create common regression harness patterns for the six confirmed defects. This phase should not implement fixes, and it should not require one permanent all-defects-red commit; each implementation phase must still capture red evidence for its own defect immediately before fixing it.

## Requirements

- Functional: each D1-D6 defect has a planned targeted failing test, shared test utility, or documented current-state assertion that will become green after its phase.
- Non-functional: tests must be deterministic, scoped, and fast enough for local iteration.
- Non-functional: every red test must record command, failing assertion, defect mapping, and setup-noise exclusion in `reports/implementation-evidence.md`.

## Architecture

Use existing test locations and patterns. Prefer component tests for UI state, shared renderer tests for export HTML, and string-level srcDoc assertions for iframe runtime URLs.

## Related Code Files

- Modify: `shared/tests/markdown-reveal-textcolor-fontsize.test.js`
- Modify: `client/src/components/properties/table-properties.test.jsx`
- Create: `client/src/components/canvas/element-renderers/line-element-renderer.test.jsx`
- Modify: `client/src/components/ribbon/ribbon-format-tab-element-position-size-rotation-controls.test.jsx`
- Create: `client/src/components/canvas/element-renderers/qrcode-element-renderer.test.jsx`
- Modify: `client/src/components/canvas/element-renderers/latex-element-renderer.test.jsx`
- Create or modify: `client/src/components/canvas/element-renderers/chart-element-renderer.test.jsx`

## Implementation Steps

1. Add or draft D1 test: render a Markdown element with heading, list, link, and code under `{ forPrint: true }`; assert rendered tags exist and raw Markdown markers do not appear in visible output, not merely anywhere in source strings. Include negative payload fixtures for unsafe links, raw scripts, event handlers, and raw HTML.
2. Add D2 tests:
   - use a stateful wrapper that applies `onUpdate` back into the `element` prop.
   - focus last table cell, remove last row, rerender with updated data, change cell background, assert no throw and update targets clamped row.
   - focus last table cell, remove last column, rerender with updated data, change alignment, assert no throw and clamped column.
3. Add D3 test: render two `LineArrowRenderer` instances in the same DOM container with IDs sharing the same first 8 characters and different marker colors/types; assert all marker IDs are unique, DOM-safe, and marker URL references match generated IDs.
4. Add D4 test: render Format tab with custom width, e.g. `resolution={{ width: 1280, height: 720 }}`, align center/right, assert `x` is computed from 1280, not 960.
5. Add D5 tests: mock `QRCode.toDataURL` resolve once, then reject on rerender; assert stale image is cleared and fallback/error state appears. Add latest-request-wins race test with out-of-order resolve/reject.
6. Add D6 tests:
   - Chart srcDoc contains `/vendor/chart.js/dist/chart.umd.js` and does not contain `cdn.jsdelivr`.
   - LaTeX/TikZ srcDoc contains exact `/vendor/katex/dist/katex.min.css`, `/vendor/katex/dist/katex.min.js`, `/vendor/tikzjax/fonts.css`, and `/vendor/tikzjax/tikzjax.js` paths and does not contain `cdn.jsdelivr` or `tikzjax.com`.
   - Chart labels, dataset labels, and TikZ content containing `</script><script>window.__pwned=1</script>` are escaped safely.
7. Create or update `reports/implementation-evidence.md` with a per-defect table: defect ID, phase, command, expected red assertion, setup-noise exclusion, green command, final status.
8. For each red test, record command, failing assertion text, expected old-bug reason, and why failure is not selector/mock/import setup in that evidence file.

## Success Criteria

- [x] D1-D6 have either common harness coverage here or per-phase failing tests before fixes.
- [x] Failures are specific to the confirmed defects.
- [x] Red evidence includes command, assertion, defect mapping, and setup-noise exclusion.
- [x] `reports/implementation-evidence.md` exists with rows for D1-D6.
- [x] No `.skip`, `.only`, or permanent `.fails` remains.
- [x] Test additions follow existing import and mocking style.

## Risk Assessment

Risk: tests become too implementation-specific. Mitigation: assert user-visible/output contracts, not private React state, except where generated HTML string is the product surface.
