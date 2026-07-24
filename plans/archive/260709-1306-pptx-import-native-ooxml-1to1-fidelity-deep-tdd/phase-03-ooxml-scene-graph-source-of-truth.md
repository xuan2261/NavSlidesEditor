---
phase: 3
title: "OOXML scene graph source of truth"
status: in-progress
priority: P0
effort: "5-10d"
dependencies: [1]
tdd: true
---

# Phase 3: OOXML scene graph source of truth

## Overview

Introduce an **OOXML scene graph** built from the ZIP package (presentation.xml, slideN.xml, rels, theme, master/layout stubs as available) as the **canonical inventory of objects**. Mapper must account for every graph node (map editable, or hard-fail classification). `pptxtojson` output becomes non-authoritative for counts/evidence.

## Requirements

### Functional
- `buildOoxmlSceneGraph(zip) → { slides: [{ index, nodes: [...] }], theme, masters, stats }`
- Node kinds at minimum: `shape`, `pic`, `graphicFrame` (table/chart/smartart), `cxnSp`, `grpSp`, `contentPart` (as unknown)
- Each node: `id`, `name`, `kind`, `xfrm` (off/ext/rot/flip if present), `ph` placeholder type if any, `rels` targets
- Expand beyond current `inspectOoxmlCoverage` (chart/smartArt paths only)
- Import pipeline attaches `stats.sceneGraph` + per-node mapping results
- **E1 fail mode:** any node without mapping result entry → import warning type `scene-graph-unmapped` **and** test gate fail for strict SLA mode (`PPTX_SLA_STRICT=1`)
- Group nodes either expand to children with depth limit or map as group — no silent drop

### Non-functional
- Parse with streaming/size caps; reuse zip already loaded in `validatePptxPackage`
- Pure functions unit-testable without worker
- Keep files under 200 LOC where possible (`ooxml-scene-graph/` split)

## Architecture

```
zip
  → presentation.xml slide id list
  → ppt/slides/slideN.xml spTree walk
  → ppt/slides/_rels/slideN.xml.rels
  → theme1.xml color scheme (basic)
  → optional: slideLayouts / slideMasters resolve placeholders (minimal in 03; full in 08)
→ SceneGraph
→ mapPptxOutput uses graph.nodes as checklist vs mapped elements
```

Compatibility: still call pptxtojson for content payloads initially; Phase 03 adds **inventory truth**. Later phases read more fields from graph/XML directly.

## Related Code Files

- Create:
  - `server/services/pptx-import/ooxml-scene-graph/index.js`
  - `server/services/pptx-import/ooxml-scene-graph/parse-sptree.js`
  - `server/services/pptx-import/ooxml-scene-graph/parse-rels.js`
  - `server/services/pptx-import/ooxml-scene-graph/*.test.js`
  - fixtures: minimal handcrafted zip or use corpus + expected node counts JSON
- Modify:
  - `importer.js` / `map-presentation.js` — attach graph + reconciliation
  - `ooxml-inspection.js` — delegate or keep as subset of graph stats
  - corpus tester — optional scene-graph coverage metric

## Tests (TDD) — RED first

| ID | Assert |
|----|--------|
| T3.1 | Fixture zip with 1 rect + 1 pic → graph nodes length 2, kinds correct |
| T3.2 | Group with 2 children → children listed (depth) |
| T3.3 | Chart rel on slide → graphicFrame/chart evidence node |
| T3.4 | SmartArt data rel → diagram evidence node |
| T3.5 | Path normalization rejects `../` targets |
| T3.6 | Reconciliation: mapped count < graph count → `scene-graph-unmapped` warning |
| T3.7 | `PPTX_SLA_STRICT=1` + unmapped → import throws or job fail type `schema-unusable` / `import-failed` (choose one; document) |
| T3.8 | Existing `inspectOoxmlCoverage` chart counts ≤ graph chart nodes (non-regression) |
| T3.9 | Corpus Bai_2_1: graph node count ≥ parser element count (invariant) |

## Implementation Steps

1. RED T3.1–T3.5 with minimal XML fixtures (string zip via JSZip in tests).
2. Implement spTree walker (namespace-tolerant).
3. Attach rels targets for blip/chart/diagram.
4. Wire into import after package validate.
5. Reconciliation pass after map.
6. Strict mode fail.
7. Snapshot expected counts for 1–2 corpus decks.

## Success Criteria

- [ ] Scene graph module + tests green
- [ ] Import stats include sceneGraph summary
- [ ] Strict mode fails on intentional unmapped fixture
- [ ] G0 + G1 green (semantic not regressed)
- [ ] Docs: architecture note that graph is truth for inventory

## Verify

```bash
npx vitest run server/services/pptx-import/ooxml-scene-graph server/services/pptx-import/ooxml-inspection --reporter=dot
npx vitest run server/services/pptx-import --reporter=dot
npm run test:corpus
```

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| XML namespaces mess | Use localName-oriented parse; fixtures from real decks |
| Performance large decks | Cap; only parse needed parts |
| Double work with pptxtojson | Accept until content fields move into graph phases |

## Definition of Done

Inventory truth exists; unmapped nodes visible and strict-failable. Content fidelity still later phases.
