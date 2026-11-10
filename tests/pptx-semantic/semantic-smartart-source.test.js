import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const JSZip = require('jszip')
const { buildSemanticInventory } = require('../../server/services/pptx-import/semantic-inventory')
const {
  readSemanticSmartArt,
} = require('../../server/services/pptx-import/ooxml-semantic-smartart')
const { normalizeSmartArtDocument } = require('../../shared/src/pptx-smartart-document')
const D = 'http://schemas.openxmlformats.org/drawingml/2006/diagram'
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
const P = 'http://schemas.openxmlformats.org/presentationml/2006/main'
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const REL = 'http://schemas.openxmlformats.org/package/2006/relationships'
const slide = 'ppt/slides/slide1.xml',
  data = 'ppt/diagrams/data.xml'
const rels = (items) =>
  `<Relationships xmlns="${REL}">${items.map(([Id, Type, Target]) => `<Relationship Id="${Id}" Type="${R}/${Type}" Target="${Target}"/>`).join('')}</Relationships>`

async function fixture(change = (x) => x, count = 3, strict = false) {
  const zip = new JSZip(),
    ns = (v) =>
      strict
        ? v.replace(
            'http://schemas.openxmlformats.org/drawingml/2006/',
            'http://purl.oclc.org/ooxml/drawingml/'
          )
        : v
  zip.file(
    '[Content_Types].xml',
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/></Types>'
  )
  zip.file(
    'ppt/presentation.xml',
    `<p:presentation xmlns:p="${P}" xmlns:r="${R}"><p:sldIdLst><p:sldId id="256" r:id="slide"/></p:sldIdLst></p:presentation>`
  )
  zip.file('ppt/_rels/presentation.xml.rels', rels([['slide', 'slide', 'slides/slide1.xml']]))
  zip.file(
    slide,
    `<p:sld xmlns:p="${P}" xmlns:a="${A}" xmlns:r="${R}" xmlns:q="${ns(D)}"><p:cSld><p:spTree><p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="7" name="SmartArt"/></p:nvGraphicFramePr><a:graphic><a:graphicData uri="${ns(D)}"><q:relIds r:dm="dm" r:lo="lo" r:qs="qs" r:cs="cs"/></a:graphicData></a:graphic></p:graphicFrame></p:spTree></p:cSld></p:sld>`
  )
  zip.file(
    'ppt/slides/_rels/slide1.xml.rels',
    rels([
      ['dm', 'diagramData', '../diagrams/data.xml'],
      ['lo', 'diagramLayout', '../diagrams/layout.xml'],
      ['qs', 'diagramQuickStyle', '../diagrams/style.xml'],
      ['cs', 'diagramColors', '../diagrams/colors.xml'],
    ])
  )
  for (const [name, root] of [
    ['layout', 'layoutDef'],
    ['style', 'styleDef'],
    ['colors', 'colorsDef'],
  ])
    zip.file(`ppt/diagrams/${name}.xml`, `<q:${root} xmlns:q="${ns(D)}"/>`)
  const points = Array.from(
    { length: count },
    (_, i) =>
      `<q:pt modelId="${i}" type="${i ? 'node' : 'doc'}"><q:prSet presName="Label ${i}" presStyleIdx="${i}"/><q:t><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr b="0" sz="1200"/><a:t xml:space="preserve"> Node ${i}&amp; </a:t></a:r><a:br/></a:p></q:t></q:pt>`
  ).join('')
  const connections = Array.from(
    { length: count - 1 },
    (_, i) =>
      `<q:cxn modelId="${count + i}" type="parOf" srcId="${i}" destId="${i + 1}" srcOrd="0" destOrd="${i}"/>`
  ).join('')
  zip.file(
    data,
    change(
      `<q:dataModel xmlns:q="${ns(D)}" xmlns:a="${ns(A)}"><q:ptLst>${points}</q:ptLst><q:cxnLst>${connections}</q:cxnLst></q:dataModel>`
    )
  )
  return {
    zip,
    async context() {
      const inventory = await buildSemanticInventory(zip)
      return {
        zip,
        inventory,
        source: inventory.definitions.find((d) => d.kind === 'graphic-frame'),
      }
    },
  }
}

