import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { fieldFixture, fieldPart } from './field-fixtures'
import { stableZip } from './feature-fixtures'
const require = createRequire(import.meta.url)
const { buildSemanticInventory } = require('../../server/services/pptx-import/semantic-inventory')
const { parseXml } = require('../../server/services/pptx-import/ooxml-text-run-xml')
const { readSemanticTable } = require('../../server/services/pptx-import/ooxml-semantic-table')
const { projectTableFrame } = require('../../server/services/pptx-import/semantic-table-adapter')
const { normalizeTableDocument } = require('../../shared/src/pptx-table-document')
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
const P14 = 'http://schemas.microsoft.com/office/powerpoint/2010/main'
const A16 = 'http://schemas.microsoft.com/office/drawing/2014/main'
const MOD_ID = '{D42A27DB-BD31-4B8C-83A1-F6EECF244321}'
const COLUMN_ID = '{9D8B030D-6E8A-4147-A177-3AD203B41FA5}'
const ROW_ID = '{0D108BD9-81ED-4DB2-BD59-A6C34878D82A}'
const modIdExtension = `<p:extLst><p:ext uri="${MOD_ID}"><p14:modId xmlns:p14="${P14}" val="1085222214"/></p:ext></p:extLst>`
const columnExtensions = (xml) => xml
  .replace('<a:gridCol w="914401"/>', `<a:gridCol w="914401"><a:extLst><a:ext uri="${COLUMN_ID}"><a16:colId xmlns:a16="${A16}" val="20000"/></a:ext></a:extLst></a:gridCol>`)
  .replace('<a:gridCol w="1828801"/>', `<a:gridCol w="1828801"><a:extLst><a:ext uri="${COLUMN_ID}"><a16:colId xmlns:a16="${A16}" val="20001"/></a:ext></a:extLst></a:gridCol>`)
const rowExtensions = (xml) => {
  let rowId = 10000
  return xml.replace(/<\/a:tr>/g, () => `<a:extLst><a:ext uri="${ROW_ID}"><a16:rowId xmlns:a16="${A16}" val="${rowId++}"/></a:ext></a:extLst></a:tr>`)
}
const tableExtensions = (xml) => rowExtensions(columnExtensions(xml))
const rich = '<a:p><a:pPr algn="ctr" marL="123"><a:defRPr sz="1100"/></a:pPr>' +
  '<a:r><a:rPr sz="1234" b="0" i="1" lang="en-US"><a:latin typeface="A&amp;B"/><a:solidFill><a:srgbClr val="123456"/></a:solidFill></a:rPr><a:t xml:space="preserve"> A&amp;B&#xA0; </a:t></a:r>' +
  '<a:br/><a:fld id="field-1" type="slidenum"><a:rPr smtClean="0"/><a:pPr/><a:t>3</a:t></a:fld><a:endParaRPr sz="1400"/></a:p>'
const cell = (attrs = '', text = '<a:p/>', props = '') =>
  `<a:tc ${attrs}><a:txBody><a:bodyPr wrap="square" lIns="123"/><a:lstStyle/>${text}</a:txBody><a:tcPr${props ? ` ${props}` : ''}/></a:tc>`
const table = () => '<a:tbl><a:tblPr rtl="0"/><a:tblGrid><a:gridCol w="914401"/><a:gridCol w="1828801"/></a:tblGrid>' +
  `<a:tr h="457201">${cell('gridSpan="2" rowSpan="2"', rich, 'marL="10" marR="20" marT="30" marB="40" anchor="ctr" anchorCtr="0" vert="vert270"')}${cell('hMerge="1" rowSpan="2"')}</a:tr>` +
  `<a:tr h="457202">${cell('vMerge="1" gridSpan="2"')}${cell('hMerge="1" vMerge="1"')}</a:tr></a:tbl>`

