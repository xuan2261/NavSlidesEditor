# Research: Three PPTX Import Gaps -- Shadow, Image Filters, Diagram Connectors

**Author:** researcher subagent
**Date:** 2026-05-01
**Files consulted:** `server/services/pptx-import/mapper.js`, `shared/src/element-renderers.js`, `shared/src/types/presentation.js`, `node_modules/pptxtojson/src/shadow.js`, `node_modules/pptxtojson/src/diagram.js`, `node_modules/pptxtojson/dist/index.d.ts`, `server/services/pptx-import/pptx-import-semantic-and-roundtrip-fidelity-tester.js`, `server/services/pptx-import/mapper.test.js`

---

## Gap 1: Shadow Extraction

### Current state

pptxtojson emits a `Shadow` interface (`index.d.ts:1-6`):

```typescript
export interface Shadow {
  h: number     // horizontal offset (points)
  v: number     // vertical offset (points)
  blur: number  // blur radius (points)
  color: string
}
```

Both `Shape` (`index.d.ts:67`) and `Text` (`index.d.ts:93`) include `shadow?: Shadow`. Image elements do NOT carry shadow per the type definitions -- shadow on images is not standardized in pptxtojson.

In `mapper.js`, **`mapShape()`** (line 402-473) never reads `element.shadow`. It extracts fill, stroke, strokeWidth, shape type, text, textInsets, fillGradient -- no shadow. **`mapElement()`** text branch (line 502-518) also never reads `element.shadow`. **`mapImage()`** (line 227-295) reads no shadow. **`baseElement()`** (line 162-170) extracts id, box, rotation, opacity, zIndex -- no shadow.

`shared/src/types/presentation.js:30` defines `BaseElement.shadow` as `Object` -- schema is present but mapper never populates it.

`shared/src/element-renderers.js:46-49` reads shadow from **flat fields**, not the nested object:

```javascript
function buildBaseStyle(el, opts = {}) {
  const shadowStyle =
    el.shadowBlur || el.shadowX || el.shadowY
      ? `box-shadow:${el.shadowX || 0}px ${el.shadowY || 0}px ${el.shadowBlur || 0}px ${el.shadowColor || 'rgba(0,0,0,0.5)'};`
      : ''
```

The renderer's `box-shadow` CSS uses: `shadowX` (h), `shadowY` (v), `shadowBlur`, `shadowColor`. The pptxtojson source uses: `h`, `v`, `blur`, `color`. **These names do not match.**

### What's missing

- Mapper never reads `element.shadow` from shape or text elements.
- Even if it did, the nested-object schema (`shadow.h`) doesn't match the flat field names the renderer expects (`shadowX`, `shadowY`, `shadowBlur`, `shadowColor`).

### Fix

**Two options:**

**Option A (schema-consistent):** store shadow as the pptxtojson nested object and update renderer to read it. More correct but touches both mapper and renderer.

**Option B (renderer-consistent):** expand mapper to flatten the nested shadow into flat NavSlides fields the renderer already handles. Less invasive -- only touches mapper.

Option B is recommended since `buildBaseStyle` already works.

**`mapShape()` -- add after `fillGradient` block (around line 469-471):**

```javascript
// Shadow: flatten pptxtojson Shadow { h, v, blur, color } into flat fields
if (element.shadow && typeof element.shadow === 'object') {
  const s = element.shadow
  if (s.blur != null) mapped.shadowBlur = s.blur
  if (s.h != null)    mapped.shadowX  = s.h
  if (s.v != null)    mapped.shadowY  = s.v
  if (s.color)        mapped.shadowColor = s.color
}
```

**`mapElement()` text branch -- add inside the text object before `return [text]` (around line 516-518):**

```javascript
// Shadow
if (element.shadow && typeof element.shadow === 'object') {
  const s = element.shadow
  if (s.blur != null) text.shadowBlur   = s.blur
  if (s.h != null)    text.shadowX      = s.h
  if (s.v != null)    text.shadowY      = s.v
  if (s.color)        text.shadowColor   = s.color
}
```

TypeScript users of `types/presentation.js` should update `BaseElement` comment to reflect the flat-field shadow sub-schema (or keep as `Object` for looseness).

### Effort

**SMALL.** Two insertion points in `mapper.js`, ~12 lines total. No renderer changes. No test fixtures needed -- add a shadow test case to `mapper.test.js` using the existing fixture pattern.

---

## Gap 2: Image Filter Extraction (brightness/contrast/saturation/sharpen)

### Current state

pptxtojson `Image` interface (`index.d.ts:131-137`):

```typescript
filters?: {
  sharpen?: number
  colorTemperature?: number
  saturation?: number
  brightness?: number
  contrast?: number
}
```

Values are PPTX fixed-point integers (typically 0-100 range for brightness/contrast).

`mapper.js` -- `mapImage()` (line 227-295) reads: src, fillMode, altText, flipH/V, borderColor, borderWidth, rect/crop, opacity -- **never reads `element.filters`**. No filter property is extracted.

`shared/src/element-renderers.js` -- `renderImage()` (line 76-96) already applies CSS filters using NavSlides flat field names:

