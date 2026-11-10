import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { familyDocumentsFixture } from './family-documents-fixture'

const require = createRequire(import.meta.url)
const { collectSemanticFontRequests } = require('../../shared/src/pptx-source-font-request')
const { materializeFamilyDocument } = require('../../shared/src/pptx-family-operations')
const { createSmartArtRenderModel, createSmartArtPhysicalModel, renderSmartArtSvg } =
  require('../../shared/src/pptx-smartart-render')
const { smartArtNodeStyle } = require('../../shared/src/pptx-smartart-style')
const bounds = { x: 0, y: 0, width: 9144000, height: 4572000 }
const D = 'http://schemas.openxmlformats.org/drawingml/2006/diagram'
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main'

async function fixture({ missingLabel = false, ambiguous = false, conflict = false } = {}) {
  const { diagram } = await familyDocumentsFixture(async (zip) => {
    const text = `<d:t><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr><a:latin typeface="Direct"/></a:rPr><a:t>Direct</a:t></a:r><a:r><a:t>Latin</a:t></a:r><a:r><a:t>&#x0645;&#x0631;&#x062D;&#x0628;&#x0627;</a:t></a:r></a:p></d:t>`
    zip.file('ppt/diagrams/data1.xml',
      `<d:dataModel xmlns:d="${D}" xmlns:a="${A}"><d:ptLst><d:pt modelId="0" type="doc"/><d:pt modelId="1">${text}</d:pt><d:pt modelId="2"><d:prSet presStyleLbl="node1"/>${text}</d:pt></d:ptLst><d:cxnLst><d:cxn modelId="3" srcId="0" destId="1" srcOrd="0" destOrd="0"/><d:cxn modelId="4" srcId="0" destId="2" srcOrd="1" destOrd="0"/></d:cxnLst></d:dataModel>`)
    zip.file('ppt/diagrams/layout1.xml',
      `<d:layoutDef xmlns:d="${D}"><d:layoutNode name="root"><d:alg type="lin"><d:param type="linDir" val="fromL"/><d:param type="vertAlign" val="t"/></d:alg><d:constrLst><d:constr type="w" for="ch" val="100"/><d:constr type="h" for="ch" val="50"/><d:constr type="sp" val="10"/>${conflict ? '<d:constr type="w" for="ch" val="101"/>' : ''}</d:constrLst>${ambiguous ? '<d:presOf axis="ch"/>' : ''}<d:forEach axis="ch" ptType="node"><d:layoutNode name="item" styleLbl="${missingLabel ? 'absent' : 'node0'}"><d:presOf axis="self"/><d:alg type="comp"/><d:shape type="rect"/></d:layoutNode></d:forEach></d:layoutNode></d:layoutDef>`)
    const stylePart = 'ppt/diagrams/quickStyle1.xml'
    const style = await zip.file(stylePart).async('string')
    const label = style.match(/<dgm:styleLbl[\s\S]*?<\/dgm:styleLbl>/)[0]
    const styled = (name, font) => label.replace('name="node0"', `name="${name}"`)
      .replace('</dgm:styleLbl>',
        `<dgm:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:buChar char="&#x2022;"/><a:defRPr b="1" i="0"><a:latin typeface="${font}"/><a:cs typeface="Arabic"/></a:defRPr></a:pPr></a:p></dgm:txPr></dgm:styleLbl>`)
    zip.file(stylePart, style.replace(label, styled('node0', 'First') + styled('node1', 'Second')))
    const colorsPart = 'ppt/diagrams/colors1.xml'
    const colors = await zip.file(colorsPart).async('string')
    const palette = colors.match(/<dgm:styleLbl[\s\S]*?<\/dgm:styleLbl>/)[0]
    zip.file(colorsPart, colors.replace(palette, palette + palette.replace('name="node0"', 'name="node1"')))
  })
  Object.values(diagram.definitions)[0].content.extent = { cx: bounds.width, cy: bounds.height }
  // The source reader admits buChar but not buFont. Exercise the represented
  // bullet-font contract through a real label edit, not an unsupported XML node.
  return edited(diagram, owner(diagram).content.smartArtDocument.points.slice(1).map((point) => {
    const textDocument = structuredClone(point.textDocument)
    textDocument.paragraphs[0].properties = { bulletFont: { typeface: 'Bullet' } }
    return { type: 'label', pointId: point.componentId, textDocument }
  }))
}

function owner(semantic) {
  return Object.values(semantic.definitions)[0]
}
function edited(semantic, commands) {
  const next = structuredClone(semantic)
  next.instances.occurrence.overrides.components = {
    [owner(next).content.smartArtDocument.componentId]: {
      familyOperations: { family: 'smartart', commands: [
        ...(next.instances.occurrence.overrides.components?.[
          owner(next).content.smartArtDocument.componentId]?.familyOperations.commands ?? []),
        ...commands,
      ] },
    },
  }
  return next
}
function byFace(result) {
  return Object.fromEntries(result.faces.map((face) => [face.typeface, result.locations[face.faceId]]))
}

