import { createCanvas } from '@napi-rs/canvas'

const context = createCanvas(8, 8).getContext('2d')
const options = () => ({
  fontProfile: {
    schemaVersion: 1,
    faces: [{ id: 'main', typeface: 'Arial', assetHash: 'a'.repeat(64) }],
  },
  rendererProfile: {
    id: 'pptx-explicit-lines-v1',
    sessionId: 'canvas-unit',
    userAgent: 'canvas',
    platform: 'test',
    language: 'en',
    devicePixelRatio: 1,
  },
  fontFamilies: { main: 'Arial' },
  textDefaults: {
    body: {
      insetLeftEmu: 0,
      insetRightEmu: 0,
      insetTopEmu: 0,
      insetBottomEmu: 0,
      verticalAlign: 't',
      verticalText: 'horz',
      wrap: false,
      autofit: { mode: 'none' },
    },
    run: {
      fontSizePt: 12,
      fontLatin: { typeface: 'Arial' },
      color: { kind: 'srgb', value: '102030' },
    },
  },
  // Real Canvas metrics exercise the layout protocol without claiming browser/native qualification.
  measurement: {
    validate: () => null,
    measureLine({ items, fontScale, startX }) {
      let x = 0,
        ascent = 0,
        descent = 0
      const runs = items.map((item) => {
        const fontSizePt = item.properties.fontSizePt * fontScale
        context.font = `${(fontSizePt * 4) / 3}px Arial`
        const metrics = context.measureText(item.text || 'M')
        ascent = Math.max(ascent, metrics.fontBoundingBoxAscent)
        descent = Math.max(descent, metrics.fontBoundingBoxDescent)
        const width = item.text ? metrics.width : 0
        const run = {
          ...item,
          fontSizePt,
          baseline: metrics.fontBoundingBoxAscent,
          rects: [
            {
              x,
              y: 0,
              width,
              height: metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent,
            },
          ],
        }
        x += width
        return run
      })
      return {
        issues: [],
        width: x,
        contentWidth: x,
        height: ascent + descent,
        baseline: ascent,
        startX,
        runs,
      }
    },
  },
})
function table() {
  const cell = (id, text) => ({
    componentId: id,
    anchorCellId: id,
    merge: {},
    properties: {},
    textDocument: {
      schemaVersion: 1,
      componentId: `${id}:body`,
      paragraphs: [
        { componentId: `${id}:p`, runs: [{ componentId: `${id}:r`, kind: 'text', text }] },
      ],
    },
  })
  return {
    schemaVersion: 1,
    componentId: 'table',
    properties: {},
    columns: [
      { componentId: 'col0', widthEmu: 952500 },
      { componentId: 'col1', widthEmu: 1905000 },
    ],
    rows: [
      { componentId: 'row0', heightEmu: 952500, cells: [cell('a', ' A<& '), cell('b', 'covered')] },
    ],
  }
}

export { options, table }