```javascript
const imgFilterParts = [
  el.filterBrightness != null && el.filterBrightness !== 100
    ? `brightness(${el.filterBrightness}%)`
    : '',
  el.filterContrast != null && el.filterContrast !== 100
    ? `contrast(${el.filterContrast}%)`
    : '',
  el.filterGrayscale ? `grayscale(${el.filterGrayscale}%)` : '',
]
```

The renderer handles `filterBrightness`, `filterContrast`, `filterGrayscale` -- but these are never set by the mapper.

`types/presentation.js:47-49` ImageElement JSDoc already documents `brightness?: number`, `contrast?: number`, `grayscale?: number` -- **schema is correct, implementation is missing**.

### What's missing

- `mapImage()` never reads `element.filters` from pptxtojson output.
- pptxtojson `brightness`/`contrast` values need scaling to CSS percentage (e.g., pptx value 15000 / 1000 = 150 -> `filterBrightness: 150`).
- `saturation` from pptx maps to CSS `saturate()` filter (not yet handled in renderer; needs addition or maps to `filterGrayscale` equivalently -- saturation loss is unavoidable without renderer update).
- `sharpen` has no CSS equivalent; drop with a warning.

### Fix

**In `mapImage()` (after the border block, around line 256):**

```javascript
// Image filters: brightness, contrast, grayscale
// PPTX fixed-point values need scaling (e.g. 15000 / 1000 = 15 -> 15%)
const rawFilters = element.filters
if (rawFilters) {
  if (rawFilters.brightness != null) {
    img.filterBrightness = Math.round(Number(rawFilters.brightness) / 1000)
  }
  if (rawFilters.contrast != null) {
    img.filterContrast = Math.round(Number(rawFilters.contrast) / 1000)
  }
  if (rawFilters.saturation != null) {
    // No NavSlides filterSaturation field -- store as grayscale approximation
    // for fidelity reporting; full saturation filter needs renderer update
    const sat = Math.round(Number(rawFilters.saturation) / 1000)
    if (sat === 0) img.filterGrayscale = 100
    else if (sat < 100) img._pptxImportMeta = {
      ...(img._pptxImportMeta || {}),
      pptxSaturation: sat,
    }
  }
  if (rawFilters.sharpen != null) {
    context.warnings.push({
      slideIndex: context.slideIndex,
      type: 'image-filter-unsupported',
      message: `Image sharpen filter cannot be expressed in CSS -- skipped`,
    })
  }
}
```

**Optional renderer enhancement** (not required for basic fix): add `filterSaturate` to `renderImage()` in element-renderers.js for full saturation support. Skip for YAGNI -- only add if a real PPTX file with saturation is observed.

### Effort

**SMALL.** ~20 lines in `mapImage()`. No renderer changes needed for basic brightness/contrast. Add one fixture to `mapper.test.js`.

---

## Gap 3: Diagram SmartArt Connectors and Arrows

### Current state

`flattenDiagramElement()` (`mapper.js:631-693`):

```javascript
// Line 651-658: connectors/arrows are detected but only produce a warning
const connectors = element.connectors || element.arrows || []
if (connectors.length > 0) {
  context.warnings.push({
    slideIndex: context.slideIndex,
    type: 'diagram-connectors',
    message: `Diagram has ${connectors.length} connector(s) -- preserved as shapes`,
  })
}
// Lines 660-690: only nodes[i] are converted to shape elements
// connectors array is never iterated
```

The `connectors`/`arrows` detection is misleading -- `pptxtojson/dist/index.d.ts:256-265` `Diagram` interface does NOT define `connectors` or `arrows` fields:

```typescript
export interface Diagram {
  type: 'diagram'
  left: number
  top: number
  width: number
  height: number
  elements: (Shape | Text)[]  // connectors are Shape-type elements inside here
  textList: string[]
  order: number
}
```

Connectors in SmartArt are shape-type elements (typically with `shapType: 'line'` or `'straightconnector'`) that appear inside `diagram.elements`. They are processed as regular shapes by `mapShape()` (which handles `shape === 'line'` and emits a `type: 'line'` element with arrow markers) -- but only if they are in the top-level element list. When flattened from a diagram, they land in the same `nodes` array as node shapes.

**The real problem:** `flattenDiagramElement()` iterates `nodes[i]` and creates shape elements for all of them indiscriminately. When a connector shape is in `diagram.elements`, it is treated as a node with `type: 'shape'` and `shape: shapeName(node.shape || node.shapType || 'rect')`. For a connector (`shapType: 'line'`), `shapeName()` returns `'line'` correctly -- but the shape is wrapped as `type: 'shape'` not `type: 'line'`, losing the line rendering.

```javascript
// Line 682: always type: 'shape' -- wrong for connector nodes
results.push({
  ...
  type: 'shape',
  shape: shapeName(node.shape || node.shapType || 'rect'),
  ...
})
```

The `renderShape()` renderer does not render lines -- only `renderLine()` does (element-renderers.js:293-331).

### What's missing

