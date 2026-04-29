---
phase: 3
title: "Port Server-Specific Renderers to server/utils"
status: completed
priority: P1
effort: 8h
dependencies: ["2"]
---

# Phase 3: Port Server-Specific Renderers to server/utils

## Overview

Port production renderers từ `client/src/utils/` sang `server/utils/` với CommonJS syntax. Rasterization dùng Playwright server-side, reuse `server/services/pptx-exporter.js` where valid, and add dedicated background/asset raster support. **Effort 8h** because official target is ≥98 and rasterized backgrounds are mandatory.

## Requirements

- Functional: Tất cả element types export được từ server with production-equivalent behavior
- Functional: Background gradients/images and rasterizable complex visual types are rasterized, not text/color placeholder fallback
- Non-functional: Dùng Playwright rasterization đã có where valid, plus Node-safe `/uploads` and vendor asset resolution

## Architecture

```
server/utils/
├── server-export.js              ← entry point (uses pptxgenjs + shared + server utils)
├── server-background.js          ← port: export-pptx-background.js (server raster)
├── server-renderers.js          ← port: export-pptx-renderers.js
├── server-basic-renderers.js   ← port: export-pptx-basic-renderers.js
├── server-fallback.js           ← port: export-pptx-fallback-renderer.js
├── server-image-source.js       ← Node resolver for /uploads, data URIs, local paths
├── server-background-raster.js  ← dedicated Playwright background rasterization
└── server-raster.js            ← wrapper for html/latex + complex visual rasterization

Key insight: server/services/pptx-exporter.js đã có Playwright rasterization
cho html/latex element IDs. It does not rasterize backgrounds; dedicated background raster path required.
```

## Related Code Files

- Create: `server/utils/server-export.js`
- Create: `server/utils/server-background.js`
- Create: `server/utils/server-renderers.js`
- Create: `server/utils/server-basic-renderers.js`
- Create: `server/utils/server-fallback.js`
- Create: `server/utils/server-image-source.js`
- Create: `server/utils/server-background-raster.js`
- Create: `server/utils/server-raster.js`
- Read: `client/src/utils/export-pptx-*.js` (5 files)
- Read: `server/services/pptx-exporter.js` — Playwright rasterization

## Implementation Steps

### Step 1: Create server-raster.js (rewrite)

Wrapper gọi `pptx-exporter.js` for existing `html`/`latex`, and adds a server-owned raster path for other static visual complex elements. Do not assume `pptx-exporter.js` covers backgrounds or non-`html`/`latex`; current collector filters to `RASTER_TYPES = html|latex`.

```js
// server/utils/server-raster.js
const { rasterizeComplexElements } = require('../services/pptx-exporter')
const { rasterizeStaticVisualElement } = require('./server-background-raster')

const rasterCache = new Map()
const SERVER_NATIVE_TYPES = new Set(['text', 'image', 'shape', 'line', 'table', 'chart', 'code', 'callout'])
const EXISTING_SERVICE_TYPES = new Set(['html', 'latex'])
const STATIC_VISUAL_TYPES = new Set(['icon', 'drawing', 'markdown', 'qrcode', 'svg'])

async function getServerRasters(presentation, { baseUrl = '' } = {}) {
  const cacheKey = JSON.stringify({
    id: presentation?.id,
    slideCount: presentation?.slides?.length,
    elementCount: presentation?.slides?.flatMap(s => s.elements || []).length,
  })
  if (rasterCache.has(cacheKey)) return rasterCache.get(cacheKey)
  const rasters = await rasterizeComplexElements(presentation, { baseUrl })
  for (const slide of presentation?.slides || []) {
    for (const element of slide.elements || []) {
      if (!element?.id || SERVER_NATIVE_TYPES.has(element.type) || EXISTING_SERVICE_TYPES.has(element.type)) continue
      if (!STATIC_VISUAL_TYPES.has(element.type)) continue
      rasters[element.id] = await rasterizeStaticVisualElement(element, { baseUrl })
    }
  }
  rasterCache.set(cacheKey, rasters)
  return rasters
}

module.exports = { getServerRasters }
```

### Step 2: Create server-image-source.js

Client `normalizeImageSource()` returns `{ path: src }`. In Node this breaks for imported images because importer stores `/uploads/<file>`, which resolves to filesystem root. Server must resolve local asset paths explicitly.

