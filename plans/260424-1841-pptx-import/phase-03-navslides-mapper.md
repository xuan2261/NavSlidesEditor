---
phase: 3
title: NavSlides Mapper
status: completed
effort: M
---

# Phase 3: NavSlides Mapper

## Context Links

- Shared schema: `shared/src/types/presentation.js`
- API schema: `server/middleware/schemas.js`
- Canvas renderers: `client/src/components/SlideCanvas.jsx`

## Overview

Map import model into the existing NavSlides presentation schema using fixed `960x540` canvas coordinates.

## Requirements

- Text -> editable `type: text`, sanitized HTML.
- Images -> `type: image`, `/uploads/...`, `objectFit: contain`.
- Shapes -> `shape` or `line`, preserve fill/stroke where available.
- Tables -> `type: table`, preserve dimensions and text.
- Unsupported chart/equation/OLE/SmartArt/complex groups -> locked placeholder.
- Preserve z-order and slide background color where available.

## Related Code Files

- Create: `server/services/pptx-import/mapper.js`
- Use: `server/services/pptx-import/media.js`

## Implementation Steps

1. Compute coordinate scale from source deck size to `960x540`.
2. Sort parser elements by PPTX order.
3. Map text with DOMPurify sanitation.
4. Map images after validated persistence.
5. Map basic shape/table objects.
6. Emit locked placeholder shapes for unsupported/fuzzy objects.
7. Validate mapped presentation with `createPresentationSchema`.

## Todo List

- [x] Coordinate scaling
- [x] Text sanitizer
- [x] Image mapper
- [x] Shape/line mapper
- [x] Table mapper
- [x] Placeholder policy

## Tests

- Text strips `<script>` and event handlers.
- Image produces upload URL and warning on missing media.
- Shape covers rectangle, ellipse/circle, line, arrow.
- Table preserves row/cell text.
- Unsupported objects become locked placeholders.
- Output passes `createPresentationSchema`.

## Success Criteria

- Phase 1 editable object types are returned as native NavSlides elements.
- Unsupported content remains visible as locked placeholders with warnings.

## Risk Assessment

- Shape taxonomy is broad. Mitigation: support common primitives and lock unclear cases.
- Rich text fidelity may be partial. Mitigation: sanitize and preserve safe inline styles.

## Security Considerations

- Sanitize HTML before sending client response.
- Never map active content into HTML/embed elements.

## Next Steps

- Wire mapped presentation into HomePage import flow.
