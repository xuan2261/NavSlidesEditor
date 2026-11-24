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

  it('writes asymmetric cell insets and explicit zero into native table cells without changing weights', async () => {
    const xml = await tableXml(renderer, { ...table,
      cellStyles: { insets: [[{ top: 0, right: 3.6, bottom: 8, left: 12 }]] },
    })
    const output = cells(xml)
    expect(output[0]).toContain('marT="0"')
    expect(output[0]).toContain('marR="34290"')
    expect(output[0]).toContain('marB="76200"')
    expect(output[0]).toContain('marL="114300"')
    expect(output[1]).toContain('marL="0"')
    const widths = [...xml.matchAll(/<a:gridCol w="(\d+)"/g)].map((match) => Number(match[1]))
    expect(widths[1] / widths[0]).toBeCloseTo(3)
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

  it('writes mixed rich weights, font authority, paragraphs, literal special text and genuine NBSP into PPTX XML', async () => {
    const xml = await tableXml(renderer, { ...table,
      headerIsBold: true, cellBgColor: 'transparent', headerBgColor: 'transparent',
      data: [[{ html: '<p style="font-family:Arial;font-size:24px"><strong>Bold &amp; &lt;tag&gt;</strong><span style="font-weight:400"> normal\u00a0text</span></p><p style="font-size:16px">Second<br>Third &amp;amp;</p>' }, '<b>literal</b>'], [0, false]],
      cellStyles: { isBold: [[true]], fontSizes: [[9]], fontFamilies: [['Calibri']] },
    })
    const output = cells(xml)
    expect(output[0]).not.toContain('[object Object]')
    const paragraphs = [...output[0].matchAll(/<a:p(?:\s[^>]*)?>([\s\S]*?)<\/a:p>/g)].map((match) => match[1])
    expect(paragraphs.length).toBeGreaterThanOrEqual(3)
    const runs = [...output[0].matchAll(/<a:r>([\s\S]*?)<\/a:r>/g)].map((match) => match[1])
    expect(runs.find((run) => run.includes('Bold &amp; &lt;tag&gt;'))).toMatch(/\bb="1"/)
    const normal = runs.find((run) => run.includes('normal\u00a0text'))
    expect(normal).toBeTruthy()
    expect(normal).not.toMatch(/\bb="1"/)
    expect(normal).toContain('sz="1800"')
    expect(normal).toContain('typeface="Arial"')
    expect(runs.find((run) => run.includes('Second'))).not.toMatch(/\bb="1"/)
    expect(output[0]).toContain('Third &amp;amp;')
    expect(output[1]).toContain('&lt;b&gt;literal&lt;/b&gt;')
    expect(output[2]).toContain('<a:t>0</a:t>')
    expect(output[3]).toContain('<a:t>false</a:t>')
    expect(output[0]).toMatch(/<a:alpha val="0"\s*\/>|<a:noFill\s*\/>/)
  })
  it.each([
    ['<p>A</p><p></p>', ['A', '']],
    ['<p>A<br></p>', ['A', '']],
    ['<p>A</p><p></p><p></p>', ['A', '', '']],
    ['<p></p><p>A</p><p></p>', ['', 'A', '']],
  ])('serializes trailing empty paragraphs and breaks: %s', async (html, expected) => {
    const xml = await tableXml(renderer, { ...table, data: [[{ html }]], colWidths: [400], rowHeights: [200] })
    const paragraphs = [...cells(xml)[0].matchAll(/<a:p(?:\s[^>]*)?>([\s\S]*?)<\/a:p>/g)]
      .map((match) => [...match[1].matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((run) => run[1]).join(''))
    expect(paragraphs).toEqual(expected)
  })
})
