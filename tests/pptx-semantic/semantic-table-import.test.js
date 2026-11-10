import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import {
  importTableFixture as imported,
  tableFrame as frame,
  tablePart as part,
} from './table-import-fixture'

const require = createRequire(import.meta.url)
const { normalizeSemanticPresentation } = require('../../shared/src/pptx-semantic-presentation')
const { semanticRenderTree } = require('../../shared/src/pptx-semantic-render-tree')
const { compactSemanticGraph } = require('../../shared/src/pptx-semantic-source-graph')
const { semanticDefinition, semanticInstance } = require('../../shared/src/pptx-semantic-records')
const { applyPresentationProjectionOperation } = require('../../shared/src/pptx-projection-operation')
const { materializeFamilyDocument } = require('../../shared/src/pptx-family-operations')
const guid = '{12345678-1234-5678-9ABC-123456789ABC}'
const { createHash } = require('node:crypto')
const JSZip = require('jszip')
const { buildSemanticInventory } = require('../../server/services/pptx-import/semantic-inventory')
const { projectSemanticImport } = require('../../server/services/pptx-import/semantic-projector')
const P = 'http://schemas.openxmlformats.org/presentationml/2006/main'
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex')
async function tablePackage(customGraphic = frame()) {
  const zip = new JSZip()
  zip.file(
    '[Content_Types].xml',
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/></Types>'
  )
  zip.file(
    'ppt/presentation.xml',
    `<p:presentation xmlns:p="${P}" xmlns:r="${R}"><p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst><p:sldSz cx="9144000" cy="5143500"/></p:presentation>`
  )
  zip.file(
    'ppt/_rels/presentation.xml.rels',
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/slide" Target="slides/slide7.xml"/></Relationships>`
  )
  zip.file(part, `<p:sld xmlns:p="${P}" xmlns:a="${A}"><p:cSld><p:spTree>${customGraphic}</p:spTree></p:cSld></p:sld>`)
  return zip
}
async function snapshotZip(zip) {
  return new Map(await Promise.all(Object.values(zip.files).filter(entry => !entry.dir)
    .map(async entry => [entry.name, await entry.async('nodebuffer')])))
}
async function assertZipUnchanged(zip, before) {
  expect(Object.values(zip.files).filter(entry => !entry.dir).map(entry => entry.name).sort())
    .toEqual([...before.keys()].sort())
  for (const [name, bytes] of before) expect(await zip.file(name).async('nodebuffer'), name).toEqual(bytes)
}
const identity = `<a:extLst><a:ext uri="{FF2B5EF4-FFF2-40B4-BE49-F238E27FC236}"><ci:creationId xmlns:ci="http://schemas.microsoft.com/office/drawing/2014/main" id="${guid}"/></a:ext></a:extLst>`