async function fixture(change = (x) => x, options = {}) {
  const zip = fieldFixture('', options)
  let xml = await zip.file(fieldPart).async('string')
  const prefix = options.aliases ? ['pres', 'draw'] : ['p', 'a']
  const tableXml = options.tableMetadata ? tableExtensions(table()) :
    options.columnMetadata ? columnExtensions(table()) : options.rowMetadata ? rowExtensions(table()) : table()
  let frame = `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="7" name="Table">${options.identityExtension ?? ''}</p:cNvPr><p:cNvGraphicFramePr/><p:nvPr>${options.frameExtension ?? (options.frameMetadata ? modIdExtension : '')}</p:nvPr></p:nvGraphicFramePr><p:xfrm><a:off x="0" y="0"/><a:ext cx="2743202" cy="914403"/></p:xfrm><a:graphic><a:graphicData uri="${options.strict ? 'http://purl.oclc.org/ooxml/drawingml/table' : A.replace('/main', '/table')}">${change(tableXml)}</a:graphicData></a:graphic></p:graphicFrame>`
  if (options.encodedIdentity) frame = frame.replace('id="7"', 'id="&#55;"')
  frame = frame.replace(/(<\/?)p:/g, `$1${prefix[0]}:`).replace(/(<\/?)a:/g, `$1${prefix[1]}:`)
  xml = xml.replace(new RegExp(`<${prefix[0]}:sp>[\\s\\S]*?</${prefix[0]}:sp>`), frame)
  zip.file(fieldPart, xml)
  const inventory = await buildSemanticInventory(zip), roots = parseXml(xml), nodes = new Map()
  for (const item of inventory.definitions.filter((d) => d.partUri === fieldPart)) {
    let node = { children: roots }
    for (const index of item.componentLocators[0].path) node = node.children[index]
    nodes.set(item.id, node)
  }
  const source = inventory.definitions.find((d) => d.partUri === fieldPart && d.kind === 'graphic-frame')
  const components = inventory.definitions.filter((d) => d.partUri === fieldPart && d.id !== source.id)
  return { zip, inventory, context: { xml, source, node: nodes.get(source.id), nodes, components } }
}