describe('SmartArt source font selection without native literal calibration', () => {
  it('collects exact direct, style, script and bullet fonts while physical rendering stays rejected', async () => {
    const semantic = await fixture(), before = JSON.stringify(semantic)
    const source = owner(semantic).content.smartArtDocument
    const logical = createSmartArtRenderModel(source, bounds)
    expect(logical.nodes.map((n) => smartArtNodeStyle(source, n).textDefaults.run.fontLatin.typeface))
      .toEqual(['First', 'Second'])
    for (const render of [createSmartArtPhysicalModel, renderSmartArtSvg])
      expect(() => render(source, bounds)).toThrow(expect.objectContaining({
        code: 'PPTX_SMARTART_PAINT_UNSUPPORTED',
        componentId: source.layout.declarations.find((d) => d.type === 'constr').componentId,
      }))
    const result = collectSemanticFontRequests(semantic)
    expect(result.issues).toEqual([])
    expect(result.faces.map(({ typeface, bold, italic }) => [typeface, bold, italic])).toEqual([
      ['Arabic', true, false], ['Bullet', true, false], ['Direct', true, false],
      ['First', true, false], ['Second', true, false],
    ])
    const requests = byFace(result), first = source.points[1].textDocument.paragraphs[0]
    expect(requests.First).toEqual([{
      instanceId: 'occurrence', componentId: first.runs[1].componentId,
      part: owner(semantic).source.partUri, path: 'paragraphs[0].runs[1]',
    }])
    expect(requests.Bullet.map((l) => l.path)).toEqual([
      'paragraphs[0].properties.bulletFont', 'paragraphs[0].properties.bulletFont',
    ])
    const identity = JSON.parse(result.identity)
    expect(identity.provenance[0]).toMatchObject({
      definitionId: owner(semantic).id, source: owner(semantic).source,
      familySource: { style: source.sourceStyles.styleSource, colors: source.sourceStyles.colorSource,
        theme: source.sourceStyles.themeSource },
    })
    expect(collectSemanticFontRequests(JSON.parse(before))).toEqual(result)
    expect(JSON.stringify(semantic)).toBe(before)
  })

  it('replays sibling reorder and exact point style overrides before selecting fonts', async () => {
    const semantic = await fixture(), before = JSON.stringify(semantic)
    const source = owner(semantic).content.smartArtDocument
    const changed = edited(semantic, [
      { type: 'reorder', parentId: source.points[0].componentId,
        pointIds: [source.points[2].componentId, source.points[1].componentId] },
      { type: 'style', pointId: source.points[1].componentId,
        properties: [{ name: 'presStyleLbl', value: 'node1' }] },
    ])
    const effective = materializeFamilyDocument(owner(changed), changed.instances.occurrence)
    const logical = createSmartArtRenderModel(effective, bounds)
    expect(logical.nodes.map((n) => n.componentId))
      .toEqual([source.points[2].componentId, source.points[1].componentId])
    expect(logical.nodes.map((n) => smartArtNodeStyle(effective, n).textDefaults.run.fontLatin.typeface))
      .toEqual(['Second', 'Second'])
    const result = collectSemanticFontRequests(changed)
    expect(result.issues).toEqual([])
    expect(Object.keys(byFace(result))).toEqual(['Arabic', 'Bullet', 'Direct', 'Second'])
    expect(byFace(result).Second.map((l) => l.componentId)).toEqual(
      logical.nodes.map((n) => n.textDocument.paragraphs[0].runs[1].componentId))
    expect(result.identity).not.toBe(collectSemanticFontRequests(semantic).identity)
    expect(JSON.stringify(semantic)).toBe(before)
  })

  it.each([
    [{ missingLabel: true }, 'point'],
    [{ ambiguous: true }, 'presOf'],
    [{ conflict: true }, 'constr'],
  ])('keeps genuine source selection failures located: %j', async (options, kind) => {
    const semantic = await fixture(options), definition = owner(semantic)
    const source = definition.content.smartArtDocument
    const componentId = kind === 'point' ? source.points[1].componentId
      : source.layout.declarations.find((d) => d.type === kind).componentId
    const result = collectSemanticFontRequests(semantic)
    expect(result.faces).toEqual([])
    expect(result.issues).toEqual([{
      code: 'source-smartart-font-context-unavailable', instanceId: 'occurrence',
      componentId, part: definition.source.partUri, path: 'content',
    }])
  })
})
