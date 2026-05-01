---
phase: 5
title: "Diagram Connector Preservation — Detect Line-type Shapes Inside diagram.elements[]"
status: pending
priority: P2
effort: ~4h
dependencies: []
---

# Phase 5: Diagram Connector Preservation — Detect Line-type Shapes Inside diagram.elements[]

## Overview

Cải thiện `flattenDiagramElement()` để preserve connectors/arrows giữa SmartArt nodes. **pptxtojson Diagram type KHÔNG có `connectors[]`/`arrows[]` fields.** Connectors là Shape-type elements bên trong `diagram.elements[]` với `shapType` dạng line.

## Red Team Fixes Applied
- **[FIX #7]** pptxtojson Diagram type KHÔNG define `connectors[]`/`arrows[]` — loop trên các arrays này lúc nào cũng `[]`. Phải detect connector nodes bên TRONG `diagram.elements[]`.
- **[FIX #8]** Process nodes FIRST, THEN connectors — z-index correct (nodes in front, connectors behind)
- **[FIX #17]** Reuse `arrowMarker()` pattern (mapper.js:152-160) cho connector arrow detection thay vì tự viết regex mới.

## Context Links
- Research: `plans/reports/researcher-260501-shadow-filters-diagram.md` (Gap 3)
- Mapper: `server/services/pptx-import/mapper.js` (`flattenDiagramElement()`, lines ~631-693)
- Types: `shared/src/types/presentation.js` (line element schema)
- Renderer: `shared/src/element-renderers.js` (`renderLine()`)
- Arrow utils: `mapper.js:152-160 (`arrowMarker()` function — reuse this)

## Requirements
- Functional: Connector arrows giữa SmartArt nodes được preserve bằng cách detect line-type elements trong `diagram.elements[]`
- Non-functional: Nodes FIRST, connectors SECOND (z-index). Arrow detection reuse `arrowMarker()`.

## Related Code Files
- Modify: `server/services/pptx-import/mapper.js` — rewrite `flattenDiagramElement()`

## Implementation Steps

### 1. Rewrite flattenDiagramElement

File: `server/services/pptx-import/mapper.js`, thay thế hoàn toàn `flattenDiagramElement()`:

```js
// pptxtojson Diagram interface: { elements: (Shape|Text)[], textList: string[], order: number }
// KHÔNG có connectors[] hoặc arrows[] — connectors nằm trong elements[] với shapType dạng line

function flattenDiagramElement(element, context) {
  const results = []
  const nodes = element.elements || []
  const textList = element.textList || []

  if (!nodes.length) {
    context.warnings.push({ slideIndex: context.slideIndex, type: 'diagram-empty', message: 'Empty diagram' })
    return []
  }

  const boxWidth = readNumber(element.width, 300, 0)
  const boxHeight = readNumber(element.height, 200, 0)
  const diagramLeft = readCoord(element.left, element.x, 0)
  const diagramTop = readCoord(element.top, element.y, 0)

  // Limit to 50 nodes
  const maxNodes = Math.min(nodes.length, 50)
  if (nodes.length > 50) {
    context.warnings.push({ slideIndex: context.slideIndex, type: 'diagram-truncated', message: `Diagram has ${nodes.length} nodes, using first 50` })
  }

  // Separate connector nodes (line-type shapes) from box nodes
  const isConnectorNode = (node) => {
    const s = String(node.shapType || '').toLowerCase()
    return s.includes('line') || s.includes('connector') || s.includes('straight')
  }

  // [FIX #8] Process BOX nodes FIRST (higher z-index), then connectors (lower z-index)
  for (let i = 0; i < maxNodes; i++) {
    const node = nodes[i]
    if (isConnectorNode(node)) continue // skip connectors in this pass

    context.zIndex += 1
    const nodeText = textList[i]?.text || node.text || node.content || ''
    const sanitizedText = plainText(nodeText)
    const nodeX = diagramLeft + readCoord(node.left, node.x, (i * boxWidth) / maxNodes)
    const nodeY = diagramTop + readCoord(node.top, node.y, 0)

    results.push({
      id: uuidv4(),
      x: Math.round(nodeX * context.scale.x),
      y: Math.round(nodeY * context.scale.y),
      width: Math.max(1, Math.round(readNumber(node.width, boxWidth / maxNodes, 0) * context.scale.x)),
      height: Math.max(1, Math.round(readNumber(node.height, boxHeight / 3, 0) * context.scale.y)),
      rotation: readNumber(node.rotate, 0),
      opacity: typeof node.opacity === 'number' ? node.opacity : 1,
      zIndex: context.zIndex,
      type: 'shape',
      shape: shapeName(node.shape || node.shapType || 'rect'),
      fill: colorValue(node.fill, '#e5e7eb'),
      stroke: colorValue(node.borderColor, 'none'),
      strokeWidth: node.borderWidth || 0,
      text: sanitizedText,
      textColor: '#111827',
    })
  }

  // [FIX #7] Process CONNECTOR nodes SECOND — detect line-type shapes inside elements[]
  // pptxtojson Diagram KHÔNG có connectors[] — connectors nằm trong elements[] với shapType dạng line
  for (let i = 0; i < maxNodes; i++) {
    const node = nodes[i]
    if (!isConnectorNode(node)) continue // only process connectors here

    context.zIndex += 1

    // Extract endpoints: use x1/y1/x2/y2 if available, else infer from node geometry
    let cx1 = node.x1 ?? node.left ?? 0
    let cy1 = node.y1 ?? node.top ?? 0
    let cx2 = node.x2 ?? (node.left ?? 0) + (node.width ?? 100)
    let cy2 = node.y2 ?? (node.top ?? 0) + (node.height ?? 10)

    // Map to canvas coordinates
    const mappedX1 = Math.round((diagramLeft + cx1) * context.scale.x)
    const mappedY1 = Math.round((diagramTop + cy1) * context.scale.y)
    const mappedX2 = Math.round((diagramLeft + cx2) * context.scale.x)
    const mappedY2 = Math.round((diagramTop + cy2) * context.scale.y)

    // [FIX #17] Reuse arrowMarker() helper từ mapper.js:152-160
    const normType = String(node.shapType || '').toLowerCase()
    const arrowEnd = arrowMarker(normType)
    const arrowStart = normType.includes('triangle') || normType.includes('diamond')
      ? arrowMarker(normType.replace(/end|start/gi, ''))
      : 'none'

    results.push({
      id: uuidv4(),
      x1: mappedX1,
      y1: mappedY1,
      x2: mappedX2,
      y2: mappedY2,
      rotation: 0,
      opacity: typeof node.opacity === 'number' ? node.opacity : 1,
      zIndex: context.zIndex,
      type: 'line',
      stroke: colorValue(node.borderColor, '#6b7280'),
      strokeWidth: Math.max(1, readNumber(node.borderWidth, 2)),
      dashArray: node.borderStrokeDasharray || undefined,
      arrowStart,
      arrowEnd,
    })
  }

  return results
}
```

## Success Criteria
- [ ] Diagram `elements[]` được iterate để detect connector nodes (KHÔNG loop trên `connectors[]`/`arrows[]` không tồn tại)
- [ ] Box nodes (rect, ellipse, etc.) → `type: 'shape'` — xử lý trước
- [ ] Connector nodes (line, connector, straight*) → `type: 'line'` — xử lý sau (z-index thấp hơn)
- [ ] Arrow markers reuse `arrowMarker()` helper
- [ ] No crash khi nodes array rỗng

## Risk Assessment
- **Risk:** pptxtojson không emit any line-type shapes trong SmartArt → **Mitigation:** Code gracefully handles 0 connectors, warning logged.
- **Risk:** Connector x1/y1/x2/y2 không có trong node data → **Mitigation:** Fallback to infer từ `left/top/width/height`.
- **Risk:** Coordinate system cho connectors không rõ → **Mitigation:** Test với real SmartArt PPTX file để verify coordinate frame. Log actual values trong development.
