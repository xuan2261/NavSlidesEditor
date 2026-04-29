# Research Report: pptxtojson

**Repo**: https://github.com/pipipi-pikachu/pptxtojson
**Version**: v2.0.2 (npm) | v2.0.1 (GitHub)
**License**: MIT
**Last push**: 2026-04-19 | **Last updated**: 2026-04-24
**Stars**: 428 | **Forks**: 108 | **Open issues**: 3
**Language**: JavaScript 96.4%, HTML 3.6%
**npm weekly downloads**: ~4,000-5,000 (est.)
**Status**: Active maintenance (recent commits as of Apr 2026)

---

## 1. Description

Client-side JS library that converts `.pptx` files (Office Open XML ZIP archives) into human-readable JSON. Key differentiator: runs entirely in the browser without a server, and outputs semantic JSON rather than raw XML dumps. Inspired by PPTX2HTML and PPTTXjs.

---

## 2. Dependencies (3 total, all lightweight)

| Package | Version | Role |
|---------|---------|------|
| `jszip` | ^3.10.1 | Read PPTX as ZIP, extract XML parts |
| `tinycolor2` | 1.6.0 | Color manipulation (alpha, tint, shade) |
| `txml` | ^5.1.1 | XML-to-JS object parser |

No heavy dependencies. Tree-shakeable, browser-ready.

---

## 3. Source Code Structure (20 files in `src/`)

| File | Purpose |
|------|---------|
| `pptxtojson.js` | Main entry — `parse(file, options)`. Orchestrates ZIP reading, slide iteration, element dispatch |
| `readXmlFile.js` | Reads and parses XML parts from ZIP using JSZip + txml |
| `animation.js` | Parses slide transitions (type, duration, direction, speed) |
| `border.js` | Extracts border/stroke styles per cell or shape |
| `chart.js` | Parses 15 chart types — extracts data series, colors, type-specific options |
| `color.js` | Color transforms: tint, shade, HSL, luminance |
| `constants.js` | EMU-to-Point ratio constant |
| `diagram.js` | SmartArt/diagram loader with file caching; extracts text from diagram nodes |
| `fill.js` | Resolves fill types: solid color, gradient, image, pattern. Handles background fill cascade (slide → layout → master) |
| `fontStyle.js` | Extracts font: type, size, bold, italic, underline, color (solid + gradient), shadow, subscript |
| `math.js` | Converts Office Math (OMML) XML nodes to LaTeX via `parseOMath()` — handles fractions, superscripts, subscripts, radicals, matrices, delimiters, accents, etc. |
| `paragraph.js` | Text alignment (horizontal/vertical), `autoFit` behavior, paragraph spacing |
| `position.js` | Resolves absolute position from xfrm cascade: slide → layout → master |
| `schemeColor.js` | Maps theme scheme color references to actual hex values |
| `shadow.js` | Outer shadow parsing |
| `shape.js` | Custom shape path resolution (M/L/C/Q/arcTo commands); shape type identification (rect, ellipse, triangle, polygon family, parallelogram, trapezoid) via `identifyShape()` |
| `shapePath.js` | Maps DrawingML preset geometry names (prst) to SVG path strings for 100+ shape types |
| `table.js` | Table cell params: rowSpan/colSpan, fill color, font, borders, vAlign; row-level style inheritance from table styles |
| `text.js` | `genTextBody()` — generates HTML from paragraph nodes: spans with inline styles, lists (ul/ol), hyperlinks |
| `utils.js` | Helpers: `getTextByPathList()`, angle conversion, MIME types, HTML escaping |

---

## 4. How the Conversion Works

PPTX = ZIP. Pipeline:

1. `parse(file)` accepts `ArrayBuffer` — works in browser (FileReader) or Node.js (fs.readFileSync)
2. `JSZip.loadAsync(file)` opens ZIP
3. Read `[Content_Types].xml` → enumerate slides and slideLayouts
4. Read `ppt/presentation.xml` → slide dimensions (EMU → pt), default text style
5. Read `ppt/_rels/presentation.xml.rels` → resolve theme URI
6. Read theme → extract up to 6 `accent` colors as hex array
7. For each slide (sorted by filename number):
   - Read slide `.rels` → map rId → resource targets (images, charts, diagrams, hyperlinks)
   - Read slideLayout `.rels` → get slideMaster reference
   - Read slideMaster → get text styles, master `.rels`
   - Read master `.rels` → get theme reference
   - Cascade: slide content → layout → master for inherited properties
   - Walk `p:spTree` children: `p:sp` (shape/text), `p:cxnSp` (connection), `p:pic` (image/video/audio), `p:graphicFrame` (table/chart/diagram), `p:grpSp` (group), `mc:AlternateContent` (math)
   - Each node type dispatched to specific processor function
   - Extract speaker notes from `notesSlide`
   - Extract slide transition from slide → layout → master
