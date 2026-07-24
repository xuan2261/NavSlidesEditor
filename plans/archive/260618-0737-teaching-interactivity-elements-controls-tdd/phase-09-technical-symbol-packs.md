---
phase: 9
title: "Technical Symbol Packs"
status: completed
priority: P2
effort: "1-2d"
dependencies: [1]
---

# Phase 09: Technical Symbol Packs

## Overview

Add curated UML, network, circuit, and cloud symbol packs using existing `svg`, `icon`, and `shape` elements.

## Requirements

- Functional: User can browse and insert technical symbols.
- Non-functional: No new symbol element type; sanitize SVG payloads.

## Architecture

Add a small symbol pack data module and Insert/Advanced gallery. Selecting a symbol inserts an existing element type with preset content/style. Export follows existing SVG/icon/shape policies, but SVG pack payloads must be sanitized consistently across canvas, shared HTML export, and PPTX raster/data-URI fallback.

## Related Code Files

- Modify: `client/src/components/ribbon/ribbon-insert-tab-element-galleries-panel.jsx`
- Modify: `client/src/hooks/use-element-creation.js`
- Create: `client/src/data/technical-symbol-packs.js`
- Test: gallery insert, SVG sanitizer coverage, export policy

## Implementation Steps

1. Write failing gallery tests for pack/category visibility.
2. Write failing insertion tests for SVG/icon/shape outputs.
3. Add curated small symbol dataset.
4. Verify sanitizer path for SVG symbols across canvas, shared HTML export, and PPTX fallback.
5. Update matrix if any new user-facing controls are added.

## Success Criteria

- [x] Four packs visible.
- [x] Inserted symbol is an existing editable element.
- [x] SVG symbols pass sanitizer tests for all render/export sinks.
- [x] No new canonical element.

## Risk Assessment

Risk: asset bloat. Mitigation: start with a small curated set; expand later through packs.