```js
// server/utils/server-image-source.js
const path = require('path')
const { UPLOADS_DIR } = require('../services/storage')

function normalizeServerImageSource(src) {
  if (!src) return null
  const raw = String(src)
  if (raw.startsWith('data:')) return { data: raw }
  if (raw.startsWith('/uploads/')) return { path: path.join(UPLOADS_DIR, path.basename(raw)) }
  if (path.isAbsolute(raw)) return { path: raw }
  return { path: path.resolve(raw) }
}

module.exports = { normalizeServerImageSource }
```

### Step 3: Create server-basic-renderers.js

Port 8 renderer functions từ `export-pptx-basic-renderers.js`:

```js
// server/utils/server-basic-renderers.js
const pptxgen = require('pptxgenjs')
const {
  normalizeCssColor,
  getShapeType,
  mapLineDashType,
  mapArrowType,
  htmlToPptTextRuns,
} = require('revealjs-shared')
const { normalizeServerImageSource } = require('./server-image-source')

exports.addTextElement = function(slide, element, bounds) {
  // Ported: htmlToPptTextRuns() preserves bold/italic/font/color
}

exports.addImageElement = function(slide, element, bounds) {
  // normalizeServerImageSource() handles /uploads/* in Node
}

exports.addShapeElement = function(slide, element, bounds) {
  // getShapeType() maps 15+ shape types — NOT just ellipse/rect
}

exports.addLineElement = function(slide, element, bounds) {
  // mapLineDashType() + mapArrowType() — real coords, not bounding box
}

exports.addTableElement = function(slide, element, bounds) {
  // mergedCells + cellStyles — NOT just plain rows
}

exports.addChartElement = function(slide, element, bounds) {
  // pptxgenjs.addChart() works server-side
}

exports.addCodeElement = function(slide, element, bounds) { }
exports.addCalloutElement = function(slide, element, bounds) { }
```

### Step 4: Create server-renderers.js

Port dispatcher từ `export-pptx-renderers.js` — async để hỗ trợ raster lookup:

```js
// server/utils/server-renderers.js
const {
  addTextElement,
  addImageElement,
  addShapeElement,
  addLineElement,
  addCodeElement,
  addCalloutElement,
  addTableElement,
  addChartElement,
} = require('./server-basic-renderers')
const { addFallbackElement } = require('./server-fallback')
const { scaleElementBounds } = require('revealjs-shared')

exports.addElementToPptxSlide = async function({
  slide, element, resolution, layout, pptx, warnings,
  slideNumber, rasterOverrides = {}
}) {
  const bounds = scaleElementBounds(element, resolution, layout)
  const rasterData = element?.id ? rasterOverrides[element.id] : null
  if (rasterData) {
    slide.addImage({ data: rasterData, ...bounds })
    return
  }
  switch (element.type) {
    case 'text':    addTextElement(slide, element, bounds); break
    case 'image':   addImageElement(slide, element, bounds, resolution, layout); break
    case 'shape':   addShapeElement(slide, element, bounds); break
    case 'line':    addLineElement(slide, element, bounds, resolution, layout); break
    case 'table':   addTableElement(slide, element, bounds); break
    case 'chart':   addChartElement(slide, element, bounds, pptx); break
    case 'code':    addCodeElement(slide, element, bounds); break
    default:        await addFallbackElement(slide, element, bounds, warnings, slideNumber); break
  }
}
```

### Step 5: Create server-background.js

Port `export-pptx-background.js`, but do not use `getServerRasters()` for gradients. Current `pptx-exporter.js` only rasterizes element IDs and returns `{}` for background-only slides. Use dedicated `rasterizeBackground()` that renders a slide-sized background layer with Playwright and returns a PNG data URI.

```js
// server/utils/server-background.js
const { rasterizeBackground } = require('./server-background-raster')
const { normalizeServerImageSource } = require('./server-image-source')

exports.applySlideBackground = async function(slide, sourceSlide, resolution, layout, options = {}) {
  const { baseUrl = '', strictRaster = true } = options
  const bg = sourceSlide?.background
  if (!bg) return
  if (bg.type === 'color') {
    slide.background = { color: pptColor(bg.color) }
  } else if (bg.type === 'image') {
    const image = normalizeServerImageSource(bg.image || bg.src)
    if (!image) throw new Error('Background image source missing')
    slide.background = image
  } else if (bg.type === 'gradient') {
    const data = await rasterizeBackground(bg, resolution, { baseUrl })
    if (!data && strictRaster) throw new Error('Gradient background rasterization failed')
    if (!data) return
    slide.background = { data }
  }
}
```

