import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import JSZip from 'jszip'
import { expect, it } from 'vitest'
import { buildFeatureFixture } from './feature-fixtures.js'

const require = createRequire(import.meta.url)
const { projectSemanticImport } = require('../../server/services/pptx-import/semantic-projector.js')
const { normalizePptxSemanticDocument } = require('../../shared/src/pptx-semantic-document.js')
const { applyChartOperation } = require('../../shared/src/pptx-chart-operations.js')
const { projectChartRender } = require('../../shared/src/pptx-chart-render.js')
const { renderSemanticTable } = require('../../shared/src/pptx-table-renderer.js')
const { createSmartArtRenderModel } = require('../../shared/src/pptx-smartart-render.js')
const { buildSemanticInventory } = require('../../server/services/pptx-import/semantic-inventory.js')
const { readSemanticSmartArt } = require('../../server/services/pptx-import/ooxml-semantic-smartart.js')
const { parseXml } = require('../../server/services/pptx-import/ooxml-text-run-xml.js')
const digest = bytes => createHash('sha256').update(bytes).digest('hex')
async function packageBytes(zip) {
  return new Map(await Promise.all(Object.values(zip.files).filter(entry => !entry.dir)
    .map(async entry => [entry.name, await entry.async('nodebuffer')])))
}
async function expectPackageUnchanged(zip, before) {
  expect(Object.values(zip.files).filter(entry => !entry.dir).map(entry => entry.name).sort())
    .toEqual([...before.keys()].sort())
  for (const [part, bytes] of before) expect(await zip.file(part).async('nodebuffer'), part).toEqual(bytes)
}
const deck = () => ({ id: 'feature-deck', slides: [{ id: 'slide1', elements: [] }, { id: 'slide2', elements: [] }] })
const DSP = 'http://schemas.microsoft.com/office/drawing/2008/diagram'
const drawingPart = 'ppt/diagrams/drawing1.xml'

async function withDrawing() {
  const zip = await JSZip.loadAsync((await buildFeatureFixture()).buffer)
  const part = 'ppt/diagrams/data1.xml'
  zip.file(part, (await zip.file(part).async('string')).replace('</dgm:dataModel>',
    `<dgm:extLst><a:ext uri="{C9EACBC2-C29D-4C66-9B7D-6A1C79F987C3}"><dsp:dataModelExt xmlns:dsp="${DSP}" relId="drawing"/></a:ext></dgm:extLst></dgm:dataModel>`))
  zip.file('ppt/diagrams/_rels/data1.xml.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="drawing" Type="http://schemas.microsoft.com/office/2007/relationships/diagramDrawing" Target="drawing1.xml"/></Relationships>')
  const shapes = Array.from({ length: 51 }, (_, index) => `<dsp:sp modelId="node-${index + 1}"><dsp:nvSpPr><dsp:cNvPr id="${index + 1}" name="Node ${index + 1}"/><dsp:cNvSpPr/><dsp:nvPr/></dsp:nvSpPr><dsp:spPr><a:xfrm><a:off x="0" y="${index * 457200}"/><a:ext cx="914400" cy="457200"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></dsp:spPr><dsp:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>Node ${index + 1}</a:t></a:r></a:p></dsp:txBody></dsp:sp>`).join('')
  zip.file(drawingPart, `<dsp:drawing xmlns:dsp="${DSP}" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><dsp:spTree><dsp:nvGrpSpPr><dsp:cNvPr id="0" name="Cached drawing"/><dsp:cNvGrpSpPr/><dsp:nvPr/></dsp:nvGrpSpPr><dsp:grpSpPr/>${shapes}</dsp:spTree></dsp:drawing>`)
  return zip
}