describe('strict relationship-bound OOXML table source reader', () => {
  it.each([{ strict: false }, { strict: true }, { aliases: true }, { aliases: true, strict: true }, { encodedIdentity: true }])(
    'retains merged rich cells and exact inventory identities with %j', async (options) => {
      const { zip, inventory, context } = await fixture(undefined, options), bytes = await stableZip(zip)
      const before = JSON.stringify(inventory), result = readSemanticTable(context), d = result.tableDocument
      expect(d.columns.map((c) => c.widthEmu)).toEqual([914401, 1828801])
      expect(d.rows.map((r) => r.heightEmu)).toEqual([457201, 457202])
      expect(d.rows.flatMap((r) => r.cells).map((c) => c.anchorCellId)).toEqual(Array(4).fill(d.rows[0].cells[0].componentId))
      const first = d.rows[0].cells[0], paragraph = first.textDocument.paragraphs[0]
      expect(first.properties).toEqual({ marginLeftEmu: 10, marginRightEmu: 20, marginTopEmu: 30, marginBottomEmu: 40, verticalAlign: 'ctr', anchorCenter: false, verticalText: 'vert270' })
      expect(first.textDocument.body).toEqual({ wrap: true, insetLeftEmu: 123 })
      expect(paragraph.properties).toEqual({ alignment: 'ctr', marginLeftEmu: 123 })
      expect(paragraph.defaultRunProperties).toEqual({ fontSizePt: 11 })
      expect(paragraph.endRunProperties).toEqual({ fontSizePt: 14 })
      expect(paragraph.runs.map((r) => [r.kind, r.text])).toEqual([['text', ' A&B\u00a0 '], ['break', undefined], ['field', '3']])
      expect(paragraph.runs[0].properties).toEqual({ fontSizePt: 12.34, bold: false, italic: true, language: 'en-US', fontLatin: { typeface: 'A&B' }, color: { kind: 'srgb', value: '123456' } })
      expect(paragraph.runs[2].proofing).toEqual({ smtClean: false })
      for (const component of context.components) {
        expect(result.mappedDefinitionIds).toContain(component.id)
        expect(result.components.find((c) => c.id === component.id)?.locator).toEqual(component.componentLocators[0])
      }
      expect(new Set(result.mappedDefinitionIds)).toEqual(new Set(context.components.map((c) => c.id)))
      expect(new Set(result.components.map((c) => c.id)).size).toBe(result.components.length)
      expect(result.components.filter((c) => c.kind === 'cell').map((c) => c.id))
        .toEqual(d.rows.flatMap((r) => r.cells.map((c) => c.componentId)))
      const body = result.components.find((c) => c.id === first.textDocument.componentId)
      let node = { children: parseXml(context.xml) }
      for (const index of body.locator.path) node = node.children[index]
      expect(node.local).toBe('txBody')
      expect(inventory.occurrences.filter((o) => o.definitionId === context.source.id).map((o) => o.relationshipChain))
        .toEqual([['ppt/slides/slide9.xml', 'layout'], ['ppt/slides/slide3.xml', 'layout']])
      expect(Object.isFrozen(d.rows[0].cells[0])).toBe(true)
      expect(normalizeTableDocument(JSON.parse(JSON.stringify(d)))).toEqual(d)
      expect(JSON.stringify(inventory)).toBe(before)
      expect(await stableZip(zip)).toEqual(bytes)
    })
  it('resolves table-cell list-style defaults beneath direct paragraph properties', async () => {
    const { context, zip } = await fixture((xml) => {
      const listStyle = '<a:lstStyle><a:defPPr marL="457200" algn="l"><a:defRPr sz="1800" i="0"/></a:defPPr>' +
        '<a:lvl1pPr marL="914400" algn="r"><a:defRPr sz="2000" b="1"><a:latin typeface="Verdana"/></a:defRPr></a:lvl1pPr></a:lstStyle>'
      return xml.replace('<a:lstStyle/>', listStyle)
        .replace('<a:pPr algn="ctr" marL="123">', '<a:pPr algn="ctr">')
        .replace('</a:p>', '</a:p><a:p><a:pPr lvl="1"/><a:r><a:t>fallback</a:t></a:r></a:p>')
    })
    const before = await stableZip(zip), document = readSemanticTable(context).tableDocument
    const paragraphs = document.rows[0].cells[0].textDocument.paragraphs
    expect(paragraphs[0].properties).toEqual({ alignment: 'ctr', marginLeftEmu: 914400 })
    expect(paragraphs[0].defaultRunProperties).toEqual({ fontSizePt: 11, bold: true, italic: false, fontLatin: { typeface: 'Verdana' } })
    expect(paragraphs[1].properties).toEqual({ level: 1, marginLeftEmu: 457200, alignment: 'l' })
    expect(paragraphs[1].defaultRunProperties).toEqual({ fontSizePt: 18, italic: false })
    expect(await stableZip(zip)).toEqual(before)
  })

  it('accepts empty field paragraph properties without run properties', async () => {
    const { context } = await fixture((source) => source.replace('<a:rPr smtClean="0"/>', ''))
    const field = readSemanticTable(context).tableDocument.rows[0].cells[0].textDocument.paragraphs[0].runs[2]
    expect(field).toMatchObject({ kind: 'field', text: '3', field: { id: 'field-1', type: 'slidenum' }, properties: {} })
  })
  it('admits source-bound column and row identity extensions without changing package bytes', async () => {
    const { context, zip } = await fixture(undefined, { tableMetadata: true }), before = await stableZip(zip)
    const result = readSemanticTable(context)
    expect(result.tableDocument.columns.map((column) => column.widthEmu)).toEqual([914401, 1828801])
    expect(result.tableDocument.rows.map((row) => row.cells.length)).toEqual([2, 2])
    expect(new Set(result.mappedDefinitionIds)).toEqual(new Set(context.components.map((component) => component.id)))
    expect(await stableZip(zip)).toEqual(before)
  })
  it('admits source-bound frame modification identity without changing package bytes', async () => {
    const { context, zip } = await fixture(undefined, { frameMetadata: true }), before = await stableZip(zip)
    const result = await projectTableFrame(context)
    expect(result.kind).toBe('table')
    expect(result.content.tableDocument.rows).toHaveLength(2)
    expect(new Set(result.mappedDefinitionIds)).toEqual(new Set([...context.components.map((component) => component.id), context.source.id]))
    expect(await stableZip(zip)).toEqual(before)
  })
  it.each([
    ['wrong column extension URI', (xml) => xml.replace(COLUMN_ID, '{BAD-EXTENSION-URI}'), 'ext', 'columnMetadata'],
    ['malformed column identifier', (xml) => xml.replace('val="20000"', 'val="not-an-integer"'), 'colId', 'columnMetadata'],
    ['malformed row identifier', (xml) => xml.replace('val="10000"', 'val="not-an-integer"'), 'rowId', 'rowMetadata'],
    ['row extension before cells', (xml) => xml.replace(/(<a:tr h="457201">)([\s\S]*?)(<a:extLst>[\s\S]*?<\/a:extLst>)/, '$1$3$2'), 'extLst', 'rowMetadata'],
  ])('rejects %s without admitting a partial table', async (_title, mutate, localName, metadata) => {
    const { context } = await fixture(mutate, { [metadata]: true })
    let error
    try { readSemanticTable(context) } catch (caught) { error = caught }
    expect(error?.code).toBe('PPTX_SEMANTIC_ADMISSION_FAILED')
    expect(error?.sourceLocation).toMatchObject({ partUri: fieldPart, localName })
  })
  it.each([
    ['unknown modification extension URI', modIdExtension.replace(MOD_ID, '{BAD-EXTENSION-URI}'), 'ext'],
    ['malformed modification identifier', modIdExtension.replace('val="1085222214"', 'val="not-an-integer"'), 'modId'],
  ])('rejects %s in nonvisual frame metadata', async (_title, frameExtension, localName) => {
    const { context } = await fixture(undefined, { frameExtension })
    await expect(projectTableFrame(context)).rejects.toMatchObject({
      code: 'PPTX_SEMANTIC_ADMISSION_FAILED', sourceLocation: { partUri: fieldPart, localName },
    })
  })
  it('rejects unknown nonvisual frame children', async () => {
    const { context } = await fixture(undefined, { frameExtension: '<p:ph type="body"/>' })
    await expect(projectTableFrame(context)).rejects.toMatchObject({
      code: 'PPTX_SEMANTIC_ADMISSION_FAILED', sourceLocation: { partUri: fieldPart, localName: 'nvPr' },
    })
  })

  it('retains solid/none fills and native border declarations', async () => {
    const { context } = await fixture((s) => s.replace('<a:tcPr/>', '<a:tcPr><a:lnL w="12701" cap="rnd"><a:solidFill><a:srgbClr val="ABCDEF"/></a:solidFill><a:prstDash val="dash"/><a:round/><a:headEnd type="triangle" w="sm" len="lg"/><a:tailEnd type="arrow"/></a:lnL><a:noFill/></a:tcPr>'))
    expect(readSemanticTable(context).tableDocument.rows[0].cells[1].properties).toEqual({
      fill: { color: { kind: 'none' } },
      borders: { left: { width: 12701, cap: 'rnd', color: { kind: 'srgb', value: 'ABCDEF' }, dash: { kind: 'preset', value: 'dash' }, join: { kind: 'round' }, headEnd: { type: 'triangle', w: 'sm', len: 'lg' }, tailEnd: { type: 'arrow' } } },
    })
  })

  it.each([
    ['gridSpan="2"', 'gridSpan="3"', 'tc'],
    ['hMerge="1"', 'hMerge="yes"', 'tc'],
    ['rowSpan="2"', 'rowSpan="0"', 'tc'],
    ['<a:tcPr/>', '<a:tcPr><a:extLst/></a:tcPr>', 'extLst'],
    ['<a:tcPr/>', '<a:tcPr bogus="1"/>', 'tcPr'],
    ['<a:tcPr/>', '<a:tcPr xmlns:x="urn:wrong"><x:solidFill/></a:tcPr>', 'solidFill'],
    ['<a:tblPr rtl="0"/>', '<a:tblPr><a:tableStyleId>unresolved</a:tableStyleId></a:tblPr>', 'tableStyleId'],
    ['<a:t xml:space="preserve">', '<a:t bogus="1">', 't'],
    ['<a:br/>', '<a:br><a:t>lost</a:t></a:br>', 't'],
    ['<a:p/>', '<a:p><a:mystery/></a:p>', 'mystery'],
    ['<a:gridCol w="914401"/>', '<a:gridCol w="1.5"/>', 'gridCol'],
    ['<a:tblPr rtl="0"/>', '<a:tblPr rtl="0" rtl="1"/>', 'tblPr'],
    ['<a:tcPr/>', '<a:tcPr>unparsed</a:tcPr>', 'tcPr'],
    ['<a:tbl>', '<a:tbl xmlns:a="urn:wrong">', 'tbl'],
    ['<a:gridCol w="914401"/>', '<a:gridCol w="914401"/><a:gridCol w="1"/>', 'tr'],
    ['hMerge="1" vMerge="1"', 'hMerge="1" vMerge="0"', 'tc'],
    ['<a:rPr sz="1234"', '<a:rPr sz="0"', 'rPr'],
    ['<a:rPr smtClean="0"/>', '<a:rPr sz="0"/>', 'rPr'],
    ['<a:rPr smtClean="0"/>', '<a:rPr unknown="0"/>', 'rPr'],
    ['<a:rPr smtClean="0"/>', '<a:rPr><a:latin typeface="X" unknown="0"/></a:rPr>', 'latin'],
    ['<a:t>3</a:t>', '<a:t xml:space="bad">3</a:t>', 't'],
    ['<a:t>3</a:t>', '<a:t>&invalid;</a:t>', 't'],
    ['<a:tcPr/>', '<a:tcPr><a:gradFill/></a:tcPr>', 'gradFill'],
    ['<a:tcPr/>', '<a:tcPr><a:lnL><a:headEnd type="chevron"/></a:lnL></a:tcPr>', 'lnL'],
    ['<a:tcPr/>', '<a:tcPr><a:lnL><a:tailEnd len="xl"/></a:lnL></a:tcPr>', 'lnL'],
    ['<a:tcPr/>', '<a:tcPr><a:lnL><a:headEnd/><a:headEnd/></a:lnL></a:tcPr>', 'headEnd'],
    ['<a:tcPr/>', '<a:tcPr><a:noFill/><a:solidFill><a:srgbClr val="000000"/></a:solidFill></a:tcPr>', 'solidFill'],
    ['<a:pPr/>', '<a:pPr algn="ctr"/>', 'pPr'],
    ['<a:pPr/>', '<a:pPr><a:spcBef/></a:pPr>', 'spcBef'],
    ['<a:rPr smtClean="0"/><a:pPr/>', '<a:pPr/><a:rPr smtClean="0"/>', 'fld'],
  ])('locates unsupported/malformed %s without admitting a partial table', async (from, to, localName) => {
    const { context, zip } = await fixture((s) => s.replace(from, to)), before = await stableZip(zip)
    let error
    try { readSemanticTable(context) } catch (caught) { error = caught }
    expect(error?.code).toBe('PPTX_SEMANTIC_ADMISSION_FAILED')
    expect(error?.sourceLocation).toMatchObject({ partUri: fieldPart, localName })
    expect(error?.sourceLocation.path.every(Number.isSafeInteger)).toBe(true)
    expect(await stableZip(zip)).toEqual(before)
  })

  it('rejects wrong-owner, missing and stale inventory bindings', async () => {
    for (const mode of ['owner', 'missing', 'hash', 'node']) {
      const { context } = await fixture()
      const target = context.components.find((c) => c.kind === 'table-cell')
      if (mode === 'owner') target.parentDefinitionId = context.source.id
      if (mode === 'missing') context.components = context.components.filter((c) => c !== target)
      if (mode === 'hash') target.preconditionHash = '0'.repeat(64)
      if (mode === 'node') context.nodes.set(target.id, context.node)
      expect(() => readSemanticTable(context)).toThrow()
    }
  })

  it('preserves authored content in covered cells instead of discarding it', async () => {
    const { context } = await fixture((s) => s.replace('<a:p/>', '<a:p><a:r><a:t>covered source</a:t></a:r></a:p>'))
    const d = readSemanticTable(context).tableDocument
    expect(d.rows[0].cells[1].textDocument.paragraphs[0].runs[0].text).toBe('covered source')
    expect(d.rows[0].cells[1].anchorCellId).toBe(d.rows[0].cells[0].componentId)
  })
})
