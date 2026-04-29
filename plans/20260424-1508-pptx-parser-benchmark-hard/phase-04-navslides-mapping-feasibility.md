# Phase 4: NavSlides Mapping Feasibility

## Context Links

- Plan: [plan.md](./plan.md)
- Parser matrix: [phase-03-parser-execution-matrix.md](./phase-03-parser-execution-matrix.md)
- NavSlides model: `shared/src/types/presentation.js`
- Element factory: `client/src/utils/element-factory.js`

## Overview

Priority: P0  
Status: Complete  
Goal: score parser outputs by how safely they can become NavSlides editable elements.

## Key Insights

- User decision: fidelity first. Uncertain objects become locked placeholder/snapshot.
- Phase 1 import target: text, image, shape, table editable.
- TODO after benchmark: increase editable object coverage.

## Requirements

- Define a mapper feasibility rubric before choosing a parser.
- Score per candidate and per object type.
- Identify exact mapper functions needed for the winner.

## Architecture

```text
parser output
  -> candidate-specific adapter
  -> PowerPointIntermediateModel
  -> NavSlides mapper feasibility score
```

## Intermediate Model Draft

```js
{
  source: { parser, deckName, slideIndex },
  size: { width, height },
  slides: [{
    id,
    background,
    notes,
    elements: [{
      sourceRef,
      kind,
      bounds: { x, y, width, height, rotation },
      style,
      content,
      mediaRef,
      fallbackReason,
    }],
  }],
  assets: [],
  warnings: [],
}
```

## Mapping Rubric

| Object | Target | Required data | Fallback |
| --- | --- | --- | --- |
| Text box | `text` | x/y/w/h, HTML/runs, color, font size, align | image placeholder if rich style unusable |
| Image | `image` | x/y/w/h, media data/ref, crop, rotation | locked image if crop/style partial |
| Shape | `shape` or `svg` | geometry, fill, stroke, opacity, text | SVG/image placeholder for unsupported shape |
| Line/connector | `line` | endpoints or bounds, stroke, arrowheads | shape/image placeholder |
| Table | `table` | rows, cols, cell text, widths/heights, borders | locked image placeholder |
| Chart | placeholder TODO | chart type/data if available | locked image/unsupported placeholder |
| Equation | placeholder TODO | math text if available | locked image/unsupported placeholder |
| OLE | placeholder TODO | preview image/ref if available | locked unsupported placeholder |

## Scoring

Score 0-5 per parser:

| Score | Meaning |
| --- | --- |
| 0 | Cannot parse or output unusable |
| 1 | Text only |
| 2 | Text/images with weak positioning |
| 3 | Text/images/shapes usable |
| 4 | Text/images/shapes/tables usable |
| 5 | Above plus reliable styles/layout/media |

Weighted criteria:

| Criterion | Weight |
| --- | --- |
| Slide count correctness | 10 |
| Text editability | 20 |
| Image extraction | 15 |
| Shape mapping | 15 |
| Table mapping | 15 |
| Style/layout fidelity | 15 |
| Mapper complexity | 10 |

## Related Code Files

- Future importer file: `client/src/utils/pptx-import/intermediate-model.js`
- Future importer file: `client/src/utils/pptx-import/map-text.js`
- Future importer file: `client/src/utils/pptx-import/map-image.js`
- Future importer file: `client/src/utils/pptx-import/map-shape.js`
- Future importer file: `client/src/utils/pptx-import/map-table.js`
- Future importer file: `client/src/utils/pptx-import/fallback-policy.js`

## Implementation Steps

1. For each parser, select 5 representative output objects:
   - one text element
   - one image
   - one shape with fill/stroke
   - one table
   - one unsupported object
2. Draft candidate adapter pseudocode.
3. Score data availability for each target element.
4. Identify lost data:
   - missing bounds
   - missing rich text runs
   - missing media refs
   - missing theme colors
   - missing layout/master elements
5. Produce scorecard and mapper complexity notes.

## Todo List

- [x] Define intermediate model final fields.
- [x] Score all 4 parsers by weighted rubric.
- [x] Identify winner and fallback parser.
- [x] List mapper files needed for implementation plan.
- [x] List unsupported object TODO backlog.

## Success Criteria

- Recommendation is based on weighted evidence, not intuition.
- Winning parser supports text, image, shape, and table mapping enough for Phase 1 import.
- Unsupported object policy is explicit.

## Risk Assessment

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Best parser still misses tables/groups | High | Pick hybrid semantic+raw strategy |
| Mapper becomes too broad | High | Limit Phase 1 to agreed editable types |
| Fidelity conflicts with editability | High | Fidelity wins; fallback when uncertain |

## Security Considerations

- Sanitize imported HTML content before rendering through TipTap.
- Validate media MIME before upload/persistence.

## Next Steps

- Phase 5 makes the decision and hands off implementation planning.
