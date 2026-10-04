import { describe, expect, it } from 'vitest'
import PptxGenJS from 'pptxgenjs'
import JSZip from 'jszip'
import { addTableElement as clientTable } from './export-pptx-basic-renderers'
import serverRenderers from '../../../server/utils/server-basic-renderers.js'

const table = {
  type: 'table',
  width: 400,
  height: 200,
  headerRow: true,
  headerIsBold: false,
  headerTextColor: '#112233',
  textColor: '#556677',
  cellBgColor: '#ffffff',
  cellPadding: 0,
  borderWidth: 0,
  colWidths: [100, 300],
  rowHeights: [50, 150],
  data: [
    ['A', 'B'],
    ['C', 'D'],
  ],
  cellStyles: { isBold: [[null, true]] },
}
async function tableXml(renderer, element) {
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'
  renderer(pptx.addSlide(), element, { x: 0, y: 0, w: 8, h: 4 })
  const zip = await JSZip.loadAsync(await pptx.write({ outputType: 'nodebuffer' }))
  return zip.file('ppt/slides/slide1.xml').async('string')
}
const cells = (xml) => [...xml.matchAll(/<a:tc>([\s\S]*?)<\/a:tc>/g)].map((match) => match[1])

describe.each([
  ['client', clientTable],
  ['server', serverRenderers.addTableElement],
])('%s native table semantics', (_, renderer) => {
  it('writes authored header inheritance, zero padding/border, and proportional dimensions into PPTX XML', async () => {
    const xml = await tableXml(renderer, table)
    const output = cells(xml)
    expect(output[0]).not.toMatch(/\bb="1"/)
    expect(output[1]).toContain('b="1"')
    expect(output[0]).toContain('val="112233"')
    expect(output[2]).toContain('val="556677"')
    expect(output[0]).toContain('marL="0"')
    expect(output[0]).toContain('marR="0"')
    expect(output[0]).toContain('<a:lnL w="0"')
    const widths = [...xml.matchAll(/<a:gridCol w="(\d+)"/g)].map((match) => Number(match[1]))
    const heights = [...xml.matchAll(/<a:tr h="(\d+)"/g)].map((match) => Number(match[1]))
    expect(widths[1] / widths[0]).toBeCloseTo(3)
    expect(heights[1] / heights[0]).toBeCloseTo(3)
  })

  it('preserves nonzero cell padding and true header bold without overriding per-cell false', async () => {
    const output = cells(
      await tableXml(renderer, {
        ...table,
        cellPadding: 12,
        headerIsBold: true,
        cellStyles: { isBold: [[false, null]] },
      })
    )
    expect(output[0]).not.toMatch(/\bb="1"/)
    expect(output[1]).toContain('b="1"')
    expect(output[0]).toContain('marL="114300"')
    expect(output[0]).toContain('marT="114300"')
  })

  it('restores covered cells and zero values in an unmerged native table', async () => {
    const data = [
      [0, 'Hidden'],
      [false, 'D'],
    ]
    const mergedXml = await tableXml(renderer, {
      ...table,
      data,
      mergedCells: [{ row: 0, col: 0, rowSpan: 1, colSpan: 2 }],
    })
    expect(mergedXml).toMatch(/<a:tc[^>]*gridSpan="2"/)
    expect(mergedXml).not.toContain('<a:t>Hidden</a:t>')
    const unmergedXml = await tableXml(renderer, { ...table, data, mergedCells: [] })
    expect([...unmergedXml.matchAll(/<a:t>(.*?)<\/a:t>/g)].map((match) => match[1])).toEqual([
      '0',
      'Hidden',
      'false',
      'D',
    ])
  })
})
