import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pictureFixture } from './semantic-picture-fixture'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { fixture, slide, layout, master } from './semantic-text-style-context-fixture'

const require = createRequire(import.meta.url)
const { projectSemanticImport } = require('../../server/services/pptx-import/semantic-projector')
const { normalizeSemanticPresentation } = require('../../shared/src/pptx-semantic-presentation')
const { semanticRenderTree } = require('../../shared/src/pptx-semantic-render-tree')

// The two unchanged declaration programs inventoried in genuine Bai_2_2 slide6.
const scene = '<a:scene3d><a:camera prst="orthographicFront"><a:rot lat="0" lon="0" rev="0"/></a:camera><a:lightRig rig="soft" dir="t"><a:rot lat="0" lon="0" rev="0"/></a:lightRig></a:scene3d>'
const shape = '<a:sp3d contourW="44450" prstMaterial="matte"><a:bevelT w="63500" h="63500" prst="artDeco"/><a:contourClr><a:srgbClr val="FFFFFF"/></a:contourClr></a:sp3d>'
const geometry = '<a:xfrm><a:off x="0" y="0"/><a:ext cx="914400" cy="457200"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="123456"/></a:solidFill>'
async function imported(appearance = scene + shape, geometryInheritance = true) {
  const zip = await fixture()
  const before = new Map()
  for (const part of [slide, layout, master]) {
    const xml = (await zip.file(part).async('string')).replaceAll('<p:spPr/>', `<p:spPr>${geometry}${appearance}</p:spPr>`)
    zip.file(part, xml)
    before.set(part, xml)
  }
  zip.file('ppt/presentation.xml', (await zip.file('ppt/presentation.xml').async('string'))
    .replace('</p:presentation>', '<p:sldSz cx="9144000" cy="5143500"/></p:presentation>'))
  const result = await projectSemanticImport({ zip, geometryInheritance,
    presentation: { title: 'Preserved source appearance', slides: [{ id: 's1', elements: [] }] } })
  for (const [part, xml] of before) expect(await zip.file(part).async('string')).toBe(xml)
  return result
}
const sourceDefinitions = (p) => Object.values(p.pptxSemantic.definitions).filter((d) => d.content.shape3dAppearance)
const sourceDefinition = (p) => sourceDefinitions(p).find((d) => d.source.partUri === slide)

