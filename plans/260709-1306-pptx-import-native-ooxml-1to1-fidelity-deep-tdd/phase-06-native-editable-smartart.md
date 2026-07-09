---
phase: 6
title: "Native editable SmartArt"
status: pending
priority: P1
effort: "5-12d"
dependencies: [3, 4]
tdd: true
---

# Phase 6: Native editable SmartArt

## Overview

SmartArt/diagram OOXML evidence imports as **editable structure** (not permanent raster, not silent flatten-only without data). Minimum: editable text per node + stable layout positions; structure edits (add/remove node) for supported layouts. `smartArtCoverageGapCount === 0`.

## Requirements

### Functional
- Parse `ppt/diagrams/data*.xml` (+ layout/drawing as needed)
- Map to either:
  - **Preferred:** dedicated `diagram` element type with node model, **or**
  - Group of shapes with `_pptxDiagram` model enabling re-edit of node text and regenerate layout
- Must remain editable after import (change node text → save → reload)
- `native-smartart-degraded` warnings = 0 on `diagram-process-flow.pptx` and corpus decks with smartArt evidence
- Scene graph diagram nodes all mapped
- Visual SSIM region/deck milestone ≥ 0.98 for diagram fixture when LO present

### Non-functional
- Unsupported complex layouts: **fail strict** until implemented — list in `docs` as open SLA debt, not “OK degrade”
- Keep file size discipline: `map-diagram.js` split if growing

## Architecture

```
diagrams/data.xml  → tree model { nodes: [{ id, text, children }] }
layout algorithm   → positions (initial: use drawing.xml positions if present)
→ Nav elements with _pptxSource.diagramId
```

If introducing new canonical element type `diagram`: update `element-defaults.js` + registry + tests + README count guard.

## Related Code Files

- Modify: `mapper/map-diagram.js`, `map-presentation.js`, `ooxml-inspection.js`
- Create: `ooxml-diagram-parser.js` + tests
- Possibly: client diagram renderer / properties
- Corpus: `diagram-process-flow.pptx`

## Tests (TDD) — RED first

| ID | Assert |
|----|--------|
| T6.1 | Parse data.xml fixture → N text nodes |
| T6.2 | Import diagram-process-flow → no smartArt coverage gap |
| T6.3 | Node text present in editable fields (shape.text / diagram.nodes) |
| T6.4 | Mutate node text in unit model → serializes |
| T6.5 | No permanent placeholder type for smartArt nodes |
| T6.6 | Warning `native-smartart-degraded` absent |
| T6.7 | Oracle milestone phase-06 on diagram fixture |

## Implementation Steps

1. RED T6.1–T6.3.
2. OOXML diagram parser.
3. Replace lossy flatten with model-preserving map.
4. Client edit path for node text (minimal).
5. Strict gap = 0 enforcement.
6. Docs + element-defaults if new type.

## Success Criteria

- [ ] E3 = 0 on corpus
- [ ] Editable node text round-trips JSON
- [ ] T6.* + G0/G1 green
- [ ] README/element count updated if new type

## Verify

```bash
npx vitest run server/services/pptx-import/mapper/map-diagram.test.js server/services/pptx-import/ooxml-diagram-parser.test.js --reporter=dot
npm run test:corpus
npm run test:pptx:oracle -- --milestone phase-06 --only diagram-process-flow.pptx
```

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Layout algorithms proprietary | Prefer drawing.xml absolute positions first |
| New element type cost | Start with annotated shape group + model sidecar |
| Scope explosion | Support process/list layouts first; others fail strict |

## Definition of Done

SmartArt inventory fully mapped to editable representation; gap metric zero.
