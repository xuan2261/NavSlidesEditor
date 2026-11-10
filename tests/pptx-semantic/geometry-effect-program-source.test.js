import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import source from '../../server/services/pptx-import/ooxml-geometry-style-source.js'
import inventoryModel from '../../server/services/pptx-import/semantic-inventory.js'
import semantic from '../../shared/src/pptx-semantic-document.js'
import resolution from '../../shared/src/pptx-geometry-style-resolution.js'
import effectModel from '../../shared/src/pptx-geometry-effect-program.js'
import projection from '../../shared/src/pptx-projection-operation.js'
import { geometryProjectionFixture } from './geometry-projection-fixture.js'
import { inheritedGeometryStyleFixture, authored } from './geometry-style-fixture.js'

const A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
const P = 'http://schemas.openxmlformats.org/presentationml/2006/main'
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
async function importEffects(xml, theme = false) {
  const zip = new JSZip()
  zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/></Types>')
  zip.file('ppt/presentation.xml', `<p:presentation xmlns:p="${P}" xmlns:r="${R}"><p:sldIdLst><p:sldId id="256" r:id="s"/></p:sldIdLst></p:presentation>`)
  const rels = (type, target, id) => `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="${id}" Type="${R}/${type}" Target="${target}"/></Relationships>`
  zip.file('ppt/_rels/presentation.xml.rels', rels('slide', 'slides/one.xml', 's'))
  zip.file('ppt/slides/one.xml', `<p:sld xmlns:p="${P}" xmlns:a="${A}"><p:cSld><p:spTree><p:sp><p:nvSpPr><p:cNvPr id="2" name="Effects"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="914400" cy="914400"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${theme ? '' : xml}</p:spPr>${theme ? '<p:style><a:effectRef idx="1"><a:srgbClr val="ff0000"/></a:effectRef></p:style>' : ''}</p:sp></p:spTree></p:cSld></p:sld>`)
  zip.file('ppt/slides/_rels/one.xml.rels', rels('slideLayout', '../slideLayouts/one.xml', 'layout'))
  zip.file('ppt/slideLayouts/one.xml', `<p:sldLayout xmlns:p="${P}"><p:cSld><p:spTree/></p:cSld></p:sldLayout>`)
  zip.file('ppt/slideLayouts/_rels/one.xml.rels', rels('slideMaster', '../slideMasters/one.xml', 'master'))
  zip.file('ppt/slideMasters/one.xml', `<p:sldMaster xmlns:p="${P}"><p:cSld><p:spTree/></p:cSld></p:sldMaster>`)
  zip.file('ppt/slideMasters/_rels/one.xml.rels', rels('theme', '../theme/one.xml', 'theme'))
  zip.file('ppt/theme/one.xml', `<a:theme xmlns:a="${A}"><a:themeElements><a:clrScheme name="colors"><a:accent1><a:srgbClr val="123456"/></a:accent1></a:clrScheme><a:fmtScheme name="format">${theme ? `<a:effectStyleLst><a:effectStyle>${xml}</a:effectStyle></a:effectStyleLst>` : ''}</a:fmtScheme></a:themeElements></a:theme>`)
  return source.buildGeometryStyleSources(zip, await inventoryModel.buildSemanticInventory(zip))
}
const wrapProgram = (program) => authored({
  ...program,
  ...(program.name ? { name: authored(program.name) } : {}),
  ...(program.type ? { type: authored(program.type) } : {}),
  effects: program.effects.map((effect) => effect.effects ? wrapProgram(effect) : authored(
    Object.fromEntries(Object.entries(effect).map(([key, value]) => [
      key, key === 'kind' ? value : authored(value),
    ]))
  )),
})
describe('source-bound effect programs', () => {
  it.each([false, true])('parses exact recursive effects from direct/theme sources (%s)', async (theme) => {
    const xml = '<a:effectDag type="tree" name="root"><a:cont name="shifted" type="tree"><a:outerShdw dist="9525"><a:schemeClr val="accent1"/></a:outerShdw></a:cont><a:effect ref="shifted"/><a:reflection sy="-100000" stA="50000"/></a:effectDag>'
    const result = await importEffects(xml, theme)
    const declarations = Object.values(result.styles).find((s) => s.kind === 'geometry-declarations')
    const format = Object.values(result.styles).find((s) => s.kind === 'theme')
    const wrapped = theme ? format.payload.effectStyles[0].value.effects : declarations.payload.properties.effects
    expect(effectModel.unwrapGeometryEffectValue(wrapped)).toEqual({
      kind: 'dag', type: 'tree', name: 'root', effects: [
        { kind: 'cont', name: 'shifted', type: 'tree', effects: [
          { kind: 'outerShdw', dist: 9525, color: { kind: 'scheme', value: 'accent1' } },
        ] },
        { kind: 'effect', ref: 'shifted' },
        { kind: 'reflection', sy: -100000, stA: 50000 },
      ],
    })
    expect(wrapped.value.effects[0].source.componentLocator.path.length)
      .toBeGreaterThan(wrapped.source.componentLocator.path.length)
  })
  it('retains fill overlay blend and preset-shadow tokens without expanding source data', async () => {
    const result = await importEffects('<a:effectLst><a:fillOverlay blend="mult"><a:solidFill><a:srgbClr val="ff0000"/></a:solidFill></a:fillOverlay><a:prstShdw prst="shdw13" dist="9525"><a:srgbClr val="000000"/></a:prstShdw></a:effectLst>')
    const program = Object.values(result.styles).find((s) => s.kind === 'geometry-declarations').payload.properties.effects
    expect(effectModel.unwrapGeometryEffectValue(program).effects).toEqual([
      { kind: 'fillOverlay', blend: 'mult', fill: { color: { kind: 'srgb', value: 'ff0000' } } },
      { kind: 'prstShdw', prst: 'shdw13', dist: 9525, color: { kind: 'srgb', value: '000000' } },
    ])
  })
  it.each([
    '<a:effectLst><a:blur/><a:blur/></a:effectLst>',
    '<a:effectLst><a:glow rad="2"><a:srgbClr val="000000"/></a:glow><a:blur/></a:effectLst>',
    '<a:effectDag><a:reflection endA="100001"/></a:effectDag>',
    '<a:effectDag><a:cont unexpected="1"/></a:effectDag>',
    '<a:effectDag><a:fillOverlay blend="unknown"><a:noFill/></a:fillOverlay></a:effectDag>',
    '<a:effectLst><a:blur rad=""/></a:effectLst>',
    '<a:effectDag name="cycle"><a:effect ref="cycle"/></a:effectDag>',
    '<a:effectDag><a:effect ref="missing"/></a:effectDag>',
    '<a:effectDag><a:cont name="same"/><a:cont name="same"/></a:effectDag>',
  ])('rejects malformed source effects at their source location: %s', async (xml) => {
    await expect(importEffects(xml)).rejects.toMatchObject({
      code: 'PPTX_SEMANTIC_ADMISSION_FAILED',
      sourceLocation: { partUri: 'ppt/slides/one.xml' },
    })
  })
  it('validates source wrappers and resolves colors inside nested containers per occurrence', () => {
    const document = inheritedGeometryStyleFixture()
    document.styles.provider.payload.properties.effects = wrapProgram({
      kind: 'dag', type: 'tree', effects: [
        { kind: 'cont', name: 'colored', effects: [
          { kind: 'outerShdw', color: { kind: 'scheme', value: 'accent1' }, dist: 9525 },
        ] },
        { kind: 'effect', ref: 'colored' },
      ],
    })
    const checked = semantic.normalizePptxSemanticDocument(document)
    const a = resolution.materializeGeometry(checked, 'i1').style.effects
    const b = resolution.materializeGeometry(checked, 'i2').style.effects
    expect(a.effects[0].effects[0].color.kind).toBe('srgb')
    expect(a.effects[0].effects[0].color).not.toEqual(b.effects[0].effects[0].color)
    expect(a.effects[1]).toEqual({ kind: 'effect', ref: 'colored' })
    const forged = structuredClone(document)
    forged.styles.provider.payload.properties.effects.value.effects[0].source.partUri = 'forged.xml'
    expect(() => semantic.normalizePptxSemanticDocument(forged)).toThrow()
  })
  it('persists a whole DAG override through the production command without changing source or sibling', () => {
    const presentation = geometryProjectionFixture()
    presentation.pptxSemantic = inheritedGeometryStyleFixture()
    const before = structuredClone(presentation)
    const program = { kind: 'dag', type: 'tree', effects: [
      { kind: 'cont', name: 'shifted', effects: [
        { kind: 'outerShdw', color: { kind: 'scheme', value: 'accent1' }, dist: 9525 },
      ] },
      { kind: 'effect', ref: 'shifted' },
      { kind: 'reflection', sy: -100000 },
    ] }
    const operation = {
      type: 'geometry.edit', instanceId: 'i1', componentId: 'geometry',
      command: { type: 'effects', effects: program },
    }
    const changed = projection.applyPresentationProjectionOperation(presentation, operation)
    const reopened = semantic.normalizePptxSemanticDocument(JSON.parse(JSON.stringify(changed.pptxSemantic)))
    expect(reopened.instances.i1.overrides.components.geometry.geometryStyle.effects).toEqual(program)
    expect(resolution.materializeGeometry(reopened, 'i1').style.effects.effects[0].effects[0].color.kind)
      .toBe('srgb')
    expect(reopened.definitions).toEqual(before.pptxSemantic.definitions)
    expect(resolution.materializeGeometry(reopened, 'i2')).toEqual(
      resolution.materializeGeometry(before.pptxSemantic, 'i2'))
    expect(presentation).toEqual(before)
    expect(() => projection.applyPresentationProjectionOperation(presentation, {
      ...operation, command: { type: 'effects', effects: {
        kind: 'dag', effects: [{ kind: 'effect', ref: 'not-there' }],
      } },
    })).toThrow()
    expect(presentation).toEqual(before)
  })
})