### Step 6: Create server-fallback.js

Fallback renderer — rasterize complex visual element. Text placeholder is allowed only for true non-static media (`audio`/`video`) or hard failure in `--allow-fallback` development mode; strict corpus validation must fail on rasterizable visual fallback.

```js
// server/utils/server-fallback.js
// html/latex via server-raster; icon/drawing/markdown/qrcode/svg via static raster.
// Do not silently placeholder rasterizable visual types in strict mode.
```

### Step 7: Create server-export.js (entry point)

```js
// server/utils/server-export.js
const pptxgen = require('pptxgenjs')
const { getPresentationResolution, getPptxLayout, getSlideNotes } = require('revealjs-shared')
const { applySlideBackground } = require('./server-background')
const { addElementToPptxSlide } = require('./server-renderers')
const { getServerRasters } = require('./server-raster')

async function exportToFile(presentation, filePath, options = {}) {
  const { baseUrl = 'http://127.0.0.1:3002' } = options
  const pptx = new pptxgen()
  const resolution = getPresentationResolution(presentation)
  const layout = getPptxLayout(resolution)
  pptx.defineLayout({ name: 'NAVSLIDES', width: layout.width, height: layout.height })
  pptx.layout = 'NAVSLIDES'
  pptx.title = presentation?.title || 'Presentation'

  const rasterOverrides = await getServerRasters(presentation, { baseUrl })

  for (const [si, sourceSlide] of (presentation?.slides || []).entries()) {
    const slide = pptx.addSlide()
    await applySlideBackground(slide, sourceSlide, resolution, layout, { baseUrl, strictRaster: true })
    const elements = [...(sourceSlide.elements || [])].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
    for (const element of elements) {
      await addElementToPptxSlide({ slide, element, resolution, layout, pptx, rasterOverrides, slideNumber: si + 1, warnings: [] })
    }
    const notes = getSlideNotes(sourceSlide)
    if (notes) slide.addNotes(notes)
  }

  await pptx.writeFile({ fileName: filePath })
}

module.exports = { exportToFile }
```

### Step 8: Verify

```bash
node -e "
const { exportToFile } = require('./server/utils/server-export')
exportToFile({ title: 'Test', slides: [{ elements: [{ type: 'text', content: '<strong>Hi</strong>', x: 0, y: 0, width: 200, height: 50 }] }] }, '/tmp/test.pptx')
  .then(() => console.log('OK'))
  .catch(e => console.error(e))
"
```

## Success Criteria

- [x] All 8 server utils created in `server/utils/`
- [x] Entry point exports `exportToFile(presentation, filePath)`
- [x] `/uploads/*` image paths resolve to `server/uploads/*`
- [x] Gradient/image backgrounds rasterize or export as images in strict mode
- [x] Shape types: NOT just ellipse/rect — 15+ types via getShapeType()
- [x] Table: merged cells preserved
- [x] Line: arrow types + dash types
- [x] Text: HTML formatting via htmlToPptTextRuns()
- [x] html/latex rasterized via Playwright (pptx-exporter.js)
- [x] icon/drawing/markdown/qrcode/svg rasterized as static visual elements
- [x] chart exports natively; if native chart unsupported, raster fallback required in strict mode
- [x] Test export produces valid PPTX file

## Risk Assessment

- **Risk:** getNativeChartDefinition() in shared — pptxgenjs.addChart() works server-side, verify
- **Risk:** Raster cache never cleared — use presentation hash key and clear between corpus files/tests
- **Risk:** Background raster depends on vendor assets/baseUrl — prefer file-system vendor resolution; strict mode fails if unavailable
- **Risk:** chart/icon/drawing/markdown/qrcode/svg not rasterized — fails official target; do not document as acceptable limitation for strict validation
- **Risk:** ESM→CJS conversion errors — test each module individually