describe('table source through the production semantic projector', () => {
  it('retains native row and column identities through isolated edits and graph reopen', async () => {
    const extension = (name, value, uri) => `<a:extLst><a:ext uri="${uri}"><a16:${name} xmlns:a16="http://schemas.microsoft.com/office/drawing/2014/main" val="${value}"/></a:ext></a:extLst>`
    const columnIdentity = extension('colId', 20000, '{9D8B030D-6E8A-4147-A177-3AD203B41FA5}')
    const rowIdentity = extension('rowId', 10000, '{0D108BD9-81ED-4DB2-BD59-A6C34878D82A}')
    const graphic = frame()
      .replace('<a:gridCol w="1371600"/>', `<a:gridCol w="1371600">${columnIdentity}</a:gridCol>`)
      .replace('</a:tr>', `${rowIdentity}</a:tr>`)
    const { presentation } = await imported({ graphic, geometryInheritance: true })
    const base = structuredClone(presentation)
    const definition = Object.values(base.pptxSemantic.definitions).find(value => value.kind === 'table')
    const table = definition.content.tableDocument
    expect(table.columns[0].identity).toMatchObject({ value: 20000, componentId: expect.stringContaining('#unknown-extension:') })
    expect(table.rows[0].identity).toMatchObject({ value: 10000, componentId: expect.stringContaining('#unknown-extension:') })
    const instance = Object.values(base.pptxSemantic.instances).find(value => value.definitionId === definition.id)
    const siblingId = `${instance.id}:sibling`
    base.pptxSemantic.instances[siblingId] = { ...structuredClone(instance), id: siblingId, paintIndex: instance.paintIndex + 1 }
    const element = base.slides[0].elements.find(value => value.pptxInstanceId === instance.id)
    base.slides[0].elements.push({ ...structuredClone(element), id: siblingId, pptxInstanceId: siblingId })
    const before = structuredClone(base)
    const next = applyPresentationProjectionOperation(base, {
      type: 'table.edit', instanceId: instance.id, componentId: table.componentId,
      command: { type: 'setColumnWidth', columnId: table.columns[0].componentId, widthEmu: 123456 },
    })
    const reopened = normalizeSemanticPresentation(JSON.parse(JSON.stringify({ ...next, pptxSemantic: compactSemanticGraph(next.pptxSemantic) })))
    const reopenedDefinition = semanticDefinition(reopened.pptxSemantic, definition.id)
    const effective = materializeFamilyDocument(reopenedDefinition, semanticInstance(reopened.pptxSemantic, instance.id))
    expect(effective.columns[0]).toMatchObject({ widthEmu: 123456, identity: table.columns[0].identity })
    expect(effective.rows[0].identity).toEqual(table.rows[0].identity)
    expect(reopenedDefinition).toEqual(definition)
    expect(semanticInstance(reopened.pptxSemantic, siblingId)).toEqual(before.pptxSemantic.instances[siblingId])
    expect(base).toEqual(before)
  })

  it.each([
    'http://schemas.openxmlformats.org/drawingml/2006/main/table',
    'http://purl.oclc.org/ooxml/drawingml/main/table',
  ])('imports producer table URI %s without losing rich cell data', async (uri) => {
    const graphic = frame().replace('http://schemas.openxmlformats.org/drawingml/2006/table', uri)
    const { presentation } = await imported({ graphic })
    const definition = Object.values(presentation.pptxSemantic.definitions).find((entry) => entry.kind === 'table')
    expect(definition.content.tableDocument.rows[0].cells[0].textDocument.paragraphs[0].runs
      .map((run) => [run.text, run.properties.fontSizePt])).toEqual([['Merged & ', 12], ['rich', 24]])
    expect(presentation.slides[0].elements[0].data).toEqual([['Merged & rich', 'Covered'], ['A', 'B']])
  })
  it.each([
    'https://foreign.test/drawingml/2006/main/table',
    'http://schemas.openxmlformats.org/drawingml/2006/main/table/extension',
  ])('rejects non-whitelisted table URI %s', async (uri) => {
    await expect(imported({ graphic: frame().replace('http://schemas.openxmlformats.org/drawingml/2006/table', uri) }))
      .rejects.toMatchObject({ code: 'PPTX_SEMANTIC_ADMISSION_FAILED',
        sourceLocation: { localName: 'graphicData' } })
  })
  it.each([false, true])(
    'retains typed cells, components and authored placement (linked=%s)',
    async (geometryInheritance) => {
      const { presentation, hash } = await imported({ geometryInheritance })
      const document = presentation.pptxSemantic
      const definition = Object.values(document.definitions).find((entry) => entry.kind === 'table')
      expect(definition.source).toMatchObject({
        partUri: part,
        nativeId: '7',
        preconditionHash: hash,
      })
      expect(definition.source.componentLocator.path).toEqual([0, 0, 0, 0])
      const sourceTable = definition.content.tableDocument
      expect(sourceTable.columns.map((column) => column.widthEmu)).toEqual([1371600, 1371600])
      expect(sourceTable.rows.map((row) => row.heightEmu)).toEqual([457200, 685800])
      const [anchor, covered] = sourceTable.rows[0].cells
      expect(
        anchor.textDocument.paragraphs[0].runs.map((run) => [run.text, run.properties.fontSizePt])
      ).toEqual([
        ['Merged & ', 12],
        ['rich', 24],
      ])
      expect(covered.anchorCellId).toBe(anchor.componentId)
      expect(covered.textDocument.paragraphs[0].runs[0].text).toBe('Covered')
      const components = new Map(
        definition.components.map((component) => [component.id, component])
      )
      expect(components.size).toBe(definition.components.length)
      expect(components.get(anchor.componentId).kind).toBe('cell')
      expect(components.get(sourceTable.rows[0].componentId).kind).toBe('row')
      expect(components.get(sourceTable.columns[0].componentId).kind).toBe('column')
      expect(
        [...components.values()].every((component) => component.locator.preconditionHash === hash)
      ).toBe(true)
      const element = presentation.slides[0].elements[0]
      expect(element).toMatchObject({ type: 'table', width: 288, height: 192 })
      expect(element.data).toEqual([
        ['Merged & rich', 'Covered'],
        ['A', 'B'],
      ])
      const tree = semanticRenderTree(document, presentation.slides[0])
      expect(tree[0].kind).toBe('table')
      expect(tree[0].transform).not.toBe('matrix(1,0,0,1,0,0)')
      const reopened = normalizeSemanticPresentation(JSON.parse(JSON.stringify(presentation)))
      expect(reopened.pptxSemantic).toEqual(document)
      expect(reopened.slides).toEqual(presentation.slides)
    }
  )

  it('keeps schema-two linked geometry when a table shares the package with a shape', async () => {
    const shape =
      '<p:sp><p:nvSpPr><p:cNvPr id="8" name="Shape"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="914400" cy="914400"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr></p:sp>'
    const { presentation } = await imported({
      graphic: frame() + shape,
      geometryInheritance: true,
    })
    expect(presentation.pptxSemantic.schemaVersion).toBe(2)
    const definitions = Object.values(presentation.pptxSemantic.definitions)
    expect(definitions.find((entry) => entry.kind === 'shape').content.geometrySource).toBeDefined()
    expect(definitions.find((entry) => entry.kind === 'table').content.tableDocument).toBeDefined()
    expect(semanticRenderTree(presentation.pptxSemantic, presentation.slides[0])).toHaveLength(2)
    const serialized = JSON.parse(JSON.stringify(presentation))
    expect(normalizeSemanticPresentation(serialized).pptxSemantic).toEqual(serialized.pptxSemantic)
  })

  it('keeps native frame creation identity outside the table payload bindings', async () => {
    const { presentation } = await imported({ graphic: frame(identity) })
    const definition = Object.values(presentation.pptxSemantic.definitions)[0]
    expect(definition.source.creationId).toEqual({ value: guid, componentId: expect.any(String) })
    expect(
      definition.components.find((entry) => entry.id === definition.source.creationId.componentId)
    ).toMatchObject({ kind: 'property' })
    expect(
      normalizeSemanticPresentation(JSON.parse(JSON.stringify(presentation))).pptxSemantic
    ).toEqual(presentation.pptxSemantic)
  })

  it.each([
    (xml) => xml.replace('<p:xfrm ', '<p:xfrm unexpected="1" '),
    (xml) => xml.replace('rot="1800000"', 'rot="bad"'),
    (xml) => xml.replace('flipH="1"', 'flipH="yes"'),
    (xml) => xml.replace('<a:off x="-9525" y="19050"/>', ''),
    (xml) => xml.replace('cx="2743200"', 'cx="-1"'),
    (xml) => xml.replace('</p:xfrm>', '<a:chOff x="0" y="0"/></p:xfrm>'),
    (xml) => xml.replace('<p:nvPr/>', '<p:nvPr><p:ph/></p:nvPr>'),
    (xml) => xml.replace('<p:cNvGraphicFramePr/>', '<p:cNvGraphicFramePr unsupported="1"/>'),
    (xml) => xml.replace('</a:graphic>', '</a:graphic><p:extLst/>'),
    (xml) => xml.replace('<p:graphicFrame>', '<p:graphicFrame unexpected="1">'),
  ])('rejects unrepresented outer-frame declarations atomically %#', async (change) => {
    await expect(imported({ graphic: change(frame()) })).rejects.toMatchObject({
      code: 'PPTX_SEMANTIC_ADMISSION_FAILED',
      sourceLocation: { partUri: part },
    })
  })
  it('retains text-following bullet declarations over explicit table list defaults after reopen', async () => {
    const graphic = frame().replace('<a:lstStyle/>', '<a:lstStyle><a:defPPr><a:buClr><a:srgbClr val="FF0000"/></a:buClr><a:buSzPts val="2400"/><a:buFont typeface="Arial"/></a:defPPr></a:lstStyle>')
      .replace('<a:p>', '<a:p><a:pPr><a:buClrTx/><a:buSzTx/><a:buFontTx/><a:buChar char="•"/></a:pPr>')
    const { presentation } = await imported({ graphic })
    const restored = normalizeSemanticPresentation(JSON.parse(JSON.stringify(presentation)))
    const definition = Object.values(restored.pptxSemantic.definitions).find((entry) => entry.kind === 'table')
    expect(definition.content.tableDocument.rows[0].cells[0].textDocument.paragraphs[0].properties)
      .toEqual({ bulletColor: 'text', bulletSize: 'text', bulletFont: 'text', bullet: { kind: 'character', character: '•' } })
    expect(restored.pptxSemantic).toEqual(presentation.pptxSemantic)
  })
  it('retains authored typography on cell text, fields and paragraph ends without adding it to siblings', async () => {
    const properties = { kumimoji: false, capitalization: 'none', normalizeHeight: false }
    const attrs = 'kumimoji="0" cap="none" normalizeH="false"'
    const graphic = frame().replace('<a:rPr sz="1200"/>', `<a:rPr sz="1200" ${attrs}/>`)
      .replace('</a:p>', `<a:fld id="date" type="datetime"><a:rPr ${attrs}/><a:t>Cached date</a:t></a:fld><a:endParaRPr ${attrs}/></a:p>`)
    const { presentation } = await imported({ graphic })
    const restored = normalizeSemanticPresentation(JSON.parse(JSON.stringify(presentation)))
    const document = Object.values(restored.pptxSemantic.definitions).find((entry) => entry.kind === 'table').content.tableDocument
    const paragraph = document.rows[0].cells[0].textDocument.paragraphs[0]
    expect(paragraph.runs[0].properties).toEqual({ fontSizePt: 12, ...properties })
    expect(paragraph.runs.at(-1)).toMatchObject({ kind: 'field', text: 'Cached date', properties })
    expect(paragraph.endRunProperties).toEqual(properties)
    expect(document.rows[0].cells[1].textDocument.paragraphs[0].runs[0].properties).toEqual({ fontSizePt: 12 })
    expect(restored.pptxSemantic).toEqual(presentation.pptxSemantic)
  })
  it.each([
    '<a:buClrTx/><a:buClr><a:srgbClr val="FF0000"/></a:buClr>',
    '<a:buFontTx/><a:buFont typeface="Arial"/>',
    '<a:buSzTx/><a:buSzPct val="100000"/>',
    '<a:buClrTx val="invalid"/>',
    '<a:buClrTx><a:srgbClr val="FF0000"/></a:buClrTx>',
    '<foreign:buClrTx xmlns:foreign="urn:foreign"/>',
  ])('rejects conflicting or malformed cell bullet declarations at the source: %s', async (declaration) => {
    await expect(imported({ graphic: frame().replace('<a:p>', `<a:p><a:pPr>${declaration}</a:pPr>`) }))
      .rejects.toMatchObject({ code: 'PPTX_SEMANTIC_ADMISSION_FAILED', sourceLocation: { partUri: part, path: expect.any(Array) } })
  })
  it('admits empty effectLst on table text runs and rejects non-empty effectLst or attributes', async () => {
    const withEmpty = frame().replace('<a:rPr sz="1200"/>', '<a:rPr sz="1200"><a:effectLst/></a:rPr>')
    const { presentation } = await imported({ graphic: withEmpty })
    const def = Object.values(presentation.pptxSemantic.definitions).find((e) => e.kind === 'table')
    expect(def.content.tableDocument.rows[0].cells[0].textDocument.paragraphs[0].runs[0].text).toBe('Merged & ')

    const withEffects = frame().replace('<a:rPr sz="1200"/>', '<a:rPr sz="1200"><a:effectLst><a:glow/></a:effectLst></a:rPr>')
    await expect(imported({ graphic: withEffects })).rejects.toMatchObject({
      code: 'PPTX_SEMANTIC_ADMISSION_FAILED',
      sourceLocation: { localName: 'glow' },
    })

    const withAttrs = frame().replace('<a:rPr sz="1200"/>', '<a:rPr sz="1200"><a:effectLst type="none"/></a:rPr>')
    await expect(imported({ graphic: withAttrs })).rejects.toMatchObject({
      code: 'PPTX_SEMANTIC_ADMISSION_FAILED',
    })
  })

  it('audits complete table inventory, hashes and provenance without caller mutation', async () => {
    const zip = await tablePackage()
    const beforeZip = await snapshotZip(zip)
    const inventory = await buildSemanticInventory(zip)
    const caller = { title: 'Audit deck', slides: [{ id: 'slide7', elements: [] }] }
    const callerBefore = structuredClone(caller)
    const result = await projectSemanticImport({ zip, geometryInheritance: true, presentation: caller })
    expect(caller).toEqual(callerBefore)
    await assertZipUnchanged(zip, beforeZip)
    expect(result.admission.visualQualification).toBe('unqualified')
    const definition = Object.values(result.presentation.pptxSemantic.definitions).find(d => d.kind === 'table')
    expect(definition.source).toMatchObject({
      partUri: part,
      nativeId: '7',
      preconditionHash: digest(beforeZip.get(part)),
    })
    const cellComponents = definition.components.filter(c => c.kind === 'cell')
    expect(cellComponents).toHaveLength(4)
    for (const component of cellComponents) {
      expect(component.locator.preconditionHash).toBe(definition.source.preconditionHash)
      expect(component.locator.path).toBeInstanceOf(Array)
    }
    const graphicDef = inventory.definitions.find(d => d.kind === 'graphic-frame')
    expect(graphicDef).toMatchObject({ partUri: part, nativeId: '7' })
    const tableDef = inventory.definitions.find(d => d.kind === 'table')
    expect(tableDef).toMatchObject({ partUri: part, nativeId: null, parentDefinitionId: graphicDef.id })
    expect(result.admission.dispositions.some(d => d.definitionId === tableDef.id && d.disposition === 'semantically-mapped')).toBe(true)
  })

  it.each([
    ['missing slide part', async (zip) => { zip.remove(part) }, /Missing required semantic source part/],
    ['missing presentation part', async (zip) => { zip.remove('ppt/presentation.xml') }, /Missing required semantic source part/],
    ['missing content types', async (zip) => { zip.remove('[Content_Types].xml') }, /Missing required semantic source part/],
  ])('rejects %s atomically without screenshot substitution or presentation mutation', async (_label, mutate, expectedError) => {
    const zip = await tablePackage()
    await mutate(zip)
    const beforeZip = await snapshotZip(zip)
    const caller = { title: 'Error deck', slides: [{ id: 'slide7', elements: [] }] }
    const callerBefore = structuredClone(caller)
    await expect(projectSemanticImport({ zip, geometryInheritance: true, presentation: caller }))
      .rejects.toThrow(expectedError)
    expect(caller).toEqual(callerBefore)
    await assertZipUnchanged(zip, beforeZip)
  })
})