it('imports each authored complex family as source-bound semantic data without mutating package XML', async () => {
  const { buffer } = await buildFeatureFixture()
  const zip = await JSZip.loadAsync(buffer)
  const slidePart = 'ppt/slides/slide1.xml'
  zip.file(slidePart, (await zip.file(slidePart).async('string'))
    .replace('<a:tcPr/>', '<a:tcPr marL="12345"><a:solidFill><a:srgbClr val="123456"/></a:solidFill><a:lnL w="12700"><a:solidFill><a:srgbClr val="654321"/></a:solidFill></a:lnL></a:tcPr>')
    .replace('r:embed="rIdMedia"/>', 'r:embed="rIdMedia"><p14:trim st="1000.5" end="2500.25"/></p14:media>'))
  const before = await packageBytes(zip)
  const caller = deck(), callerBefore = structuredClone(caller)
  const { presentation, inventory, admission } = await projectSemanticImport({
    zip,
    geometryInheritance: true,
    presentation: caller,
  })
  expect(caller).toEqual(callerBefore)
  const dispositions = new Map(admission.dispositions.map(entry => [entry.definitionId, entry]))
  expect(dispositions.size).toBe(admission.dispositions.length)
  expect([...dispositions.keys()].sort()).toEqual(inventory.definitions.map(entry => entry.id).sort())
  const sourceNodes = new Map()
  for (const part of inventory.parts) {
    const bytes = before.get(part.partUri)
    expect(bytes, part.partUri).toBeDefined()
    expect(part).toMatchObject({ preconditionHash: digest(bytes), byteLength: bytes.length })
    if (/\.(xml|rels|svg)$/i.test(part.partUri)) sourceNodes.set(part.partUri, { children: parseXml(bytes.toString('utf8')) })
  }
  expect(new Set(inventory.definitions.map(entry => entry.id)).size).toBe(inventory.definitions.length)
  for (const source of inventory.definitions) {
    expect(source.preconditionHash).toBe(digest(before.get(source.partUri)))
    expect(source.componentLocators).toHaveLength(1)
    const locator = source.componentLocators[0]
    let node = sourceNodes.get(source.partUri)
    for (const index of locator.path) node = node?.children[index]
    expect(node, source.id).toMatchObject({ local: source.localName, uri: source.namespaceUri })
    expect(locator.preconditionHash).toBe(source.preconditionHash)
    expect(dispositions.get(source.id)).toMatchObject({ partUri: source.partUri, locator })
  }
  expect(inventory.definitions.filter(source => source.kind === 'hyperlink')).toHaveLength(2)
  expect(inventory.definitions.filter(source => source.kind === 'timing')).toHaveLength(1)
  expect(admission.visualQualification).toBe('unqualified')
  const definitions = Object.values(presentation.pptxSemantic.definitions)
  const byKind = kind => definitions.filter(definition => definition.kind === kind)
  const table = byKind('table')[0]
  const chart = byKind('chart')[0]
  const diagram = byKind('diagram')[0]
  const equation = byKind('equation')[0]

  expect(table.content.tableDocument.rows).toHaveLength(2)
  expect(table.content.tableDocument.rows[0].cells[0].textDocument.paragraphs[0].runs.map(run => run.text))
    .toEqual(['Merged ', 'rich'])
  expect(chart.content.chartDocument.plots[0].series[0].data.val.cache.points.map(point => point.value))
    .toEqual([7, 11])
  expect(diagram.content.smartArtDocument.points.filter(point => point.type === 'node')).toHaveLength(51)
  expect(diagram.content.smartArtDocument.connections).toHaveLength(51)
  expect(equation.content.ommlDocument.root.type).toBe('oMathPara')
  expect(table.content.tableDocument.columns.map(column => column.widthEmu)).toEqual([1371600, 1371600])
  expect(table.content.tableDocument.rows.map(row => row.heightEmu)).toEqual([457200, 457200])
  const [anchor, continuation] = table.content.tableDocument.rows[0].cells
  expect(anchor.merge).toEqual({ gridSpan: 2 })
  expect(continuation.merge).toEqual({ hMerge: true })
  expect(continuation.anchorCellId).toBe(anchor.componentId)
  expect(anchor.properties).toMatchObject({ marginLeftEmu: 12345, fill: { color: { kind: 'srgb', value: '123456' } }, borders: { left: { width: 12700 } } })
  expect(chart.content.chartDocument.axes.map(axis => axis.id)).toEqual([100, 200])
  const workbook = chart.content.chartDocument.workbook
  expect(workbook).toMatchObject({ external: false, fetchPolicy: 'deny', target: 'ppt/embeddings/feature-data.xlsx' })
  expect(workbook.literalData.sheets[0].cells.map(cell => cell.reference)).toEqual(['A1', 'B1', 'A2', 'B2', 'A3', 'B3'])
  expect(workbook.literalData.sheets[0].cells.every(cell => cell.source.preconditionHash.match(/^[a-f0-9]{64}$/))).toBe(true)
  expect(diagram.content.smartArtDocument.relationships.map(relation => relation.role)).toEqual(['data', 'layout', 'style', 'colors'])
  expect(diagram.content.smartArtDocument.layout.declarations.length).toBeGreaterThan(0)
  expect(diagram.content.smartArtDocument.sourceStyles).toBeTruthy()
  const mathNodes = []
  const collect = node => { mathNodes.push(node); node.children.forEach(collect) }
  collect(equation.content.ommlDocument.root)
  expect(mathNodes.filter(node => node.type === 't').map(node => node.text)).toEqual(['1', '2', 'a', 'b', 'c', 'd'])
  expect(mathNodes.some(node => node.type === 'f')).toBe(true)
  expect(mathNodes.filter(node => node.type === 'mr')).toHaveLength(2)
  const media = byKind('audio')[0].content.mediaDocument
  expect(media.asset.partUri).toBe('ppt/media/feature.wav')
  expect(media.poster.partUri).toBe('ppt/media/poster.png')
  expect(media.trim).toEqual({ startMs: 1000.5, endMs: 2500.25 })
  expect(media.asset.sha256).toMatch(/^[a-f0-9]{64}$/)
  expect(definitions.flatMap(definition => definition.components)
    .filter(component => component.kind === 'media-segment').length).toBeGreaterThan(0)
  const timing = definitions.find(definition => definition.kind === 'opaque' &&
    definition.content.targetReferences?.some(target => target.spid === '2'))
  expect(timing).toBeTruthy()
  for (const definition of [table, chart, diagram, equation]) {
    expect(definition.source.partUri).toBeTruthy()
    expect(definition.source.preconditionHash).toMatch(/^[a-f0-9]{64}$/)
    expect(definition.components.length).toBeGreaterThan(0)
    for (const component of definition.components) {
      expect(component.locator.preconditionHash).toMatch(/^[a-f0-9]{64}$/)
      const partUri = component.partUri ?? definition.source.partUri
      const part = await zip.file(partUri)?.async('nodebuffer')
      expect(part, partUri).toBeTruthy()
      expect(component.locator.preconditionHash).toBe(createHash('sha256').update(part).digest('hex'))
    }
  }
  expect(await buildSemanticInventory(zip)).toEqual(inventory)
  await expectPackageUnchanged(zip, before)
})
it.each(['ppt/charts/chart1.xml', 'ppt/diagrams/data1.xml', 'ppt/diagrams/layout1.xml', 'ppt/diagrams/quickStyle1.xml', 'ppt/diagrams/colors1.xml', 'ppt/embeddings/feature-data.xlsx', 'ppt/media/feature.wav', 'ppt/media/poster.png'])(
  'rejects a missing typed source part %s without mutating the presentation', async missingPart => {
    const zip = await JSZip.loadAsync((await buildFeatureFixture()).buffer)
    zip.remove(missingPart)
    const packageBefore = await packageBytes(zip)
    const presentation = { id: 'feature-deck', slides: [{ id: 'slide1', elements: [] }, { id: 'slide2', elements: [] }] }
    const before = structuredClone(presentation)
    await expect(projectSemanticImport({ zip, geometryInheritance: true, presentation }))
      .rejects.toMatchObject({
        message: `Missing required semantic source part: ${missingPart}`,
        status: 400,
        type: 'parse-failed',
        sourceLocation: { partUri: missingPart },
      })
    expect(presentation).toEqual(before)
    await expectPackageUnchanged(zip, packageBefore)
  }
)

