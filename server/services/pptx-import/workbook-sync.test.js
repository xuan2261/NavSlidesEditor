import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { inspectEmbeddedWorkbook } from './embedded-workbook-inventory.js'
import { createNativeChartAdapter } from './native-chart-adapter.js'

const workbookXml = `<workbook xmlns:r="rels"><sheets>
<sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>`
const workbookRels = `<Relationships><Relationship Id="rId1"
 Target="worksheets/sheet1.xml"/></Relationships>`
const sheetXml = `<worksheet><sheetData><row r="1">
<c r="B1"><v>10</v></c><c r="C1"><v>20</v></c></row></sheetData></worksheet>`
const chartXml = `<c:chartSpace xmlns:c="chart"><c:chart><c:plotArea><c:barChart><c:ser>
<c:val><c:numRef><c:f>Sheet1!$B$1:$C$1</c:f><c:numCache><c:formatCode>0</c:formatCode>
<c:ptCount val="2"/><c:pt idx="0"><c:v>10</c:v></c:pt>
<c:pt idx="1"><c:v>20</c:v></c:pt></c:numCache></c:numRef></c:val>
</c:ser></c:barChart></c:plotArea></c:chart><c:extLst><c:ext uri="keep"/></c:extLst>
</c:chartSpace>`

async function workbook(extra = {}) {
  const zip = new JSZip()
  zip.file('xl/workbook.xml', workbookXml)
  zip.file('xl/_rels/workbook.xml.rels', workbookRels)
  zip.file('xl/worksheets/sheet1.xml', sheetXml)
  for (const [name, value] of Object.entries(extra)) zip.file(name, value)
  return zip.generateAsync({ type: 'nodebuffer' })
}

async function presentation(book = workbook()) {
  const zip = new JSZip()
  zip.file('ppt/charts/chart1.xml', chartXml)
  zip.file('ppt/embeddings/book.xlsx', await book)
  zip.file('ppt/unknown.bin', Buffer.from([0, 1, 2, 255]))
  return zip.generateAsync({ type: 'nodebuffer' })
}

const request = {
  chartPath: 'ppt/charts/chart1.xml',
  workbookPath: 'ppt/embeddings/book.xlsx',
  cells: [
    { sheet: 'Sheet1', cell: 'B1', value: 30 },
    { sheet: 'Sheet1', cell: 'C1', value: 40 },
  ],
  caches: [{ formula: 'Sheet1!$B$1:$C$1', values: [30, 40] }],
}

describe('embedded workbook synchronization', () => {
  it('inventories workbooks without executing formulas or resolving external links', async () => {
    const formulaSheet = sheetXml.replace('<v>10</v>', '<f>1+1</f><v>2</v>')
    const bytes = await workbook({
      'xl/worksheets/sheet1.xml': formulaSheet,
      'xl/externalLinks/externalLink1.xml': '<externalLink/>',
    })
    expect(await inspectEmbeddedWorkbook(bytes)).toMatchObject({
      safe: true, editable: false, formulas: ['1+1'],
      externalLinks: ['xl/externalLinks/externalLink1.xml'],
      reason: 'external-workbook-link',
    })
  })

  it('updates authoritative cells and matching caches atomically and deterministically', async () => {
    const adapter = createNativeChartAdapter()
    const first = await adapter.applyDataPatch(await presentation(), request)
    expect(first).toMatchObject({
      ok: true, authority: 'embedded-workbook',
      impactClosure: ['ppt/embeddings/book.xlsx', 'ppt/charts/chart1.xml'],
    })
    const outer = await JSZip.loadAsync(first.bytes)
    const inner = await JSZip.loadAsync(await outer.file(request.workbookPath).async('nodebuffer'))
    expect(await inner.file('xl/worksheets/sheet1.xml').async('string'))
      .toContain('<c r="B1"><v>30</v></c>')
    const chart = await outer.file(request.chartPath).async('string')
    expect(chart).toContain('<c:v>30</c:v>')
    expect(chart).toContain('<c:ext uri="keep"/>')
    expect(await outer.file('ppt/unknown.bin').async('nodebuffer'))
      .toEqual(Buffer.from([0, 1, 2, 255]))
    const second = await adapter.applyDataPatch(first.bytes, request)
    const secondZip = await JSZip.loadAsync(second.bytes)
    expect(await secondZip.file(request.chartPath).async('string')).toBe(chart)
  })

  it('rolls back and returns preserve-only when cache patch fails', async () => {
    const source = await presentation()
    const result = await createNativeChartAdapter().applyDataPatch(source, {
      ...request, caches: [{ formula: 'missing', values: [1] }],
    })
    expect(result).toMatchObject({ ok: false, status: 'preserve-only' })
    expect(source).toEqual(source)
  })

  it.each([
    [{ shared: true }, 'shared-workbook'],
    [{ external: true }, 'external-workbook-link'],
  ])('blocks unsafe package configuration', async (flags, reason) => {
    expect(await createNativeChartAdapter().applyDataPatch(
      await presentation(), { ...request, ...flags }
    )).toMatchObject({ ok: false, reason })
  })

  it.each([
    ['xl/vbaProject.bin', 'macro-workbook'],
    ['_xmlsignatures/sig1.xml', 'signed-workbook'],
  ])('blocks active or signed workbook %s', async (part, reason) => {
    const result = await createNativeChartAdapter().applyDataPatch(
      await presentation(workbook({ [part]: 'opaque' })), request
    )
    expect(result).toMatchObject({ ok: false, reason })
  })

  it('keeps workbook bytes unchanged for style-only edits', async () => {
    const result = await createNativeChartAdapter().applyStylePatch(await presentation(), {
      ...request, patch: (xml) => xml.replace('<c:barChart>', '<c:barChart><c:varyColors val="1"/>'),
    })
    const zip = await JSZip.loadAsync(result.bytes)
    const bytes = await zip.file(request.workbookPath).async('nodebuffer')
    expect(result.workbookHash).toBe(
      (await import('node:crypto')).createHash('sha256').update(bytes).digest('hex')
    )
  })
})