describe('relationship-bound SmartArt source unit', () => {
  it('reads authored layout declarations without claiming they were evaluated', async () => {
    const f = await fixture()
    f.zip.file(
      'ppt/diagrams/layout.xml',
      `<q:layoutDef xmlns:q="${D}" uniqueId="comp">
      <q:layoutNode name="root"><q:alg type="comp"/></q:layoutNode>
    </q:layoutDef>`
    )
    const context = await f.context(),
      before = JSON.stringify(context.inventory)
    const result = await readSemanticSmartArt(context)
    expect(result.smartArtDocument.layout.declarations.map((d) => d.type)).toEqual([
      'layoutDef',
      'layoutNode',
      'alg',
    ])
    expect(result.smartArtDocument.layout.source.preconditionHash).toBe(
      context.inventory.parts.find((p) => p.partUri === 'ppt/diagrams/layout.xml').preconditionHash
    )
    const layoutDefinitions = context.inventory.definitions.filter(
      (d) => d.partUri === 'ppt/diagrams/layout.xml'
    )
    expect(layoutDefinitions.every((d) => result.mappedDefinitionIds.includes(d.id))).toBe(true)
    expect(result.layoutStatus).toBe('authored-layout-not-evaluated')
    expect(result).not.toHaveProperty('placements')
    expect(JSON.stringify(context.inventory)).toBe(before)
  })
  it.each([false, true])(
    'retains typed graph, rich ordered labels and authored identities (strict=%s)',
    async (strict) => {
      const f = await fixture(undefined, 52, strict),
        context = await f.context()
      const before = JSON.stringify(context.inventory),
        result = await readSemanticSmartArt(context)
      const d = result.smartArtDocument
      expect(d.points).toHaveLength(52)
      expect(d.points.filter((p) => p.type === 'node')).toHaveLength(51)
      expect(d.points[51].modelId).toBe('51')
      expect(d.points[1].properties).toEqual([
        { name: 'presName', value: 'Label 1' },
        { name: 'presStyleIdx', value: 1 },
      ])
      expect(d.points[1].textDocument.paragraphs[0].runs.map((r) => [r.kind, r.text])).toEqual([
        ['text', ' Node 1& '],
        ['break', undefined],
      ])
      expect(d.points[1].textDocument.paragraphs[0].runs[0].properties).toEqual({
        bold: false,
        fontSizePt: 12,
      })
      expect(d.connections[50].destinationId).toBe('51')
      expect(d.relationships.map((r) => r.relationshipId)).toEqual(['dm', 'lo', 'qs', 'cs'])
      const definitions = context.inventory.definitions.filter((d) => d.partUri === data)
      expect(new Set(result.mappedDefinitionIds)).toEqual(new Set(definitions.map((d) => d.id)))
      expect(result.components.find((c) => c.id === d.points[1].componentId).locator).toEqual(
        definitions.find((c) => c.id === d.points[1].componentId).componentLocators[0]
      )
      expect(result.layoutStatus).toBe('authored-layout-not-evaluated')
      expect(result).not.toHaveProperty('qualified')
      expect(JSON.stringify(context.inventory)).toBe(before)
      expect(await readSemanticSmartArt(context)).toEqual(result)
      expect(normalizeSmartArtDocument(JSON.parse(JSON.stringify(d)))).toEqual(d)
    }
  )
  it.each([
    ['modelId="1"', 'modelId="0"'],
    ['destId="1"', 'destId="999"'],
    ['srcId="0"', 'srcId="1"'],
    ['type="node"', 'type="unknown"'],
    ['presStyleIdx="1"', 'presStyleIdx="no"'],
    ['<q:prSet', '<q:prSet unknown="1"'],
    ['<q:ptLst>', '<q:ptLst xmlns:q="urn:wrong">'],
    ['modelId="1"', 'modelId="1" modelId="2"'],
    ['xmlns:q=', `xmlns:q="${D}" xmlns:q=`],
    ['<a:br/>', '<a:mystery/>'],
    ['</q:cxnLst>', '</q:cxnLst><q:unknown/>'],
  ])('rejects located malformed/unknown semantics: %s', async (from, to) => {
    const f = await fixture((xml) => xml.replace(from, to)),
      context = await f.context()
    await expect(readSemanticSmartArt(context)).rejects.toMatchObject({
      code: 'PPTX_SEMANTIC_ADMISSION_FAILED',
      sourceLocation: { partUri: data },
    })
  })
  it('rejects malformed XML at the inventory boundary before reader admission', async () => {
    const f = await fixture((xml) => xml.replace('</q:dataModel>', ''))
    await expect(f.context()).rejects.toThrow(`Invalid semantic source XML: ${data}`)
  })
  it('retains native transition points and connection identities rather than filtering them', async () => {
    const f = await fixture(
      (xml) =>
        xml
          .replace('modelId="3" type="node"', 'modelId="3" type="parTrans" cxnId="5"')
          .replace('modelId="4" type="node"', 'modelId="4" type="sibTrans" cxnId="5"')
          .replace(
            'modelId="5" type="parOf"',
            'modelId="5" type="parOf" parTransId="3" sibTransId="4"'
          ),
      5
    )
    const result = await readSemanticSmartArt(await f.context()),
      d = result.smartArtDocument
    expect(d.points.map((p) => p.type)).toEqual(['doc', 'node', 'node', 'parTrans', 'sibTrans'])
    expect(d.points[3].connectionId).toBe('5')
    expect(d.connections[0]).toMatchObject({
      modelId: '5',
      parentTransitionId: '3',
      siblingTransitionId: '4',
    })
  })
  it('reuses canonical cached-field source binding inside ordered node labels', async () => {
    const f = await fixture((xml) =>
      xml.replace(
        '<a:br/>',
        '<a:fld id="field-1" type="slidenum"><a:rPr b="0" smtClean="0"/><a:t>7</a:t></a:fld><a:br/>'
      )
    )
    const { smartArtDocument: d } = await readSemanticSmartArt(await f.context())
    expect(d.points[0].textDocument.paragraphs[0].runs[1]).toMatchObject({
      kind: 'field',
      text: '7',
      field: { id: 'field-1', type: 'slidenum' },
      properties: { bold: false },
      proofing: { smtClean: false },
    })
  })
  it.each(['wrong-type', 'duplicate', 'external', 'missing-target', 'stale'])(
    'rejects %s relationship/source ownership',
    async (mode) => {
      const f = await fixture()
      let context = await f.context()
      const path = 'ppt/slides/_rels/slide1.xml.rels'
      let xml = await f.zip.file(path).async('string')
      if (mode === 'wrong-type') xml = xml.replace('/diagramData', '/chart')
      if (mode === 'duplicate')
        xml = xml.replace(
          '</Relationships>',
          `<Relationship Id="dm" Type="${R}/diagramData" Target="../diagrams/data.xml"/></Relationships>`
        )
      if (mode === 'external') xml = xml.replace('Id="dm"', 'Id="dm" TargetMode="External"')
      if (mode === 'missing-target') f.zip.remove(data)
      if (mode === 'stale')
        f.zip.file(data, (await f.zip.file(data).async('string')).replace('Label 1', 'Changed'))
      f.zip.file(path, xml)
      if (['wrong-type', 'external'].includes(mode)) context = await f.context()
      await expect(readSemanticSmartArt(context)).rejects.toMatchObject({
        code: 'PPTX_SEMANTIC_ADMISSION_FAILED',
        sourceLocation: expect.objectContaining({ partUri: expect.any(String) }),
      })
    }
  )
})
