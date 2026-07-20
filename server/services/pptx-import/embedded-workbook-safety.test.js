import JSZip from 'jszip'
import { describe, expect, it, vi } from 'vitest'
import { inspectEmbeddedWorkbook } from './embedded-workbook-inventory.js'
import { createNativeChartAdapter } from './native-chart-adapter.js'

const workbookXml = '<workbook xmlns:r="rels"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>'
const workbookRels = '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>'
const sheetXml = '<worksheet><sheetData><row r="1"><c r="A1"><v>1</v></c></row></sheetData></worksheet>'

async function workbook(extra = {}, compression = 'STORE') {
  const zip = new JSZip()
  zip.file('xl/workbook.xml', workbookXml)
  zip.file('xl/_rels/workbook.xml.rels', workbookRels)
  zip.file('xl/worksheets/sheet1.xml', sheetXml)
  for (const [name, value] of Object.entries(extra)) zip.file(name, value)
  return zip.generateAsync({ type: 'nodebuffer', compression })
}

async function presentation(book) {
  const zip = new JSZip()
  zip.file('ppt/charts/chart1.xml', '<c:chartSpace xmlns:c="chart"/>')
  zip.file('ppt/embeddings/book.xlsx', book)
  return zip.generateAsync({ type: 'nodebuffer' })
}

describe('recursive embedded workbook package guard', () => {
  it('keeps a small legitimate workbook inspectable', async () => {
    await expect(inspectEmbeddedWorkbook(await workbook())).resolves.toMatchObject({
      safe: true, editable: true, formulas: [],
    })
  })

  it.each([
    ['container entries', {}, { maxEntries: 2 }, 'zip-entry-limit-exceeded'],
    ['container bytes', {}, { maxBytes: 10 }, 'zip-container-byte-limit-exceeded'],
    ['compression ratio', { 'xl/worksheets/payload.xml': `<x>${'a'.repeat(4096)}</x>` }, { maxCompressionRatio: 1 }, 'zip-compression-ratio-exceeded', 'DEFLATE'],
    ['XML DTD', { 'xl/worksheets/sheet1.xml': '<!DOCTYPE x [<!ELEMENT x ANY>]><x/>' }, {}, 'xml-dtd-prohibited'],
    ['relationship traversal', {
      'xl/_rels/workbook.xml.rels': '<Relationships><Relationship Id="rId1" Target="../../../../escape.xml"/></Relationships>',
    }, {}, 'relationship-target-invalid'],
  ])('fails closed for hostile nested %s', async (_, extra, limits, reason, compression = 'STORE') => {
    await expect(inspectEmbeddedWorkbook(await workbook(extra, compression), limits)).resolves.toMatchObject({
      safe: false, editable: false, reason,
    })
  })

  it('enforces recursive-depth and aggregate nested-byte budgets', async () => {
    const child = await workbook()
    const nested = await workbook({ 'xl/embeddings/child.xlsx': child })
    await expect(inspectEmbeddedWorkbook(nested, { maxNestedDepth: 0 })).resolves.toMatchObject({
      safe: false, reason: 'zip-recursion-depth-exceeded',
    })

    const largeChild = await workbook({ 'xl/worksheets/payload.xml': `<x>${'a'.repeat(2048)}</x>` })
    const aggregate = await workbook({
      'xl/embeddings/first.xlsx': largeChild,
      'xl/embeddings/second.xlsx': largeChild,
    })
    await expect(inspectEmbeddedWorkbook(aggregate, { maxNestedAggregateBytes: 1024 })).resolves.toMatchObject({
      safe: false, reason: 'nested-aggregate-byte-limit-exceeded',
    })
  })

  it('blocks the native workbook parser after a failed recursive verdict', async () => {
    const maliciousWorkbook = await workbook({
      'xl/worksheets/sheet1.xml': '<!DOCTYPE x [<!ELEMENT x ANY>]><x/>',
    })
    const loadAsync = vi.spyOn(JSZip, 'loadAsync')
    try {
      const result = await createNativeChartAdapter().applyDataPatch(await presentation(maliciousWorkbook), {
        chartPath: 'ppt/charts/chart1.xml', workbookPath: 'ppt/embeddings/book.xlsx',
      })
      expect(result).toMatchObject({ ok: false, status: 'preserve-only', reason: 'xml-dtd-prohibited' })
      expect(loadAsync).toHaveBeenCalledTimes(2)
    } finally {
      loadAsync.mockRestore()
    }
  })
})