describe('readonly typed source 3D appearance preservation, not 3D rendering', () => {
  it('retains both actual source programs on slide, layout and master with exact inventoried property provenance', async () => {
    const result = await imported()
    expect(sourceDefinitions(result.presentation)).toHaveLength(3)
    expect(result.admission.visualQualification).toBe('unqualified')
    for (const d of sourceDefinitions(result.presentation)) {
      const a = d.content.shape3dAppearance
      expect(a.schemaVersion).toBe(1)
      expect(a.scene.value).toMatchObject({ kind: 'scene3d',
        camera: { value: { kind: 'camera', prst: 'orthographicFront', rotation: { value: { kind: 'rot', lat: 0, lon: 0, rev: 0 } } } },
        lightRig: { value: { kind: 'lightRig', rig: 'soft', dir: 't', rotation: { value: { kind: 'rot', lat: 0, lon: 0, rev: 0 } } } } })
      expect(a.shape.value).toMatchObject({ kind: 'sp3d', contourW: 44450, prstMaterial: 'matte',
        bevelTop: { value: { kind: 'bevelT', w: 63500, h: 63500, prst: 'artDeco' } },
        contourColor: { value: { kind: 'contourClr', color: { kind: 'srgb', value: 'FFFFFF' } } } })
      for (const root of [a.scene, a.shape]) {
        const component = d.components.find((c) => c.id === root.componentId)
        const inventory = result.inventory.definitions.find((c) => c.id === root.componentId)
        expect(component.kind).toBe('property')
        expect(inventory.kind).toBe('property')
        expect(inventory.parentDefinitionId).toBe(d.id)
        expect(root.source).toEqual({ partUri: d.source.partUri, preconditionHash: d.source.preconditionHash,
          componentLocator: component.locator })
        expect(root.source.componentLocator).toEqual(inventory.componentLocators[0])
        expect(result.admission.dispositions.find((c) => c.definitionId === component.id).disposition).toBe('semantically-mapped')
      }
    }
    expect(result.warnings).toHaveLength(6)
    expect(result.warnings.every((w) => w.type === '3d-appearance-preserved-unrendered' &&
      w.definitionId && w.componentId && w.partUri && !w.message.includes('<a:'))).toBe(true)
  })

  it('saves/reopens without dropping values and leaves existing 2D render output unchanged', async () => {
    const { presentation } = await imported()
    const saved = JSON.parse(JSON.stringify(presentation))
    const reopened = normalizeSemanticPresentation(saved)
    expect(sourceDefinitions(reopened)).toEqual(sourceDefinitions(presentation))
    const semantic = reopened.pptxSemantic
    const before = JSON.stringify(semantic)
    const rendered = semanticRenderTree(semantic, reopened.slides[0])
    const without = structuredClone(reopened)
    for (const d of sourceDefinitions(without)) delete d.content.shape3dAppearance
    expect(semanticRenderTree(without.pptxSemantic, without.slides[0])).toEqual(rendered)
    expect(JSON.stringify(semantic)).toBe(before)
    const d = sourceDefinition(reopened)
    expect(Object.isFrozen(d.content.shape3dAppearance.shape.value)).toBe(true)
    expect(() => { d.content.shape3dAppearance.shape.value.contourW = 0 }).toThrow(TypeError)
    expect(sourceDefinition(presentation).content.shape3dAppearance.shape.value.contourW).toBe(44450)
  })

  it('uses the same disclosure and retained source field without linked geometry', async () => {
    // Nonlinked shapes cannot have inherited placeholder styles, so exercise a concrete source shape.
    const zip = await fixture()
    for (const part of [slide, layout, master]) {
      const xml = (await zip.file(part).async('string')).replaceAll('<p:spPr/>', `<p:spPr>${geometry}${scene}${shape}</p:spPr>`)
        .replace(/<p:ph[^>]*\/>/g, '')
      zip.file(part, xml)
    }
    zip.file('ppt/presentation.xml', (await zip.file('ppt/presentation.xml').async('string'))
      .replace('</p:presentation>', '<p:sldSz cx="9144000" cy="5143500"/></p:presentation>'))
    const result = await projectSemanticImport({ zip, geometryInheritance: false,
      presentation: { title: 'Concrete source appearance', slides: [{ id: 's1', elements: [] }] } })
    expect(sourceDefinition(result.presentation).content.shape3dAppearance.shape.value.contourW).toBe(44450)
    expect(result.warnings.filter((w) => w.partUri === slide)).toHaveLength(2)
  })

  it.each(['line', 'image'])('preserves canonical %s source appearance through saved-model normalization', async (kind) => {
    const uploadsDir = await mkdtemp(join(tmpdir(), 'semantic-3d-owner-'))
    try {
      const { zip } = await pictureFixture({ uploadsDir, effects: '', crop: '', outline: '', frameGeometry: 'rect' })
      const part = 'ppt/slides/slide1.xml'
      const original = await zip.file(part).async('string')
      const xml = kind === 'image'
        ? original.replaceAll('</p:spPr>', `${scene}${shape}</p:spPr>`)
        : original.replace(/<p:pic>.*?<\/p:pic>/g, (picture) => {
          const id = /<p:cNvPr id="(\d+)"/.exec(picture)[1]
          return `<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="${id}" name="Connector"/><p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr><p:spPr>${geometry.replace('prst="rect"', 'prst="line"')}${scene}${shape}</p:spPr></p:cxnSp>`
        })
      zip.file(part, xml)
      const result = await projectSemanticImport({ zip, uploadsDir, geometryInheritance: true,
        presentation: { id: 'owners', title: 'Source owners', slides: [{ id: 's1', elements: [] }] } })
      const saved = JSON.parse(JSON.stringify(result.presentation))
      // Linked connectors currently project as shapes; saved canonical lines are
      // also a valid document consumer, independently of that adapter choice.
      if (kind === 'line') for (const d of sourceDefinitions(saved)) d.kind = 'line'
      const reopened = normalizeSemanticPresentation(saved)
      const definitions = sourceDefinitions(reopened)
      expect(definitions.map((d) => d.kind)).toEqual([kind, kind])
      expect(definitions).toEqual(sourceDefinitions(saved))
      for (const d of definitions) {
        expect(d.content.shape3dAppearance.shape.source.partUri).toBe(part)
        expect(d.content.shape3dAppearance.shape.value.contourW).toBe(44450)
        expect(() => { d.content.shape3dAppearance.shape.value.contourW = 0 }).toThrow(TypeError)
      }
      expect(await zip.file(part).async('string')).toBe(xml)
    } finally {
      await rm(uploadsDir, { recursive: true, force: true })
    }
  })

  it.each([
    ['unknown scene child', scene.replace('</a:scene3d>', '<a:unknown/></a:scene3d>')],
    ['duplicate camera', scene.replace('<a:lightRig', '<a:camera prst="orthographicFront"/><a:lightRig')],
    ['missing camera', '<a:scene3d><a:lightRig rig="soft" dir="t"/></a:scene3d>'],
    ['wrong ordering', '<a:scene3d><a:lightRig rig="soft" dir="t"/><a:camera prst="orthographicFront"/></a:scene3d>'],
    ['invalid camera enum', scene.replace('orthographicFront', 'notACamera')],
    ['invalid light enum', scene.replace('rig="soft"', 'rig="notARig"')],
    ['invalid direction', scene.replace('dir="t"', 'dir="north"')],
    ['invalid rotation', scene.replace('lat="0"', 'lat="NaN"')],
    ['unknown attribute', shape.replace('contourW="44450"', 'unknown="1"')],
    ['invalid coordinate', shape.replace('44450', '-1')],
    ['invalid bevel', shape.replace('artDeco', 'unknown')],
    ['invalid material', shape.replace('matte', 'unknown')],
    ['duplicate color', shape.replace('</a:contourClr>', '<a:srgbClr val="000000"/></a:contourClr>')],
    ['wrong namespace', scene.replace('<a:camera', '<bad:camera xmlns:bad="urn:wrong"').replace('</a:camera>', '</bad:camera>')],
    ['unexpected text', scene.replace('<a:scene3d>', '<a:scene3d>text')],
    ['unknown extension', shape.replace('</a:sp3d>', '<a:extLst/></a:sp3d>')],
    ['duplicate root', scene + scene],
  ])('rejects malformed %s without silently discarding declarations', async (_name, appearance) => {
    await expect(imported(appearance)).rejects.toMatchObject({ code: 'PPTX_SEMANTIC_ADMISSION_FAILED' })
  })

  it.each([
    ['foreign hash', (a) => { a.scene.source.preconditionHash = 'f'.repeat(64) }],
    ['foreign URI', (a) => { a.scene.source.partUri = master }],
    ['foreign component', (a) => { a.scene.componentId = a.shape.componentId }],
    ['shifted root locator', (a) => { a.scene.source.componentLocator.path.push(0) }],
    ['shifted nested locator', (a) => { a.scene.value.camera.source.componentLocator.path.push(0) }],
    ['missing camera', (a) => { delete a.scene.value.camera }],
    ['generic bag', (a) => { a.shape.value.attributes = { unknown: '1' } }],
    ['unknown enum', (a) => { a.shape.value.prstMaterial = 'unknown' }],
    ['malformed number', (a) => { a.shape.value.contourW = '44450' }],
    ['invalid color', (a) => { a.shape.value.contourColor.value.color.value = 'notRGB' }],
  ])('rejects malformed saved %s', async (_name, mutate) => {
    const { presentation } = await imported()
    const p = structuredClone(presentation)
    mutate(sourceDefinition(p).content.shape3dAppearance)
    expect(() => normalizeSemanticPresentation(p)).toThrow(/3D appearance/)
  })

  it('rejects mutable appearance field and component overrides', async () => {
    const { presentation } = await imported()
    const d = sourceDefinition(presentation)
    const instance = Object.values(presentation.pptxSemantic.instances).find((i) => i.definitionId === d.id)
    for (const override of [
      { shape3dAppearance: d.content.shape3dAppearance },
      { components: { [d.content.shape3dAppearance.scene.componentId]: { hidden: true } } },
      { components: { [d.content.shape3dAppearance.shape.componentId]: { shape3dAppearance: {} } } },
    ]) {
      const p = structuredClone(presentation)
      p.pptxSemantic.instances[instance.id].overrides = override
      expect(() => normalizeSemanticPresentation(p)).toThrow(/3D appearance/)
    }
  })
})