it('retains an authenticated native drawing reference without replacing the logical diagram', async () => {
  const zip = await withDrawing()
  const originalDrawing = await zip.file(drawingPart).async('nodebuffer')
  const result = await projectSemanticImport({ zip, geometryInheritance: true, presentation: deck() })
  const semantic = result.presentation.pptxSemantic
  const diagram = Object.values(semantic.definitions).find(definition => definition.kind === 'diagram')
  const fallback = diagram.content.drawingFallback
  expect(fallback).toMatchObject({ ownerDefinitionId: diagram.id, role: 'native-visual-cache', drawing: { partUri: drawingPart } })
  expect(fallback.drawing.preconditionHash).toBe(createHash('sha256').update(originalDrawing).digest('hex'))
  expect(await zip.file(drawingPart).async('nodebuffer')).toEqual(originalDrawing)
  expect(fallback.relationship.relationshipId).toBe('drawing')
  expect(fallback.constituents.filter(constituent => constituent.source.partUri === drawingPart).length).toBeGreaterThan(51)
  expect(diagram.content.smartArtDocument.points.filter(point => point.type === 'node')).toHaveLength(51)
  expect(diagram.components.some(component => component.partUri === drawingPart)).toBe(false)
  expect(result.admission.visualQualification).toBe('unqualified')
  const foreign = structuredClone(semantic)
  foreign.definitions[diagram.id].content.drawingFallback.ownerDefinitionId = 'foreign-diagram'
  expect(() => normalizePptxSemanticDocument(foreign)).toThrow(/drawing|diagram/i)
  const stale = structuredClone(semantic)
  stale.definitions[diagram.id].content.drawingFallback.drawing.preconditionHash = '0'.repeat(64)
  expect(() => normalizePptxSemanticDocument(stale)).toThrow(/drawing|diagram/i)
})