8. Return `{ slides, usedFonts, themeColors, size }`

**Key architectural pattern**: `warpObj` — a large context object passed through every function, containing the ZIP handle, resolved resource maps, theme content, and parse options. This avoids re-reading files for inherited properties.

---

## 5. Supported Elements

### 5.1 Text
- Rich HTML output (`<p>`, `<span>` with inline styles)
- Font: family, size (pt), bold, italic, underline (single/double), strike, shadow, subscript
- Color: solid hex, gradient (via `background-clip: text`)
- Alignment: left/center/right/justify; vertical: top/middle/bottom
- Lists: `<ul>` (bullet char), `<ol>` (auto-number)
- Hyperlinks (extracted from `a:hlinkClick` rels)
- Text direction: horizontal, `eaVert` (vertical East Asian)
- `autoFit`: shape-fit or text-fit mode
- Tab → `&nbsp;` conversion

### 5.2 Images
- Embedded: base64 data URI (default) or Blob URL
- Cropping via `srcRect` (top/bottom/left/right as fractions)
- Geometric clip (rect, oval, custom shape from preset geometry)
- Filters: brightness, contrast, saturation, sharpen/soften, color temperature
- Border (stroke) support
- Hyperlinks

### 5.3 Video
- Embedded video (mp4/webm/ogg) → Blob URL
- External video link → ref string
- Position, size, rotation

### 5.4 Audio
- Embedded audio (mp3/wav/ogg) → Blob URL
- Position, size, rotation

### 5.5 Shapes
- **Preset shapes** via `shapType`: rect, ellipse, triangle, quadrilateral family (rectangle, rhombus, parallelogram, trapezoid), pentagon, hexagon, heptagon, octagon, roundRect, custom
- **Custom shapes** via `a:custGeom`: full SVG path extraction (M/L/C/Q/arcTo commands, with coordinate scaling)
- Keypoints: DrawingML adjustment values (e.g., corner radius)
- Fill: solid, gradient (linear/path), image, pattern
- Stroke: color, width, dash array, type
- Shadow: outer shadow
- Rotation, flip V/H
- Preset shape → SVG path via `getShapePath()` (100+ types)

### 5.6 Tables
- Row/col grid with cell data
- Row/col spans (rowSpan, colSpan, vMerge, hMerge)
- Row heights, column widths
- Cell fill (solid color), font color, bold
- Cell borders: top/bottom/left/right with style and color
- Table style inheritance: whole-table → first/last row/col → banded rows/cols
- vAlign: top/middle/bottom

### 5.7 Charts
15 chart types supported:

| Type | Key Fields |
|------|-----------|
| `lineChart` | data, colors, grouping, marker |
| `line3DChart` | data, colors, grouping |
| `barChart` / `bar3DChart` | data, colors, grouping, barDir (bar/col) |
| `pieChart` / `pie3DChart` | data, colors |
| `doughnutChart` | data, colors, holeSize |
| `areaChart` / `area3DChart` | data, colors, grouping |
| `scatterChart` | data (x,y pairs), colors, style |
| `bubbleChart` | data (x,y pairs), colors |
| `radarChart` | data, colors, style |
| `surfaceChart` / `surface3DChart` | data, colors |
| `stockChart` | data, colors |

Data extracted from embedded chart XML (`chart*.xml` inside ZIP). Colors resolved from theme scheme + tint applied. Series extracted as labeled data rows with x-labels.

### 5.8 Math Formulas
- Office Math ML (OMML) → LaTeX via `parseOMath()`
- Structures: fractions, superscripts, subscripts, radicals, matrices, delimiters, n-ary operators (integral, sigma, etc.), limits, functions, grouped characters, equation arrays, bars, accents, borderBox
- Fallback: embedded image reference (base64) from `mc:Fallback`
- Raw HTML text also extracted as `text` field

### 5.9 Diagrams (SmartArt)
- Loads diagram drawing XML, layout, quickStyle, colors
- Extracts text from `dgm:ptLst` → `textList[]`
- Converts each diagram shape node via `processSpNode()` → `elements[]`
- Caching: diagram file cache on `warpObj` to avoid re-reading

### 5.10 Groups
- Nested element collections
- Transform: group-level scale factors applied to child positions (`(left - chx) * ws`)
- Recursion depth: capped at 10 levels
- Supports nested groups within groups

### 5.11 Slide Background
- Solid color, gradient (linear/path), image, pattern
- Inheritance cascade: slide → slideLayout → slideMaster
- Theme background fill index resolution (idx > 1000 → lookup in `fmtScheme`)

