/**
 * pptxtojson@2.0.2 output fixture — the regression substrate for PPTX import.
 *
 * Mirrors the RAW object pptxtojson@2.0.2 hands to the NavSlides mappers, using
 * the library's ACTUAL 2.x conventions (not the 0.x conventions the old fixtures
 * fabricated). Every field below is annotated with the index.js expression it
 * mirrors so a lib bump that changes shape is caught by parser-convention-drift.test.js.
 *
 * Verified against node_modules/pptxtojson/dist/index.js:
 *   - lengths:        Ru = 72/914400  (EMU→pt); font/line are POINTS, not 96-DPI px
 *   - line width:     parseInt(@w)/12700  → points
 *   - gradient stop:  pos: c/1e3 + "%"  → percent STRING ("50%")
 *   - gradient angle: rot: Math.round(@ang/6e4)  → integer OOXML degrees (CW from East)
 *   - filters:        bright/contrast/sat = parseInt(@val)/1e5  → FRACTION
 *                     brightness/contrast are offsets (neutral 0, range −1..+1)
 *                     saturation is a multiplier (neutral 1.0)
 *   - chart:          grouping: c:grouping/@val  ('standard' | 'stacked' | ...)
 *
 * All values use the 2.0.2 shape. No real .pptx binary required.
 */

// A plain text box: 18pt font. Parser keeps font in points.
const textElement = {
  type: 'text',
  left: 100,
  top: 80,
  width: 400,
  height: 60,
  fontSize: 18,
  content: '<p style="font-size:18pt">Eighteen point text</p>',
}

// A 2×1 table; each cell font is 18pt (points, per Ru convention).
const tableElement = {
  type: 'table',
  left: 100,
  top: 200,
  width: 400,
  height: 120,
  data: [
    [
      { text: 'Cell A', fontSize: 18 },
      { text: 'Cell B', fontSize: 18 },
    ],
  ],
}

// An image with PowerPoint color corrections expressed as 2.x fractions:
//   brightness +0.2 (=+20%), contrast −0.5 (=−50%), saturation 1.0 (neutral multiplier).
const imageElement = {
  type: 'image',
  left: 100,
  top: 340,
  width: 200,
  height: 150,
  base64: 'data:image/png;base64,iVBORw0KGgo=',
  filters: {
    brightness: 0.2,
    contrast: -0.5,
    saturation: 1.0,
  },
}

// A neutral-corrections image: every filter at its identity value.
// Used to lock the "neutral → no filter, image unchanged" invariant.
const neutralImageElement = {
  type: 'image',
  left: 320,
  top: 340,
  width: 200,
  height: 150,
  base64: 'data:image/png;base64,iVBORw0KGgo=',
  filters: {
    brightness: 0,
    contrast: 0,
    saturation: 1.0,
  },
}

// A gradient-filled shape. Stop pos are percent STRINGS; rot is an integer
// OOXML degree (0 = gradient vector points East / left→right).
const gradientShapeElement = {
  type: 'shape',
  shapType: 'rect',
  left: 100,
  top: 40,
  width: 300,
  height: 120,
  fill: {
    type: 'gradient',
    value: {
      rot: 0,
      colors: [
        { pos: '0%', color: '#ffffff' },
        { pos: '50%', color: '#888888' },
        { pos: '100%', color: '#000000' },
      ],
    },
  },
}

// A stacked bar chart: parser keeps grouping separate from chartType.
const stackedChartElement = {
  type: 'chart',
  left: 100,
  top: 60,
  width: 400,
  height: 300,
  chartType: 'barChart',
  grouping: 'stacked',
  colors: ['#6366f1', '#ef4444'],
  data: [
    { key: 'Series 1', values: [{ x: 'Q1', y: 10 }, { x: 'Q2', y: 20 }] },
    { key: 'Series 2', values: [{ x: 'Q1', y: 5 }, { x: 'Q2', y: 15 }] },
  ],
}

// An area chart: grouping 'standard', chartType carries 'area'.
const areaChartElement = {
  type: 'chart',
  left: 520,
  top: 60,
  width: 400,
  height: 300,
  chartType: 'areaChart',
  grouping: 'standard',
  colors: ['#22c55e'],
  data: [
    { key: 'Series 1', values: [{ x: 'Jan', y: 3 }, { x: 'Feb', y: 7 }, { x: 'Mar', y: 5 }] },
  ],
}

// A 30°-rotated group containing a square shape and a horizontal line.
// Children carry NO own rotation (rotate: 0) — the group's rotation lives only
// on the group; endpoints/box must inherit it via the group matrix, applied once.
const rotatedGroupElement = {
  type: 'group',
  left: 200,
  top: 150,
  width: 200,
  height: 200,
  rotate: 30,
  elements: [
    {
      type: 'shape',
      shapType: 'rect',
      left: 0,
      top: 0,
      width: 100,
      height: 100,
      rotate: 0,
      fill: { type: 'color', value: '#3b82f6' },
    },
    {
      type: 'shape',
      shapType: 'line',
      left: 0,
      top: 150,
      width: 200,
      height: 1,
      rotate: 0,
      x1: 0,
      y1: 0,
      x2: 200,
      y2: 0,
    },
  ],
}

// A diagram (SmartArt) with one long-text node — exercises the fit-meta clamp.
const diagramElement = {
  type: 'diagram',
  left: 100,
  top: 400,
  width: 600,
  height: 120,
  textList: [{ text: 'A deliberately long diagram node label that should be clamped to fit its box' }],
  elements: [
    {
      type: 'shape',
      shapType: 'rect',
      left: 0,
      top: 0,
      width: 200,
      height: 80,
      fontSize: 18,
      content: 'A deliberately long diagram node label that should be clamped to fit its box',
    },
  ],
}

// An EMF image: vector format the browser cannot render. Referenced by an
// in-memory media ref (zip entry path), never a network URL.
const emfImageElement = {
  type: 'image',
  left: 100,
  top: 100,
  width: 240,
  height: 160,
  ref: 'ppt/media/image1.emf',
}

module.exports = {
  textElement,
  tableElement,
  imageElement,
  neutralImageElement,
  gradientShapeElement,
  stackedChartElement,
  areaChartElement,
  rotatedGroupElement,
  diagramElement,
  emfImageElement,
}