it.each(['missing', 'foreign'])('rejects a %s drawing fallback without caller mutation', async mode => {
  const zip = await withDrawing()
  if (mode === 'missing') zip.remove(drawingPart)
  else zip.file(drawingPart, '<foreign xmlns="urn:foreign"/>')
  const presentation = deck(), before = structuredClone(presentation)
  await expect(projectSemanticImport({ zip, geometryInheritance: true, presentation })).rejects.toThrow(/drawing|source part/i)
  expect(presentation).toEqual(before)
})

it('locates unsupported OMML instead of substituting a screenshot or partial math tree', async () => {
  const zip = await JSZip.loadAsync((await buildFeatureFixture()).buffer)
  const part = 'ppt/slides/slide1.xml'
  zip.file(part, (await zip.file(part).async('string')).replace('<m:f>', '<m:unsupported/><m:f>'))
  const packageBefore = await packageBytes(zip)
  const presentation = deck(), before = structuredClone(presentation)
  await expect(projectSemanticImport({ zip, geometryInheritance: true, presentation })).rejects.toMatchObject({
    code: 'PPTX_SEMANTIC_ADMISSION_FAILED', sourceLocation: { partUri: part },
  })
  expect(presentation).toEqual(before)
  await expectPackageUnchanged(zip, packageBefore)
})

it('keeps denied external workbook caches source-bound until an explicit local conversion', async () => {
  const zip = await JSZip.loadAsync((await buildFeatureFixture()).buffer)
  const relPart = 'ppt/charts/_rels/chart1.xml.rels'
  zip.file(relPart, (await zip.file(relPart).async('string')).replace(
    'Target="../embeddings/feature-data.xlsx"', 'Target="https://blocked.invalid/data.xlsx" TargetMode="External"'))
  const result = await projectSemanticImport({ zip, geometryInheritance: true, presentation: deck() })
  const chart = Object.values(result.presentation.pptxSemantic.definitions).find(definition => definition.kind === 'chart')
  const document = chart.content.chartDocument, seriesId = document.plots[0].series[0].id
  expect(document.workbook).toMatchObject({ external: true, fetchPolicy: 'deny' })
  expect(document.workbook.literalData).toBeUndefined()
  expect(() => applyChartOperation(document, { type: 'chart.data.set-point', seriesId, channel: 'val', index: 0, value: 99 })).toThrow(/conversion/i)
  const converted = applyChartOperation(document, { type: 'chart.data.convert-local', seriesId, channel: 'val', basis: 'cache-snapshot' })
  expect(converted.plots[0].series[0].data.val.kind).toBe('numLit')
  expect(document.plots[0].series[0].data.val.kind).toBe('numRef')
  expect(converted.workbook).toEqual(document.workbook)
  expect(result.admission.visualQualification).toBe('unqualified')
})

