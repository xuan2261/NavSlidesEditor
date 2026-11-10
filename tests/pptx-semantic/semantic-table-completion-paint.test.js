import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { createCanvas, GlobalFonts, loadImage } from '@napi-rs/canvas'
import { describe, expect, it } from 'vitest'
import { renderSemanticTable } from '../../shared/src/pptx-table-renderer'
import { applyTableOperation } from '../../shared/src/pptx-table-operations'
import { importTableFixture, tableFrame } from './table-import-fixture'

const bytes = readFileSync('server/vendor/katex/dist/fonts/KaTeX_Main-Regular.ttf')
const alias = 'TableCompletionSourceFont'
GlobalFonts.register(bytes, alias)
const fontProfile = { schemaVersion: 1, faces: [
  { id: 'main', typeface: 'KaTeX Main', assetHash: createHash('sha256').update(bytes).digest('hex') },
] }
const context = createCanvas(8, 8).getContext('2d')
const runtime = {
  fontProfile, fontFamilies: { main: alias },
  rendererProfile: { id: 'pptx-explicit-lines-v1', sessionId: 'table-source-canvas',
    userAgent: 'canvas', platform: 'test', language: 'en', devicePixelRatio: 1 },
  measurement: {
    validate: (profile) => JSON.stringify(profile) === JSON.stringify(fontProfile) ? null : 'font mismatch',
    measureLine({ items, fontScale, startX }) {
      let x = 0, ascent = 0, descent = 0
      const runs = items.map((item) => {
        const fontSizePt = item.properties.fontSizePt * fontScale
        context.font = `${fontSizePt * 4 / 3}px ${alias}`
        const metrics = context.measureText(item.text || 'M')
        ascent = Math.max(ascent, metrics.fontBoundingBoxAscent)
        descent = Math.max(descent, metrics.fontBoundingBoxDescent)
        const width = item.text ? metrics.width : 0
        const run = { ...item, fontSizePt, baseline: metrics.fontBoundingBoxAscent,
          rects: [{ x, y: 0, width, height: metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent }] }
        x += width
        return run
      })
      return { issues: [], width: x, contentWidth: x, height: ascent + descent, baseline: ascent, startX, runs }
    },
  },
}
const line = (side, color = 'FF0000') =>
  `<a:ln${side} w="19050"><a:solidFill><a:srgbClr val="${color}"><a:alpha val="50000"/></a:srgbClr></a:solidFill></a:ln${side}>`
async function sourceTable(properties, merged = false) {
  let index = 0
  const graphic = tableFrame()
    .replaceAll('<a:bodyPr/>', '<a:bodyPr lIns="0" rIns="0" tIns="0" bIns="0" anchor="t" vert="horz" wrap="none"><a:noAutofit/></a:bodyPr>')
    .replace(/<a:rPr sz="(\d+)"\/>/g, '<a:rPr sz="$1"><a:solidFill><a:srgbClr val="102030"/></a:solidFill><a:latin typeface="KaTeX Main"/></a:rPr>')
    .replaceAll(' gridSpan="2"', merged ? ' gridSpan="2"' : '')
    .replaceAll(' hMerge="1"', merged ? ' hMerge="1"' : '')
    .replaceAll('<a:tcPr/>', () => `<a:tcPr>${properties[index++] || ''}</a:tcPr>`)
  const { presentation } = await importTableFixture({ graphic })
  return Object.values(presentation.pptxSemantic.definitions)[0].content.tableDocument
}

describe('source table shared edges and merged perimeter paint', () => {
  it('coalesces identical shared borders once, after neighboring cell fills', async () => {
    const input = await sourceTable([line('R'), `${line('L')}<a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill>`])
    const before = JSON.stringify(input)
    const svg = renderSemanticTable(input, runtime)
    expect((svg.match(/<line /g) || [])).toHaveLength(1)
    expect(svg.indexOf('<line ')).toBeGreaterThan(svg.lastIndexOf('<rect '))
    const image = await loadImage(Buffer.from(svg)), canvas = createCanvas(288, 120)
    canvas.getContext('2d').drawImage(image, 0, 0)
    // Compare with one independently drawn stroke in the same raster engine.
    // This avoids treating the engine's alpha arithmetic as a native oracle.
    const reference = await loadImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="288" height="120"><rect x="144" width="144" height="48" fill="#FFFFFF"/><line x1="144" y1="0" x2="144" y2="48" stroke="#FF0000" stroke-opacity="0.5" stroke-width="2" stroke-linecap="square"/></svg>'))
    const expected = createCanvas(288, 120)
    expected.getContext('2d').drawImage(reference, 0, 0)
    expect([...canvas.getContext('2d').getImageData(144, 44, 1, 1).data])
      .toEqual([...expected.getContext('2d').getImageData(144, 44, 1, 1).data])
    expect(JSON.stringify(input)).toBe(before)
  })
  it('uses covered physical perimeter borders while preserving hidden content/styles on unmerge', async () => {
    const input = await sourceTable([line('B'), `${line('B')}<a:solidFill><a:srgbClr val="00FF00"/></a:solidFill>`], true)
    const before = JSON.stringify(input)
    const svg = renderSemanticTable(input, runtime)
    expect((svg.match(/<line /g) || [])).toHaveLength(1)
    expect(svg).toContain('x1="0" y1="48" x2="288" y2="48"')
    expect(svg).not.toContain('>Covered</text>')
    expect(svg).not.toContain('fill="#00FF00"')
    const unmerged = applyTableOperation(input, { type: 'unmergeCell', cellId: input.rows[0].cells[0].componentId })
    expect(renderSemanticTable(unmerged, runtime)).toContain('fill="#00FF00"')
    expect(unmerged.rows[0].cells[1].textDocument).toEqual(input.rows[0].cells[1].textDocument)
    expect(JSON.stringify(input)).toBe(before)
  })
  it('uses DrawingML cell margin defaults without rewriting absent source declarations', async () => {
    const input = await sourceTable([])
    const before = JSON.stringify(input)
    const svg = renderSemanticTable(input, runtime)
    const explicit = JSON.parse(before)
    for (const row of explicit.rows) for (const cell of row.cells)
      cell.properties = { marginLeftEmu: 91440, marginRightEmu: 91440,
        marginTopEmu: 45720, marginBottomEmu: 45720 }
    expect(svg).toBe(renderSemanticTable(explicit, runtime))
    expect(svg).toContain('x="9.6"')
    expect(JSON.stringify(input)).toBe(before)
  })
  it('keeps conflicting shared borders located rather than guessing precedence', async () => {
    const input = await sourceTable([line('R'), line('L', '0000FF')])
    expect(() => renderSemanticTable(input, runtime)).toThrow(/shared-edge/)
    try { renderSemanticTable(input, runtime) } catch (error) {
      expect(error.componentId).toBe(input.rows[0].cells[1].componentId)
      expect(error.path).toBe('properties.borders.left')
    }
  })
  it('coalesces a merged edge against two physical neighbors and keeps explicit zero margins', async () => {
    const input = await sourceTable([line('B'), line('B'), line('T'), line('T')], true)
    const modified = applyTableOperation(input, { type: 'setCellProperties',
      cellId: input.rows[0].cells[0].componentId,
      properties: { marginLeftEmu: 0, marginTopEmu: 0 } })
    const svg = renderSemanticTable(modified, runtime)
    expect((svg.match(/<line /g) || [])).toHaveLength(1)
    expect(svg).toContain('x1="0" y1="48" x2="288" y2="48"')
    expect(svg).toContain(' x="0"')
  })
})
