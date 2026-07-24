---
phase: 2
title: "Mermaid Diagram Authoring"
status: completed
priority: P1
effort: "2-4d"
dependencies: [1]
---

# Phase 02: Mermaid Diagram Authoring

## Overview

Add Mermaid as an `html` element mode. Do not use Markdown fences for MVP because the current Markdown renderer treats fences as static code.

## Requirements

- Functional: Insert/edit Mermaid source, preview diagram through `html` element metadata, export HTML, PPTX fallback warning.
- Non-functional: Keep canonical element count unchanged; handle parse errors without crashing.

## Architecture

Insert preset creates `type: 'html'` with `embedKind: 'mermaid'` and `mermaidSource`. Renderer generates trusted iframe content from source. Runtime is vendored through existing vendor/offline asset pattern. PPTX uses raster/placeholder fallback.

Vendoring/export contract:
- Add Mermaid dependency in the correct client/package workspace.
- Update `scripts/copy-vendor.js` to copy Mermaid runtime.
- Update offline export vendor/CDN resolution so exported offline HTML does not require network for Mermaid.
- Update server raster/background raster vendor mapping if PPTX fallback raster path needs Mermaid assets.
- Add tests proving offline HTML and PPTX raster/placeholder paths do not silently miss Mermaid runtime.

## Related Code Files

- Modify: `client/src/components/ribbon/ribbon-insert-tab-element-galleries-panel.jsx`
- Modify: `client/src/hooks/use-element-creation.js`
- Modify: `client/src/components/canvas/canvas-element-wrapper.jsx` or extracted HTML element renderer for Mermaid preview
- Modify: HTML edit/properties entry point for editing `mermaidSource`
- Modify: `shared/src/element-renderers.js`
- Modify: `scripts/copy-vendor.js` if vendoring Mermaid
- Modify: `client/src/utils/offlineExport.js`
- Modify: server raster/vendor mapping only if used by Mermaid PPTX fallback
- Test: renderer, export, insert, matrix tests

## Implementation Steps

1. Write failing insert + renderer tests for `html.embedKind = 'mermaid'`.
2. Write failing export tests for HTML render and PPTX warning.
3. Implement smallest viable Mermaid authoring path.
4. Add parse-error UI and source length guard.
5. Update matrix evidence.

## Success Criteria

- [x] User can insert Mermaid flowchart and edit `mermaidSource`.
- [x] Valid diagrams preview; invalid syntax shows an error.
- [x] HTML export renders with vendored Mermaid runtime.
- [x] PPTX export does not fail and emits structured warning.
- [x] Canonical element count remains 19.

## Risk Assessment

Risk: vendor asset size. Mitigation: measure bundle/vendor size in phase; if unacceptable, stop and update this plan before switching to online-only.