it.each(['table-style', 'category-levels', 'diagram-style'])('preserves complete %s source data with located provenance', async family => {
  const zip = await JSZip.loadAsync((await buildFeatureFixture()).buffer)
  const tableStyleId = '{11111111-1111-1111-1111-111111111111}'
  const dataPart = family === 'category-levels' ? 'ppt/charts/chart1.xml' : family === 'diagram-style' ? 'ppt/diagrams/data1.xml' : 'ppt/slides/slide1.xml'
  const original = await zip.file(dataPart).async('string')
  if (family === 'category-levels') zip.file(dataPart, original.replace(/<c:strRef>.*?<\/c:strRef>/s, '<c:multiLvlStrRef><c:f>Data!$A$2:$A$3</c:f><c:multiLvlStrCache><c:ptCount val="2"/><c:lvl><c:pt idx="0"><c:v>Alpha</c:v></c:pt><c:pt idx="1"><c:v>Beta</c:v></c:pt></c:lvl><c:lvl><c:pt idx="0"><c:v>Group</c:v></c:pt></c:lvl></c:multiLvlStrCache></c:multiLvlStrRef>'))
  if (family === 'diagram-style') zip.file(dataPart, original.replace('<dgm:spPr/>', '<dgm:spPr><a:solidFill><a:srgbClr val="123456"/></a:solidFill></dgm:spPr>').replace('<dgm:bg/>', '<dgm:bg><a:solidFill><a:srgbClr val="ABCDEF"/></a:solidFill></dgm:bg>').replace('<dgm:whole/>', '<dgm:whole><a:ln w="12700"/></dgm:whole>'))
  if (family === 'table-style') {
    zip.file(dataPart, original.replace('<a:tblPr firstRow="1" bandRow="1"/>', `<a:tblPr firstRow="1" bandRow="1"><a:tableStyleId>${tableStyleId}</a:tableStyleId></a:tblPr>`))
    zip.file('ppt/semantic-table-styles.xml', `<a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" def="${tableStyleId}"><a:tblStyle styleId="${tableStyleId}" styleName="Authored"><a:wholeTbl><a:tcStyle><a:fill><a:solidFill><a:srgbClr val="123456"/></a:solidFill></a:fill></a:tcStyle></a:wholeTbl></a:tblStyle></a:tblStyleLst>`)
    const rels = 'ppt/_rels/presentation.xml.rels'
    zip.file(rels, (await zip.file(rels).async('string')).replace(/<Relationship\b[^>]*Type="[^"]*\/tableStyles"[^>]*\/>/g, '').replace('</Relationships>', '<Relationship Id="typedStyle" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/tableStyles" Target="semantic-table-styles.xml"/></Relationships>'))
  }
  const result = await projectSemanticImport({ zip, geometryInheritance: true, presentation: deck() })
  const definitions = Object.values(result.presentation.pptxSemantic.definitions)
  const beforeConsumer = structuredClone(result.presentation.pptxSemantic)
  if (family === 'category-levels') expect(definitions.find(d => d.kind === 'chart').content.chartDocument.plots[0].series[0].data.cat.cache.levels.map(level => level.points.map(point => point.value))).toEqual([['Alpha', 'Beta'], ['Group']])
  if (family === 'diagram-style') expect(definitions.find(d => d.kind === 'diagram').content.smartArtDocument.sourceProperties.map(property => property.tree.type)).toEqual(['bg', 'whole', 'spPr'])
  if (family === 'table-style') expect(definitions.find(d => d.kind === 'table').content.tableStyleReference).toMatchObject({ styleId: tableStyleId, style: { source: { partUri: 'ppt/semantic-table-styles.xml' } } })
  if (family === 'category-levels') expect(projectChartRender(definitions.find(d => d.kind === 'chart').content.chartDocument)).toMatchObject({ supported: false, diagnostics: [expect.objectContaining({ code: 'chart-hierarchical-category-layout-unimplemented' }), expect.any(Object)] })
  if (family !== 'category-levels') {
    let diagnostic
    try {
      if (family === 'table-style') renderSemanticTable(definitions.find(d => d.kind === 'table').content.tableDocument)
      else createSmartArtRenderModel(definitions.find(d => d.kind === 'diagram').content.smartArtDocument, { x: 0, y: 0, width: 1, height: 1 })
    } catch (error) { diagnostic = error }
    expect(diagnostic?.code).toBe(family === 'table-style' ? 'PPTX_TABLE_RENDER_UNSUPPORTED' : 'PPTX_SMARTART_PAINT_UNSUPPORTED')
    if (family === 'table-style') expect(diagnostic.path).toBe('properties.tableStyleId')
    else expect(diagnostic.sourceLocation.partUri).toBe(dataPart)
  }
  expect(result.presentation.pptxSemantic).toEqual(beforeConsumer)
  expect(result.admission.visualQualification).toBe('unqualified')
  if (family === 'table-style') zip.remove('ppt/semantic-table-styles.xml')
  else zip.file(dataPart, (await zip.file(dataPart).async('string')).replace(family === 'category-levels' ? /<c:lvl>.*?<\/c:lvl>/s : /<a:solidFill>.*?<\/a:solidFill>/s, '<foreign xmlns="urn:foreign"/>'))
  const presentation = deck(), before = structuredClone(presentation)
  await expect(projectSemanticImport({ zip, geometryInheritance: true, presentation })).rejects.toThrow()
  expect(presentation).toEqual(before)
})

it('rejects changed drawing bytes against the admitted source digest', async () => {
  const zip = await withDrawing(), inventory = await buildSemanticInventory(zip)
  const source = inventory.definitions.find(d => d.kind === 'graphic-frame' && d.nativeId === '9')
  zip.file(drawingPart, (await zip.file(drawingPart).async('string')).replace('</dsp:drawing>', '<!--changed--></dsp:drawing>'))
  await expect(readSemanticSmartArt({ zip, inventory, source })).rejects.toMatchObject({
    code: 'PPTX_SEMANTIC_ADMISSION_FAILED', sourceLocation: { partUri: drawingPart },
  })
})

it.each([
  ['unknown target mode', xml => xml.replace('Id="rIdChart"', 'Id="rIdChart" TargetMode="Unknown"')],
  ['empty target mode', xml => xml.replace('Id="rIdChart"', 'Id="rIdChart" TargetMode=""')],
  ['case-mismatched target mode', xml => xml.replace('Id="rIdChart"', 'Id="rIdChart" TargetMode="external"')],
  ['duplicate target mode', xml => xml.replace('Id="rIdChart"', 'Id="rIdChart" TargetMode="Internal" TargetMode="External"')],
  ['unreferenced foreign relationship', xml => xml.replace('</Relationships>', '<foreign:Relationship xmlns:foreign="urn:foreign" Id="unused" Type="urn:foreign" Target="https://blocked.invalid/unused" TargetMode="External"/></Relationships>')],
  ['unknown relationship attribute', xml => xml.replace('Id="rIdChart"', 'Id="rIdChart" unexpected="1"')],
  ['nested relationship payload', xml => xml.replace('<Relationship Id="rIdChart" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart1.xml"/>', '<Relationship Id="rIdChart" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart1.xml"><foreign xmlns="urn:foreign"/></Relationship>')],
])('rejects %s at the relationship part without package or caller mutation', async (_label, change) => {
  const zip = await JSZip.loadAsync((await buildFeatureFixture()).buffer)
  const relPart = 'ppt/slides/_rels/slide1.xml.rels'
  const original = await zip.file(relPart).async('string')
  const changed = change(original)
  expect(changed).not.toBe(original)
  zip.file(relPart, changed)
  const before = await packageBytes(zip)
  const caller = deck(), callerBefore = structuredClone(caller)
  const expected = { status: 400, type: 'parse-failed', sourceLocation: { partUri: relPart } }
  await expect(buildSemanticInventory(zip)).rejects.toMatchObject(expected)
  await expect(projectSemanticImport({ zip, geometryInheritance: true, presentation: caller })).rejects.toMatchObject(expected)
  expect(caller).toEqual(callerBefore)
  await expectPackageUnchanged(zip, before)
})

it('preserves source IDs for explicit internal relationships without admitting denied external targets', async () => {
  const zip = await JSZip.loadAsync((await buildFeatureFixture()).buffer)
  const before = await buildSemanticInventory(zip)
  const relPart = 'ppt/slides/_rels/slide1.xml.rels'
  zip.file(relPart, (await zip.file(relPart).async('string')).replace('Id="rIdChart"', 'Id="rIdChart" TargetMode="Internal"'))
  const bytes = await packageBytes(zip)
  const after = await buildSemanticInventory(zip)
  expect(after.definitions).toEqual(before.definitions)
  expect(after.occurrences).toEqual(before.occurrences)
  expect(after.issues).toEqual(before.issues)
  expect(after.issues).toContainEqual(expect.objectContaining({ code: 'external-relationship-denied', relationshipId: 'rIdBlocked' }))
  const imported = await projectSemanticImport({ zip, geometryInheritance: true, presentation: deck() })
  expect(imported.admission.visualQualification).toBe('unqualified')
  expect(Object.values(imported.presentation.pptxSemantic.definitions).filter(definition => definition.kind === 'chart')).toHaveLength(1)
  expect(Object.values(imported.presentation.pptxSemantic.definitions).some(definition => definition.kind === 'video')).toBe(false)
  await expectPackageUnchanged(zip, bytes)
})
