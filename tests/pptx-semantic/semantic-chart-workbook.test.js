import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import JSZip from 'jszip'
import { buildFeatureFixture } from './feature-fixtures.js'
const require = createRequire(import.meta.url)
const { buildSemanticInventory } = require('../../server/services/pptx-import/semantic-inventory')
const { readSemanticChart } = require('../../server/services/pptx-import/ooxml-semantic-chart')
const { normalizeChartDocument } = require('../../shared/src/pptx-chart-document')
const S = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const bookPart = 'ppt/embeddings/feature-data.xlsx'
const sheetPart = 'xl/worksheets/sheet1.xml'
async function fixture(cells, change) {
  const zip = await JSZip.loadAsync((await buildFeatureFixture()).buffer)
  const book = await JSZip.loadAsync(await zip.file(bookPart).async('nodebuffer'))
  if (cells)
    book.file(
      sheetPart,
      `<worksheet xmlns="${S}"><dimension ref="A1"/><sheetData><row r="1">${cells}</row></sheetData></worksheet>`
    )
  if (change) await change(book, zip)
  zip.file(bookPart, await book.generateAsync({ type: 'nodebuffer' }))
  const inventory = await buildSemanticInventory(zip)
  const source = inventory.definitions.find((d) => d.kind === 'graphic-frame' && d.nativeId === '8')
  return { zip, book, inventory, source }
}
const read = async (cells, change) => readSemanticChart(await fixture(cells, change))
describe('embedded chart workbook literal snapshots', () => {
  it('reads authored workbook cells independently of chart caches with exact part hashes', async () => {
    const f = await fixture(
      '<c r="A1"><v>123.50</v></c><c r="XFD1" t="inlineStr"><is><t> far </t></is></c>'
    )
    const { document: d } = await readSemanticChart(f)
    const literals = d.workbook.literalData
    expect(literals.sheets[0]).toMatchObject({ name: 'Data', sheetId: '1', relationshipId: 'rId1' })
    expect(literals.sheets[0].cells.map((c) => [c.reference, c.literal])).toEqual([
      ['A1', { kind: 'number', value: 123.5, lexicalValue: '123.50' }],
      ['XFD1', { kind: 'string', value: ' far ', storage: 'inline' }],
    ])
    expect(literals.parts.find((p) => p.partUri === sheetPart).preconditionHash).toBe(
      createHash('sha256')
        .update(await f.book.file(sheetPart).async('nodebuffer'))
        .digest('hex')
    )
    expect(literals.sheets[0].cells[0].source).toMatchObject({
      partUri: sheetPart,
      path: [0, 1, 0, 0],
    })
    expect(d.plots[0].series[0].data.val.cache.points.map((p) => p.value)).toEqual([7, 11])
    expect(normalizeChartDocument(JSON.parse(JSON.stringify(d)))).toEqual(d)
    expect(d.workbook.fetchPolicy).toBe('deny')
  })
  it('distinguishes shared/inline strings, booleans, errors, blanks, explicit dates and formula caches', async () => {
    const { document: d } = await read(
      '<c r="A1" t="s"><v>0</v></c><c r="B1" t="b"><v>0</v></c><c r="C1" t="e"><v>#N/A</v></c><c r="D1"/><c r="E1" t="d"><v>2026-10-16T00:00:00Z</v></c><c r="F1" t="str"><f>A1&amp;"!"</f><v>cached!</v></c><c r="G1"><f>1+1</f></c>',
      async (book) => {
        book.file(
          'xl/sharedStrings.xml',
          `<sst xmlns="${S}"><si><r><t>shared</t></r><r><t> text</t></r></si></sst>`
        )
        const p = 'xl/_rels/workbook.xml.rels'
        book.file(
          p,
          (await book.file(p).async('string')).replace(
            '</Relationships>',
            `<Relationship Id="strings" Type="${R}/sharedStrings" Target="sharedStrings.xml"/></Relationships>`
          )
        )
      }
    )
    const c = d.workbook.literalData.sheets[0].cells
    expect(c.map((x) => x.literal)).toEqual([
      { kind: 'string', value: 'shared text', storage: 'shared', sharedStringIndex: 0 },
      { kind: 'boolean', value: false, lexicalValue: '0' },
      { kind: 'error', value: '#N/A' },
      { kind: 'blank' },
      { kind: 'date', value: '2026-10-16T00:00:00Z' },
      { kind: 'string', value: 'cached!', storage: 'formula' },
      { kind: 'blank' },
    ])
    expect(c[0].sharedStringSource.partUri).toBe('xl/sharedStrings.xml')
    expect(c[5].formula).toEqual({ text: 'A1&"!"', attributes: {} })
    expect(c[5].cached).toBe(true)
    expect(c[6].cached).toBe(false)
    expect(c[3]).not.toHaveProperty('cached')
  })
  it('preserves style and date-system declarations without guessing serial date conversions', async () => {
    const { document: d } = await read('<c r="A1" s="0"><v>60</v></c>', async (book) => {
      book.file(
        'xl/styles.xml',
        `<styleSheet xmlns="${S}"><numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy-mm-dd"/></numFmts><cellXfs count="1"><xf numFmtId="164"/></cellXfs></styleSheet>`
      )
      const p = 'xl/_rels/workbook.xml.rels'
      book.file(
        p,
        (await book.file(p).async('string')).replace(
          '</Relationships>',
          `<Relationship Id="styles" Type="${R}/styles" Target="styles.xml"/></Relationships>`
        )
      )
      const w = 'xl/workbook.xml'
      book.file(
        w,
        (await book.file(w).async('string')).replace(
          '<sheets>',
          '<workbookPr date1904="1"/><sheets>'
        )
      )
    })
    expect(d.workbook.literalData.date1904).toBe(true)
    expect(d.workbook.literalData.sheets[0].cells[0]).toMatchObject({
      literal: { kind: 'number', value: 60, lexicalValue: '60' },
      styleIndex: 0,
    })
    expect(d.workbook.literalData.styles.cellFormats[0].attributes.numFmtId).toBe('164')
    expect(d.workbook.literalData.styles.numberFormats[0].formatCode).toBe('yyyy-mm-dd')
  })
  it.each([
    '<c r="A1" t="s"><v>99</v></c>',
    '<c r="A1" t="b"><v>2</v></c>',
    '<c r="A1"><v>NaN</v></c>',
    '<c r="A1"/><c r="A1"/>',
    '<c r="XFE1"><v>2</v></c>',
    '<c r="A2"><v>2</v></c>',
    '<c r="A1" t="d"><v>2026-02-30</v></c>',
  ])('rejects invalid workbook cells atomically: %s', async (cells) => {
    await expect(read(cells)).rejects.toMatchObject({ code: 'PPTX_SEMANTIC_CHART_FAILED' })
  })
  it('rejects external sheet relationships without fetching', async () => {
    await expect(
      read(null, async (book) => {
        const p = 'xl/_rels/workbook.xml.rels'
        book.file(
          p,
          (await book.file(p).async('string')).replace(
            'Target="worksheets/sheet1.xml"',
            'Target="https://example.invalid/book" TargetMode="External"'
          )
        )
      })
    ).rejects.toThrow(/external/i)
  })
  it('decodes spreadsheet escapes once without interpreting escaped escape tokens twice', async () => {
    const { document: d } = await read(
      '<c r="A1" t="inlineStr"><is><t>_x0041__x005F_x0042_</t></is></c>'
    )
    expect(d.workbook.literalData.sheets[0].cells[0].literal.value).toBe('A_x0042_')
  })
  it('rejects tampered literal source hashes and external data injection on normalization', async () => {
    const { document: d } = await read()
    d.workbook.literalData.sheets[0].cells[0].source.preconditionHash = '0'.repeat(64)
    expect(() => normalizeChartDocument(d)).toThrow(/chart/i)
    const { document: external } = await read()
    external.workbook.external = true
    expect(() => normalizeChartDocument(external)).toThrow(/chart/i)
  })
  it('keeps every sheet and shared formula metadata in source order', async () => {
    const { document: d } = await read(
      '<c r="A1"><f t="shared" si="0" ref="A1:B1">2+2</f><v>4</v></c><c r="B1"><f t="shared" si="0"/><v>4</v></c>',
      async (book) => {
        const w = 'xl/workbook.xml',
          r = 'xl/_rels/workbook.xml.rels'
        book.file(
          w,
          (await book.file(w).async('string')).replace(
            '</sheets>',
            '<sheet name="Other" sheetId="9" r:id="other"/></sheets>'
          )
        )
        book.file(
          r,
          (await book.file(r).async('string')).replace(
            '</Relationships>',
            `<Relationship Id="other" Type="${R}/worksheet" Target="worksheets/other.xml"/></Relationships>`
          )
        )
        book.file(
          'xl/worksheets/other.xml',
          `<worksheet xmlns="${S}"><sheetData><row r="1048576"><c r="XFD1048576" t="inlineStr"><is><t>last</t></is></c></row></sheetData></worksheet>`
        )
      }
    )
    expect(d.workbook.literalData.sheets.map((s) => s.name)).toEqual(['Data', 'Other'])
    expect(d.workbook.literalData.sheets[0].cells[1].formula).toEqual({
      text: '',
      attributes: { t: 'shared', si: '0' },
    })
    expect(d.workbook.literalData.sheets[1].cells[0].reference).toBe('XFD1048576')
  })
  it('rejects workbook bytes changed after inventory without returning a partial result', async () => {
    const f = await fixture()
    f.zip.file(bookPart, Buffer.from('changed workbook'))
    await expect(readSemanticChart(f)).rejects.toThrow(/workbook hash mismatch/i)
  })
  it('retains empty numeric caches as blank rather than zero', async () => {
    const { document: d } = await read('<c r="A1"><f>NA()</f><v/></c>')
    expect(d.workbook.literalData.sheets[0].cells[0]).toMatchObject({
      literal: { kind: 'blank' },
      cached: true,
    })
  })
})
