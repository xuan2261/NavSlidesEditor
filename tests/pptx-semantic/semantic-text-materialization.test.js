import { beforeAll, describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { fixture, slide, layout, master } from './semantic-text-style-context-fixture'

const require = createRequire(import.meta.url)
const { projectSemanticImport } = require('../../server/services/pptx-import/semantic-projector')
const { materializeTextDocument, materializeTextTheme } = require('../../shared/src/pptx-text-materialization')
const { compactSemanticGraph } = require('../../shared/src/pptx-semantic-source-graph')
const { semanticStyle } = require('../../shared/src/pptx-semantic-records')
const { normalizePptxSemanticDocument } = require('../../shared/src/pptx-semantic-document')
const { semanticRenderTree } = require('../../shared/src/pptx-semantic-render-tree')
let presentation, instanceId

beforeAll(async () => {
  const zip = await fixture()
  for (const part of [slide, layout, master])
    zip.file(
      part,
      (await zip.file(part).async('string')).replaceAll(
        '<p:spPr/>',
        '<p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="914400" cy="457200"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>'
      )
    )
  zip.file(
    'ppt/presentation.xml',
    (await zip.file('ppt/presentation.xml').async('string')).replace(
      '</p:presentation>',
      '<p:sldSz cx="9144000" cy="5143500"/></p:presentation>'
    )
  )
  presentation = (
    await projectSemanticImport({
      zip,
      geometryInheritance: true,
      presentation: { id: 'deck', slides: [{ id: 'slide', elements: [] }] },
    })
  ).presentation
  instanceId = Object.values(presentation.pptxSemantic.instances).find(
    (instance) => instance.textSourceBinding && instance.slideId === presentation.slides[0].id
  ).id
})

describe('occurrence text materialization', () => {
  it('resolves inherited body, paragraph and run declarations without mutating source records', () => {
    const semantic = presentation.pptxSemantic
    const before = structuredClone(semantic)
    const materialized = materializeTextDocument(semantic, instanceId)

    expect(materialized.body).toMatchObject({ insetLeftEmu: 0, anchorCenter: false })
    expect(materialized.paragraphs[0].properties).toMatchObject({ marginLeftEmu: 0, direction: 'ltr' })
    expect(materialized.paragraphs[0].runs[0].properties).toMatchObject({
      fontSizePt: 18,
      fontLatin: { typeface: 'Minor' },
      bold: false,
      italic: false,
    })
    expect(semantic).toEqual(before)
    expect(materializeTextDocument(semantic, instanceId)).toBe(materialized)
  })

  it('uses the materialized document on the semantic render surface', () => {
    const slide = presentation.slides.find((entry) =>
      entry.elements.some((element) => element.pptxInstanceId === instanceId)
    )
    const node = semanticRenderTree(presentation.pptxSemantic, slide).find(
      (entry) => entry.instanceId === instanceId
    )
    expect(node.element.pptxTextDocument.paragraphs[0].runs[0].properties).toMatchObject({
      fontSizePt: 18,
      fontLatin: { typeface: 'Minor' },
    })
  })

  it('keeps an occurrence override isolated from the source and a sibling occurrence', () => {
    const semantic = structuredClone(presentation.pptxSemantic)
    const sourceInstance = semantic.instances[instanceId]
    const definition = semantic.definitions[sourceInstance.definitionId]
    const componentId = definition.content.textDocument.componentId
    const edited = structuredClone(definition.content.textDocument)
    edited.paragraphs[0].runs[0].properties.bold = true
    sourceInstance.overrides.components = { [componentId]: { textDocument: edited } }
    semantic.instances.sibling = { ...structuredClone(sourceInstance), id: 'sibling', overrides: {} }

    expect(materializeTextDocument(semantic, instanceId).paragraphs[0].runs[0].properties.bold).toBe(true)
    expect(materializeTextDocument(semantic, 'sibling').paragraphs[0].runs[0].properties.bold).toBe(false)
    expect(definition.content.textDocument).toEqual(presentation.pptxSemantic.definitions[definition.id].content.textDocument)
  })

  it('resolves inherited text and theme after graph compaction and JSON reopen', () => {
    const semantic = normalizePptxSemanticDocument(JSON.parse(JSON.stringify(compactSemanticGraph(presentation.pptxSemantic))))
    const before = structuredClone(semantic)
    const materialized = materializeTextDocument(semantic, instanceId)

    expect(materialized?.paragraphs[0].runs[0]).toMatchObject({
      text: 'Text',
      properties: { fontSizePt: 18, fontLatin: { typeface: 'Minor' }, bold: false, italic: false },
    })
    expect(materialized.body).toMatchObject({ insetLeftEmu: 0, anchorCenter: false })
    expect(materialized.paragraphs[0].properties).toMatchObject({ marginLeftEmu: 0, direction: 'ltr' })
    expect(materializeTextTheme(semantic, instanceId)).toMatchObject({
      colors: { dk1: '102030' }, fonts: { minor: { latin: 'Minor' } },
    })
    expect(materializeTextTheme(semantic, instanceId).source)
      .toEqual(materializeTextTheme(presentation.pptxSemantic, instanceId).source)
    expect(semantic).toEqual(before)
  })

  it('keeps compact-graph text overrides separate from shared source and sibling paint', () => {
    const source = structuredClone(presentation.pptxSemantic)
    const instance = source.instances[instanceId]
    const text = source.definitions[instance.definitionId].content.textDocument
    const edited = structuredClone(text)
    edited.paragraphs[0].runs[0].properties.bold = true
    source.instances.sibling = { ...structuredClone(instance), id: 'sibling', overrides: {} }
    instance.overrides.components = { [text.componentId]: { textDocument: edited } }
    const semantic = compactSemanticGraph(source)
    const before = structuredClone(semantic)

    expect(materializeTextDocument(semantic, instanceId)?.paragraphs[0].runs[0].properties.bold).toBe(true)
    expect(materializeTextDocument(semantic, 'sibling')?.paragraphs[0].runs[0].properties.bold).toBe(false)
    expect(semantic).toEqual(before)
  })

  it('reads persisted string resource references without changing inherited typography', () => {
    const semantic = compactSemanticGraph(presentation.pptxSemantic)
    for (const scope of semantic.declarationScopes) scope.declaration = `record-${scope.declaration}`
    for (const inventory of semantic.textInventories)
      inventory.records = inventory.records.map(index => `record-${index}`)
    for (const shape of semantic.textShapes) shape.theme = `record-${shape.theme}`
    const before = structuredClone(semantic)

    expect(materializeTextDocument(semantic, instanceId).paragraphs[0].runs[0].properties)
      .toMatchObject({ fontSizePt: 18, fontLatin: { typeface: 'Minor' }, bold: false })
    expect(materializeTextTheme(semantic, instanceId).colors.dk1).toBe('102030')
    expect(semantic).toEqual(before)
  })

  describe.each(['theme', 'declaration', 'font'])('%s resource references', site => {
    function graphWithReference(reference) {
      const semantic = compactSemanticGraph(presentation.pptxSemantic)
      const [contextId, context] = Object.entries(semantic.styles).find(([, style]) => style.kind === 'text-context')
      const shape = semantic.textShapes[context.payload.shape]
      if (site === 'theme') shape.theme = reference
      else if (site === 'declaration') semantic.declarationScopes[shape.body.scope].declaration = reference
      else semantic.textInventories[shape.fontRequests[0]].records[0] = reference
      return { semantic, contextId }
    }

    it.each([-1, 0.25, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1, '0', 'record-01', null, {}])(
      'rejects malformed or dangling reference %j without changing the graph', reference => {
        const { semantic, contextId } = graphWithReference(reference)
        const before = structuredClone(semantic)
        expect(() => semanticStyle(semantic, Number(contextId))).toThrow(/resource identity|resource kind\/reference/)
        expect(semantic).toEqual(before)
      }
    )

    it('rejects a numeric reference to a different resource kind', () => {
      const graph = compactSemanticGraph(presentation.pptxSemantic)
      const pool = Object.values(graph.styles).find(style => style.kind === 'text-context-resources')
      const [id] = Object.entries(pool.payload.records).find(([, record]) => record.kind === 'provenance')
      const { semantic, contextId } = graphWithReference(Number(id.slice(7)))
      expect(() => semanticStyle(semantic, Number(contextId))).toThrow(/resource kind\/reference/)
    })
  })

  it('does not admit dotted text paths in structural source locations', () => {
    const semantic = compactSemanticGraph(presentation.pptxSemantic)
    semantic.sourceLocations[0].path = '0'
    const before = structuredClone(semantic)
    expect(() => normalizePptxSemanticDocument(semantic)).toThrow(/sourceLocations path/)
    expect(semantic).toEqual(before)
  })
})
