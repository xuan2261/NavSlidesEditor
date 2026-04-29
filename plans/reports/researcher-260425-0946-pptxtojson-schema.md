# Research Report: pptxtojson Output Schema

**Repository:** [pipipi-pikachu/pptxtojson](https://github.com/pipipi-pikachu/pptxtojson) | v2.0.2
**Sources:** TypeScript definitions (`dist/index.d.ts`), 20 source modules, README

---

## 1. Top-Level Output Structure

```js
{
  slides: Slide[],
  themeColors: string[],       // hex: ['#4472C4', '#ED7D31', ...]
  usedFonts: string[],         // embedded font typefaces
  size: { width: number, height: number }  // in EMU * 72/914400 = pt
}
```

All numeric length values in output use `pt` (points) units. Conversion factor: `1 EMU = 72/914400 pt`.

---

## 2. Fill System (shared across Slide, Shape, Text, Image)

Four fill types, returned as discriminated union:

```js
// Type 1: Solid color
{ type: 'color', value: string }           // e.g. '#FF0000' or '#FF0000A1' (with alpha)

// Type 2: Image fill
{ type: 'image', value: {
    ref: string,       // file path
    base64: string,    // data URI (if imageMode includes base64)
    blob: string,     // blob URL (if imageMode includes blob)
    opacity: number    // 0-1
  }
}

// Type 3: Gradient
{ type: 'gradient', value: {
    path: 'line' | 'circle' | 'rect' | 'shape',
    rot: number,      // rotation angle in degrees
    colors: { pos: string, color: string }[]  // pos is 0-100% stop position
  }
}

// Type 4: Pattern
{ type: 'pattern', value: {
    type: string,              // e.g. 'pct5', 'horz', 'diagCross'
    foregroundColor: string,
    backgroundColor: string
  }
}
```

Color resolution chain: `a:srgbClr` → `a:schemeClr` (resolved via theme) → `a:scrgbClr` → `a:sysClr` → `a:hslClr` → `a:prstClr`. Supports modifiers: `alpha`, `hueMod`, `lumMod`, `lumOff`, `satMod`, `shade`, `tint`.

---

## 3. Border (shared across Shape, Text, Image)

```js
{
  borderColor: string,              // hex, e.g. '#1F4E79'
  borderWidth: number,             // in pt (EMU/12700)
  borderType: 'solid' | 'dashed' | 'dotted',
  borderStrokeDasharray: string    // CSS dash array, '0' = solid
}
```

Dash mapping:
| XML value | borderType | strokeDasharray |
|---|---|---|
| `solid` | solid | `0` |
| `dash` | dashed | `5` |
| `dashDot` | dashed | `5, 5, 1, 5` |
| `dot` | dotted | `1, 5` |
| `lgDash` | dashed | `10, 5` |
| `lgDashDotDot` | dotted | `10, 5, 1, 5, 1, 5` |
| `sysDash` | dashed | `5, 2` |
| `sysDashDot` | dotted | `5, 2, 1, 5` |
| `sysDashDotDot` | dotted | `5, 2, 1, 5, 1, 5` |
| `sysDot` | dotted | `2, 5` |

---

## 4. Shadow

```js
{ h: number, v: number, blur: number, color: string }
// h/v = offset in pt; blur = blur radius in pt; color = hex
```

Direction (`dir`) is stored as EMU angle, divided by 60000, then converted via `sin`/`cos`.

---

## 5. Element Types

### 5a. Shape (`type: 'shape'`)

```js
{
  type: 'shape',
  left: number, top: number, width: number, height: number,  // in pt
  borderColor: string, borderWidth: number,
  borderType: string, borderStrokeDasharray: string,
  shadow?: Shadow,
  fill: Fill,
  content: string,             // HTML string (may be '' if no text)
  isFlipV: boolean, isFlipH: boolean,
  rotate: number,              // in degrees
  shapType: string,            // 'rect'|'roundRect'|'ellipse'|'triangle'|...
  vAlign: string,              // 'mid'|'down'|'up'
  path?: string,               // SVG path `d` attribute (for custom shapes)
  keypoints?: Record<string, number>,  // adjustment values, /50000
  name: string,
  order: number,                // z-index (slide order)
  autoFit?: { type: 'shape' } | { type: 'text', fontScale?: number },
  link?: string                // hyperlink URL
}
```

**shapType values** (from `identifyShape` + preset shapes in `getShapePath`): `rect` | `roundRect` | `ellipse` | `triangle` | `rhombus` | `parallelogram` | `trapezoid` | `pentagon` | `hexagon` | `heptagon` | `octagon` | `custom`. Additionally, `getShapePath` handles: `line`, `straightConnector`, `bentConnector`, `curvedConnector`, `pie`, `pieNoMoon`, `pieHalf`, `pieQuarter`, `donut`, `noSmoking`, `homePlate`, `squareStack`, `plus`, `flowChartProcess`, `flowChartDecision`, `flowChartTerminator`, `flowChartData`, `flowChartPredefinedProcess`, `internalStorage`, `flowChartMultidocument`, `flowChartDisplay`, `flowChartDelay`, `flowChartPreparation`, `flowChartManualOperation`, `flowChartManualInput`, `flowChartConnector`, `flowChartOffpageConnector`, `callout`, `heart`, `lightningBolt`, `sun`, `moon`, `arc`, `bracket`, `leftBracket`, `rightBracket`, `brace`, `leftBrace`, `rightBrace`, `gear6`, `gear9`, `funnel`, `stroke1` through `stroke9`, and more.

### 5b. Text (`type: 'text'`)

```js
{
  type: 'text',
  left, top, width, height: number,          // in pt
  borderColor, borderWidth, borderType, borderStrokeDasharray: string|number,
  shadow?: Shadow,
  fill: Fill,
  isFlipV: boolean, isFlipH: boolean,
  isVertical: boolean,           // true if bodyPr.vert === 'eaVert'
  rotate: number,                // text rotation (may differ from shape rotation)
  content: string,              // HTML rich text (always present for text elements)
  vAlign: string,               // 'mid'|'down'|'up'
  name: string,
  order: number,
  autoFit?: AutoFit,
  link?: string
}
```

**Distinction shape vs text:** If a shape has valid text and `shapType === 'rect'`, returned as `type: 'text'`. If no text, returned as `type: 'shape'` with `content: ''`. Custom shapes always return `type: 'shape'`.

### 5c. Image (`type: 'image'`)

```js
{
  type: 'image',
  left, top, width, height, rotate: number,
  ref: string,           // file path in zip
  base64: string,        // data URI (imageMode: base64/both)
  blob: string,          // blob URL (imageMode: blob/both)
  isFlipH: boolean, isFlipV: boolean,
  order: number,
  rect?: { t?: number, b?: number, l?: number, r?: number },  // crop ratios (0-1000 -> 0-1)
  geom: string,          // 'rect' or shape name or 'custom:<shapeName>'
  borderColor, borderWidth, borderType, borderStrokeDasharray: string|number,
  filters?: {
    sharpen?: number, colorTemperature?: number,
    saturation?: number, brightness?: number, contrast?: number
  },
  link?: string
}
```

### 5d. Table (`type: 'table'`)

```js
{
  type: 'table',
  left, top, width, height: number,
  order: number,
  data: TableCell[][],           // 2D array [row][col]
  borders: {                    // whole-table outer borders
    top?: Border, bottom?: Border,
    left?: Border, right?: Border
  },
  rowHeights: number[],          // in pt
  colWidths: number[]            // in pt
}
```

**TableCell structure:**
```js
{
  text: string,                  // HTML rich text
  rowSpan?: number, colSpan?: number,  // merge cells
  vMerge?: number, hMerge?: number,   // merge continuation
  fillColor?: string, fontColor?: string,
  fontBold?: boolean,
  vAlign: string,                // 'mid'|'down'|'up'
  borders: {
    top?: Border, bottom?: Border,
    left?: Border, right?: Border
  }
}
```

Table style cascade: cell-level → row style → whole-table style. Border fallbacks resolve through this hierarchy. Banding (alternating row colors) is computed but `fillColor` is reset for banded rows (merged into a single style).

### 5e. Chart (`type: 'chart'`)

Two distinct shapes:

```js
// CommonChart (all types except scatter/bubble)
{
  type: 'chart',
  left, top, width, height: number,
  order: number,
  data: ChartItem[],             // array of series
  colors: (string | null)[],    // hex colors per series
  chartType: ChartType,          // 15 possible values
  barDir?: 'bar' | 'col',       // bar chart direction
  marker?: boolean,              // line chart marker
  holeSize?: string,            // doughnut chart inner radius %
  grouping?: string,            // e.g. 'clustered', 'stacked', 'percentStacked'
  style?: string                // scatter/radar style
}

// ScatterChart
{
  type: 'chart',
  left, top, width, height: number,
  order: number,
  data: [number[], number[]],   // [x-values], [y-values] parallel arrays
  colors: (string | null)[],
  chartType: 'scatterChart' | 'bubbleChart'
}

// ChartItem (for multi-series charts)
{
  key: string | number,         // series name
  values: { x: string, y: number }[],
  xlabels: { [idx: string]: string }
}
```

**ChartType values:**
`lineChart` | `line3DChart` | `barChart` | `bar3DChart` | `pieChart` | `pie3DChart` | `doughnutChart` | `areaChart` | `area3DChart` | `scatterChart` | `bubbleChart` | `radarChart` | `surfaceChart` | `surface3DChart` | `stockChart`

### 5f. Video (`type: 'video'`)

```js
{
  type: 'video',
  left, top, width, height: number,
  rotate: number,
  ref: string,          // file path (for video links: external URL)
  blob: string,         // blob URL (only if videoMode: 'blob')
  order: number
}
```

### 5g. Audio (`type: 'audio'`)

```js
{
  type: 'audio',
  left, top, width, height: number,
  ref: string,          // file path
  blob: string,         // blob URL (only if audioMode: 'blob')
  order: number
}
```

### 5h. Math/Formula (`type: 'math'`)

```js
{
  type: 'math',
  left, top, width, height: number,
  latex: string,        // converted LaTeX source
  picRef: string,       // fallback image reference
  picBase64: string,   // fallback image as data URI
  picBlob: string,     // fallback image as blob URL
  text: string,        // HTML fallback text (may be '')
  order: number
}
```

Math conversion: OMML (Office Math Markup Language) → LaTeX via custom parser. Supports: fractions, superscript/subscript, radicals, matrices, n-ary operators, limits, delimiters, functions, group characters, cases/arrays, bars, accents, border boxes.

### 5i. Diagram/SmartArt (`type: 'diagram'`)

```js
{
  type: 'diagram',
  left, top, width, height: number,
  elements: (Shape | Text)[],  // nested shape/text elements from drawing
  textList: string[],          // ordered list of all text content
  order: number
}
```

### 5j. Group (`type: 'group'`)

```js
{
  type: 'group',
  left, top, width, height: number,  // group bounding box in pt
  rotate: number,
  order: number,
  isFlipH: boolean, isFlipV: boolean,
  elements: BaseElement[]     // nested elements with adjusted positions
}
```

Child element coordinates are relative to the group's internal coordinate system, scaled by `width/chWidth` and `height/chHeight`, then converted to absolute positions.

---

## 6. Slide Object

```js
{
  fill: Fill,                   // slide background
  elements: Element[],          // slide-level elements
  layoutElements: Element[],     // elements inherited from layout/master
  note: string,                 // speaker notes as HTML string
  transition?: {
    type: string,               // e.g. 'blinds', 'fade', 'checker', 'none'
    duration: number,           // milliseconds
    direction: string | null,   // direction attribute or null
    autoNextAfter?: number     // ms; present if advClick='0'
  } | null
}
```

**Transition resolution:** Checks three XML paths in order: `p:transition` → `mc:AlternateContent/mc:Choice/p:transition` → `mc:AlternateContent/mc:Fallback/p:transition`. Duration defaults to 1000ms; speed keywords (`slow`→1000ms, `med`→800ms, `fast`→500ms). Duration from `p14:dur` or effect node's `dur` attribute overrides defaults.

---

## 7. Theme, Layout, and Master Information

### Theme Colors

```js
themeColors: string[]  // first 6 accent colors from theme: accent1-accent6
// e.g. ['#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5', '#70AD47']
```

Resolved from `a:themeElements > a:clrScheme > a:accent1` through `a:accent6` as `#RRGGBB`.

### Used Fonts

```js
usedFonts: string[]  // from ppt/presentation.xml > p:embeddedFontLst
```

### Slide Size

```js
size: { width: number, height: number }  // in pt (converted from EMU)
```

### Layout Elements

Elements from the slide's layout and master that contribute to background/fill are captured in `slide.layoutElements`. These are elements with `source: 'slideLayoutBg' | 'slideMasterBg' | 'themeBg' | 'diagramBg'`.

---

## 8. Text Formatting (HTML Output in `content`)

Text is converted to HTML. Each paragraph `<p>` or list item `<li>` gets inline styles for alignment and spacing. Each text run `<span>` gets CSS properties:

| CSS property | Source |
|---|---|
| `color` | font color, or gradient object → `linear-gradient` on parent span |
| `font-size` | font size in `XXpt` |
| `font-family` | typeface |
| `font-weight` | `'bold'` if bold |
| `font-style` | `'italic'` if italic |
| `text-decoration` | `'underline'` or `'line-through'` |
| `text-decoration-line` | (separate) |
| `letter-spacing` | character spacing |
| `vertical-align` | `'sub'` | `'super'` for subscript/superscript |
| `text-shadow` | `Xpt Ypt blur color` from outer shadow |
| `background` | gradient for gradient text |

List items: `<ul>` (bullet) or `<ol>` (numbered), nested by level. Tabs → `&nbsp;&nbsp;&nbsp;&nbsp;`. Whitespace → `&nbsp;`. Hyperlinks rendered as `<a href="..." target="_blank">` wrapping the span.

**Font size format:** `'XXpt'` string (not a number). **Spacing format:** `'NNpt'` string for absolute, `'NNem'` for em-based.

### Paragraph Alignment Values

| Raw XML | Output CSS |
|---|---|
| `l` | `left` |
| `r` | `right` |
| `ctr` | `center` |
| `just` | `justify` |
| `dist` | `justify` |
| (absent) | `inherit` |

---

## 9. What pptxtojson Does NOT Capture

The following data is present in OOXML but not extracted by pptxtojson:

### 9a. Animations (element-level)
- Entrance/exit animations on individual elements
- Motion paths (animations tied to specific shapes)
- Timing, triggers, and animation order
- Only slide-level **transition** is captured; per-element **animation** is not

### 9b. Inter-element Relationships
- Z-order beyond `order` field (no group/layer concept)
- Connection lines and anchor points between shapes
- SmartArt internal layout algorithm parameters
- OLE embedded object data (only the fallback group node is captured)

### 9c. Text Formatting Incompleteness
- **Letter spacing value** is captured but not returned as a typed field — only embedded in the HTML `letter-spacing` string
- **Line spacing exact value**: returned as `lineSpacing` in paragraph spacing object; when it's a percentage or `auto`, the raw numeric value is not separately surfaced
- **Indent levels**: captured internally for list resolution but not as explicit fields on elements
- **Character scaling** (`a:spcPct`, `a:spcPts`)
- **Kerning** (`a:kern`)

### 9d. Table Completeness
- **Table style name** (`tblStyleId`) is used for resolution but not output
- **First-row / last-row / first-col / last-col** banding flags are used but not output
- **Cell margin** (internal padding) not captured
- **Cell diagonal** borders not captured

### 9e. Chart Completeness
- **Axis titles**, axis labels, and legend data
- **Data labels** on individual points
- **Chart title** and subtitle
- **Plot area** background fill
- **3D chart** depth and rotation parameters
- **Trend lines**, error bars, series lines
- Chart is **read-only** — no edit semantics, only data

### 9f. Image Completeness
- **Original filename** is lost (only internal zip path captured as `ref`)
- **Crop offsets** in EMUs (the output `rect` field converts to 0-1 ratios; original EMU values are discarded)

### 9g. Slide Structure
- **Slide layout name** is not output — `layoutElements` are included but you cannot determine which layout was used
- **Slide master** information is partially resolved for style inheritance but the master itself is not serialized
- **Color map overrides** (`clrMapOvr`) are used for color resolution but not output

### 9h. Media
- **Video/audio embedded as OLE** (not just media) is not handled
- **Streaming media URLs** for linked media (only `ref` path is stored)
- **Poster frame** for video

### 9i. Document Metadata
- Author, title, subject, keywords from core.xml
- Slide comments
- Custom XML data parts
- VBA macros (for .pptm files)

### 9j. Presentation-level
- Slide show settings (loop, pencil color, etc.)
- Custom show definitions
- Header/footer placeholders across slides
- Date/time/slide number field formats

---

## 10. Key Architectural Notes

**Style cascade order** (resolved in priority order for shape/text):
1. Direct element properties
2. Slide layout shape
3. Slide master shape
4. Slide master text styles (`titleStyle`, `bodyStyle`, `otherStyle`)
5. Default text style

**Theme color resolution** walks: slide `clrMapOvr` → slideLayout `clrMapOvr` → slideMaster `clrMap`. Semantic names (`tx1/tx2/bg1/bg2`) mapped to `dk1/dk2/lt1/lt2`.

**EMU conversion**: `1 EMU = 72/914400 pt ≈ 0.00007874 pt`. Used throughout: positions, sizes, border widths, shadow distance, font sizes (stored as hps = half-points, so 24pt = 48 in XML), row/column heights.

**Image/video/audio caching**: Each media type uses a keyed cache in `warpObj` (`loadedImages`, `loadedVideos`, `loadedAudios`). Media is loaded once and reused across slides.

**Diagram data**: Loaded from `ppt/diagrams/` files (`data`, `layout`, `quickStyle`, `colors`, `drawing`). The `textList` is extracted from `dgm:dataModel > dgm:ptLst > dgm:pt > dgm:t > a:p > a:r > a:t`. Nested elements are from the transformed drawing XML.

---

**Sources:**
- [pptxtojson npm](https://www.npmjs.com/package/pptxtojson)
- [pptxtojson GitHub](https://github.com/pipipi-pikachu/pptxtojson)
- `dist/index.d.ts` — TypeScript definitions
- `src/pptxtojson.js` — main parse pipeline
- `src/shape.js`, `src/text.js`, `src/fontStyle.js`, `src/paragraph.js`, `src/table.js`, `src/chart.js`, `src/fill.js`, `src/border.js`, `src/shadow.js`, `src/animation.js`, `src/diagram.js`, `src/math.js`, `src/position.js`, `src/schemeColor.js`, `src/color.js`, `src/shapePath.js`, `src/utils.js`, `src/readXmlFile.js`

---

**Unresolved Questions:**
- What exact shape presets does `getShapePath` handle beyond the 60+ listed? The `shapePath.js` file is large and the full list of preset names from PPTX's `a:prstGeom` enum was not fully enumerated.
- The `geom` field on Image elements: when `custGeom` is used, `identifyShape` is called. What shape names does it NOT match, resulting in `geom === 'custom'`?
- Does the library handle `a:tbl` with merged cells spanning non-contiguous columns correctly, or only simple row/col spans?