### 5.12 Slide Transitions
- Type: any DrawingML transition name (fade, push, wipe, etc.)
- Duration: parsed from `p:dur` or derived from `spd` (slow=1000ms, med=800ms, fast=500ms)
- Direction: from `dir` attribute
- Auto-advance: `autoNextAfter` from `advTm`

### 5.13 Speaker Notes
- HTML text extracted from `notesSlide`
- Bullet list detection (`a:buChar` → `<ul>`, `a:buAutoNum` → `<ol>`)
- Alignment preserved

---

## 6. Output JSON Format

```typescript
interface ParseResult {
  slides: Slide[]           // array of slides
  usedFonts: string[]       // embedded fonts from presentation.xml
  themeColors: string[]     // up to 6 accent colors as hex
  size: { width: number; height: number }  // in pt units
}

interface Slide {
  fill: Fill               // background (color | gradient | image | pattern)
  elements: Element[]      // slide-level elements
  layoutElements: Element[] // non-placeholder layout/master background shapes
  note: string             // speaker notes as HTML string
  transition?: {
    type: string
    duration: number
    direction: string | null
  } | null
}
```

Each element has: `left`, `top`, `width`, `height` (pt), `order` (z-index), plus type-specific fields.

---

## 7. Options

| Option | Values | Default | Notes |
|--------|--------|---------|-------|
| `imageMode` | `base64`, `blob`, `both`, `none` | `base64` | Controls image encoding |
| `videoMode` | `blob`, `none` | `none` | Controls video encoding |
| `audioMode` | `blob`, `none` | `none` | Controls audio encoding |

All media cached on `warpObj` to avoid re-decoding.

---

## 8. Limitations and Known Gaps

1. **Style fidelity not guaranteed** — authors explicitly state "解析出来的PPT信息与源文件在样式上还是存在差异" (parsed info differs in style from source). Best for text extraction, structure analysis, media info — not pixel-perfect rendering.

2. **CSS styling absent** — no CSS extracted. Text is rendered as HTML with inline styles. Presentation-level effects (animations, master slide visual effects) are not re-created.

3. **Master slides**: not included in output as standalone objects. Their content is merged via property inheritance into slide elements.

4. **LaTeX coverage partial** — only common structures supported; exotic OMML elements may fall through to empty string.

5. **No round-trip** — library is one-way (PPTX → JSON only). No JSON → PPTX generation.

6. **Node.js support marked experimental** — requires v1.5.0+, uses `fs.readFileSync` + `.buffer`.

7. **No error recovery** — malformed PPTX files may throw. No graceful degradation.

8. **No streaming/batch** — `parse()` processes entire file into memory.

9. **Image effects**: only a subset of DrawingML picture effects supported (brightness, contrast, saturation, sharpen/soften, color temperature). Artistic effects, Picture Styles presets are not extracted.

10. **Chart data limited to embedded charts** — linked charts (external data sources) may not resolve correctly.

11. **Font embedding info only** — actual font binary data not extracted; just typeface names.

---

## 9. Architectural Fit for NavSlides Editor

NavSlides Editor (this repo) converts JSON → reveal.js HTML. `pptxtojson` provides the reverse path (PPTX → JSON). Potential use cases:

- **Import**: Allow users to upload `.pptx` files and convert to the internal JSON format for editing
- **Template extraction**: Parse existing PPTX templates to extract structure

**Requirements for integration**:
1. JSON schema alignment — `pptxtojson` output schema must map to `presentation-store.js` shape. Key fields (`left`, `top`, `width`, `height`, `content`, `fill`, `type`) are compatible, but `shapType` values (Office preset names) may need normalization.
2. Media handling — `base64` mode easiest for browser use; set `videoMode: 'blob'` if video playback needed
3. Dependency conflict — `jszip` is already in NavSlides' dependency tree (indirect). `tinycolor2` and `txml` are new. Check `package.json`.
4. Node.js not needed — this is a client-side tool; no SSR concerns.

**Trade-off**: The library is actively maintained (Apr 2026), lightweight (3 deps), well-typed (full `index.d.ts`), and covers 15 chart types, SmartArt, math formulas, and nested groups. The main risk is style fidelity — rich formatting may not round-trip perfectly.

---

## 10. Unresolved Questions

- Does `usedFonts` field actually contain all used fonts or only explicitly embedded ones?
- How does the library handle `.ppt` (pre-OOXML format)? Likely fails — no backward compat.
- Are there any known security concerns with parsing untrusted PPTX files (zip slip, XXE)?
- Is the npm package dist bundle (ESM + CJS) kept up to date with the source?