1. `flattenDiagramElement()` does not distinguish connector nodes from content nodes. All nodes become `type: 'shape'` -- connectors rendered via `renderShape` produce no visible line.
2. The pptxtojson `Diagram` type should be updated to reflect `connectors` and `arrows` fields if they exist in practice (different pptxtojson versions or pptx2json fallback may emit them).
3. Even without connectors/arrows top-level fields, diagram shapes of `shapType: 'line'` should be mapped as `type: 'line'` NavSlides elements.

### Fix

**In `flattenDiagramElement()` -- replace the node loop body (lines 660-690) with connector-aware logic:**

```javascript
for (let i = 0; i < maxNodes; i++) {
  const node = nodes[i]
  context.zIndex += 1

  const nodeText = textList[i]?.text || node.text || node.content || ''
  const sanitizedText = plainText(nodeText)
  const nodeX = readCoord(element.left, element.x, 0) + readCoord(node.left, node.x, (i * boxWidth) / maxNodes)
  const nodeY = readCoord(element.top, element.y, 0) + readCoord(node.top, node.y, 0)

  // Detect connector/arrow nodes: they are Shape-type with line-like shapType
  // or have explicit x1/y1/x2/y2 geometry (connector convention)
  const normShapType = String(node.shapType || node.shape || '').toLowerCase()
  const isConnector = (
    normShapType.includes('connector') ||
    normShapType === 'line' ||
    normShapType.includes('straight')
  )

  if (isConnector) {
    // Map connector to a NavSlides line element
    const x1 = readNumber(node.x1 ?? node.left, nodeX)
    const y1 = readNumber(node.y1 ?? node.top, nodeY)
    const x2 = readNumber(node.x2 ?? (nodeX + 100), nodeX + 100)
    const y2 = readNumber(node.y2 ?? (nodeY + 0), nodeY)
    results.push({
      id: uuidv4(),
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      width: Math.max(1, Math.abs(x2 - x1)),
      height: Math.max(1, Math.abs(y2 - y1)),
      rotation: readNumber(node.rotate, 0),
      opacity: typeof node.opacity === 'number' ? node.opacity : 1,
      zIndex: context.zIndex,
      type: 'line',
      x1: Math.round(x1 * context.scale.x),
      y1: Math.round(y1 * context.scale.y),
      x2: Math.round(x2 * context.scale.x),
      y2: Math.round(y2 * context.scale.y),
      stroke: colorValue(node.borderColor, '#111827'),
      strokeWidth: Math.max(1, readNumber(node.borderWidth, 2)),
      arrowStart: arrowMarker(node.beginArrowType || node.arrowStart || node.startArrowType),
      arrowEnd:   arrowMarker(node.endArrowType   || node.arrowEnd   || node.endArrowType),
    })
    continue
  }

  // Content node -> shape
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
```

Also update the pptxtojson `Diagram` type definition in `index.d.ts` (or a local override) to document connectors/arrows:

```typescript
export interface Diagram {
  type: 'diagram'
  left: number
  top: number
  width: number
  height: number
  elements: (Shape | Text)[]
  textList: string[]
  order: number
  // Optional: some pptxtojson versions/patches emit these
  connectors?: (Shape & { x1?: number; y1?: number; x2?: number; y2?: number })[]
  arrows?: (Shape & { x1?: number; y1?: number; x2?: number; y2?: number })[]
}
```

The `connectors`/`arrows` warning code (lines 651-658) can remain as a fallback for non-standard pptxtojson versions -- but the primary fix is handling connector shapes within `elements[]`.

### Effort

**MEDIUM.** ~50 lines refactor in `flattenDiagramElement()`. Requires understanding of how pptxtojson emits diagram shapes (line-type elements vs. box-type elements). Add connector test fixture to `mapper.test.js` and verify `renderLine` handles the resulting elements correctly.

---

## Summary Matrix

| Gap | Schema supports it? | Mapper reads it? | Renderer handles it? | Effort |
|-----|---------------------|-------------------|---------------------|--------|
| Shadow on shapes/text | Yes (BaseElement.shadow) | **No** | Yes (flat fields) | SMALL |
| Image filters | Yes (ImageElement.brightness/contrast) | **No** | Yes (filterBrightness/Contrast) | SMALL |
| Diagram connectors | Partially (Shape has line type) | Partially (wrong type emitted) | Yes (renderLine) | MEDIUM |

## Unresolved Questions

1. **Shadow on images:** pptxtojson does not define `shadow` on its `Image` interface. Does PowerPoint actually store drop shadow on image elements separately from the containing shape? If so, what field name does pptxtojson use? Needs a real PPTX file with a shadowed image to verify.
2. **pptxtojson version variance:** The `connectors`/`arrows` top-level fields on `Diagram` may only appear in pptx2json fallback output, not the primary pptxtojson parser. Needs testing against real SmartArt PPTX files from both parsers.
3. **Diagram connector coordinate system:** When a SmartArt connector shape appears in `diagram.elements`, are its coordinates in absolute slide units or relative to the diagram bounding box? The fix assumes absolute slide units -- may need adjustment.
4. **Saturation CSS filter:** The renderer does not support a saturation filter. Should `filterSaturate` be added to `renderImage()` for completeness, or is this out-of-scope?
