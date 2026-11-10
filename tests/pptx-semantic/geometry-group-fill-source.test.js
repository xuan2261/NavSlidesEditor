import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import JSZip from 'jszip'
const require = createRequire(import.meta.url)
const { buildSemanticInventory } = require('../../server/services/pptx-import/semantic-inventory')
const {
  buildGeometryStyleSources,
} = require('../../server/services/pptx-import/ooxml-geometry-style-source')
const { projectSemanticImport } = require('../../server/services/pptx-import/semantic-projector')
const { normalizeSemanticPresentation } = require('../../shared/src/pptx-semantic-presentation')
const { materializeGeometry } = require('../../shared/src/pptx-geometry-style-resolution')
const { multiply, transformPoint } = require('../../shared/src/pptx-affine')
const { evaluateGeometryGuides } = require('../../shared/src/pptx-geometry-document')
const P = 'http://schemas.openxmlformats.org/presentationml/2006/main'
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const REL = 'http://schemas.openxmlformats.org/package/2006/relationships'
const relation = (type, target, id = type) =>
  `<Relationship Id="${id}" Type="${R}/${type}" Target="${target}"/>`
const rels = (entries) => `<Relationships xmlns="${REL}">${entries}</Relationships>`
const solid = '<a:solidFill><a:schemeClr val="accent1"/></a:solidFill>'
const nativeGroup = (paint = solid) =>
  `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="7" name="Source group"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm rot="0" flipH="false"><a:off x="952500" y="0"/><a:ext cx="1905000" cy="952500"/><a:chOff x="0" y="-9525"/><a:chExt cx="952500" cy="1905000"/></a:xfrm>${paint}</p:grpSpPr><p:sp><p:nvSpPr><p:cNvPr id="8" name="Inherited leaf"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="476250" cy="476250"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:grpFill/></p:spPr></p:sp></p:grpSp>`
async function fixture(paint, content = nativeGroup(paint)) {
  const zip = new JSZip()
  zip.file(
    '[Content_Types].xml',
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/></Types>'
  )
  zip.file(
    'ppt/presentation.xml',
    `<p:presentation xmlns:p="${P}" xmlns:r="${R}"><p:sldIdLst><p:sldId id="256" r:id="s1"/><p:sldId id="257" r:id="s2"/></p:sldIdLst><p:sldSz cx="9144000" cy="5143500"/></p:presentation>`
  )
  zip.file(
    'ppt/_rels/presentation.xml.rels',
    rels(relation('slide', 'slides/one.xml', 's1') + relation('slide', 'slides/two.xml', 's2'))
  )
  for (const name of ['one', 'two']) {
    zip.file(
      `ppt/slides/${name}.xml`,
      `<p:sld xmlns:p="${P}" xmlns:a="${A}"><p:cSld><p:spTree>${content}</p:spTree></p:cSld></p:sld>`
    )
    zip.file(
      `ppt/slides/_rels/${name}.xml.rels`,
      rels(relation('slideLayout', '../slideLayouts/layout.xml'))
    )
  }
  for (const [part, kind] of [
    ['slideLayouts/layout', 'sldLayout'],
    ['slideMasters/master', 'sldMaster'],
  ])
    zip.file(
      `ppt/${part}.xml`,
      `<p:${kind} xmlns:p="${P}" xmlns:a="${A}"><p:cSld><p:spTree/></p:cSld></p:${kind}>`
    )
  zip.file(
    'ppt/slideLayouts/_rels/layout.xml.rels',
    rels(relation('slideMaster', '../slideMasters/master.xml'))
  )
  zip.file('ppt/slideMasters/_rels/master.xml.rels', rels(relation('theme', '../theme/source.xml')))
  zip.file(
    'ppt/theme/source.xml',
    `<a:theme xmlns:a="${A}"><a:themeElements><a:clrScheme name="Source"><a:accent1><a:srgbClr val="F01E3C"/></a:accent1></a:clrScheme><a:fmtScheme name="Source"><a:fillStyleLst/><a:lnStyleLst/><a:effectStyleLst/><a:bgFillStyleLst/></a:fmtScheme></a:themeElements></a:theme>`
  )
  return { zip, inventory: await buildSemanticInventory(zip) }
}
const nativePlacementGroup = (angle, preset = 'rect', flipH = false, flipV = false) =>
  nativeGroup(solid)
    .replace(
      /<a:xfrm\b[\s\S]*?<\/a:xfrm>/,
      '<a:xfrm><a:off x="381000" y="1714500"/><a:ext cx="2438400" cy="457200"/><a:chOff x="0" y="0"/><a:chExt cx="1219200" cy="914400"/></a:xfrm>'
    )
    .replace(
      '<a:xfrm><a:off x="0" y="0"/><a:ext cx="476250" cy="476250"/></a:xfrm>',
      `<a:xfrm rot="${Math.round(angle * 60000)}" flipH="${flipH}" flipV="${flipV}"><a:off x="${(flipH || flipV ? 39 : 7) * 9525}" y="${(flipH || flipV ? 37 : 13) * 9525}"/><a:ext cx="457200" cy="685800"/></a:xfrm>`
    )
    .replace('<a:prstGeom prst="rect">', `<a:prstGeom prst="${preset}">`)
describe('native source placement under anisotropic groups', () => {
  // PowerPoint 16.0/build 10417, source SHA
  // 2f221e89a34fd4c4f6b610521f7518c31ce8eedc477604a20fc14f8ad8014ce7.
  it.each([
    [0, 96, 36],
    [30, 96, 36],
    [44, 96, 36],
    [45, 24, 144],
    [46, 24, 144],
    [90, 24, 144],
    [134, 24, 144],
    [135, 96, 36],
    [136, 96, 36],
    [180, 96, 36],
    [224, 96, 36],
    [225, 24, 144],
    [226, 24, 144],
    [270, 24, 144],
    [314, 24, 144],
    [315, 96, 36],
    [316, 96, 36],
    [359, 96, 36],
    [-45, 96, 36],
    [405, 24, 144],
    // Independently measured reflected ties; ancestor flips alone do not
    // select this branch. The source leaf has its own odd/even flip parity.
    [45 - 1 / 60000, 96, 36, true, false],
    [45, 96, 36, true, false],
    [45 + 1 / 60000, 24, 144, true, false],
    [45, 96, 36, false, true],
    [45, 24, 144, true, true],
    [135 - 1 / 60000, 24, 144, true, false],
    [135, 24, 144, true, false],
    [135 + 1 / 60000, 96, 36, true, false],
    [225 - 1 / 60000, 96, 36, true, false],
    [225, 96, 36, true, false],
    [225 + 1 / 60000, 24, 144, true, false],
    [315 - 1 / 60000, 24, 144, true, false],
    [315, 24, 144, true, false],
    [315 + 1 / 60000, 96, 36, true, false],
  ])(
    'preserves native rectangle frame at %s degrees without flattening source ancestry (%#)',
    async (angle, width, height, flipH = false, flipV = false) => {
      const { zip } = await fixture(solid, nativePlacementGroup(angle, 'rect', flipH, flipV))
      const bytesBefore = await zip.file('ppt/slides/one.xml').async('string')
      const result = await projectSemanticImport({
        zip,
        geometryInheritance: true,
        presentation: {
          slides: [
            { id: 's1', elements: [] },
            { id: 's2', elements: [] },
          ],
        },
      })
      const model = result.presentation.pptxSemantic
      const leaf = Object.values(model.instances).find(
        (instance) =>
          instance.slideId === 's1' && model.definitions[instance.definitionId].kind === 'shape'
      )
      const parent = model.instances[leaf.parentInstanceId]
      expect(model.definitions[parent.definitionId].kind).toBe('group')
      const world = multiply(parent.localTransform, leaf.localTransform)
      const geometry = materializeGeometry(model, leaf.id)
      expect((Math.hypot(world[0], world[1]) * geometry.width) / 9525).toBeCloseTo(width, 7)
      expect((Math.hypot(world[2], world[3]) * geometry.height) / 9525).toBeCloseTo(height, 7)
      expect(world[0] * world[2] + world[1] * world[3]).toBeCloseTo(0, 9)
      const radians = (angle * Math.PI) / 180
      const horizontal = flipH ? -1 : 1
      expect((horizontal * world[0]) / Math.hypot(world[0], world[1])).toBeCloseTo(
        Math.cos(radians),
        9
      )
      expect((horizontal * world[1]) / Math.hypot(world[0], world[1])).toBeCloseTo(
        Math.sin(radians),
        9
      )
      const center = transformPoint(world, { x: geometry.width / 2, y: geometry.height / 2 })
      expect(center.x / 9525).toBeCloseTo(flipH || flipV ? 166 : 102, 7)
      expect(center.y / 9525).toBeCloseTo(flipH || flipV ? 216.5 : 204.5, 7)
      expect(leaf.overrides).toEqual({})
      const reopened = normalizeSemanticPresentation(
        JSON.parse(JSON.stringify(result.presentation))
      )
      expect(reopened.pptxSemantic.definitions).toEqual(model.definitions)
      expect(reopened.pptxSemantic.styles).toEqual(model.styles)
      expect(reopened.pptxSemantic.instances).toEqual(JSON.parse(JSON.stringify(model.instances)))
      expect(await zip.file('ppt/slides/one.xml').async('string')).toBe(bytesBefore)
    }
  )
  it.each([
    [0, 6.00012],
    [45, 4.00008],
  ])('reevaluates roundRect at native logical extent for %s degrees', async (angle, radiusCss) => {
    const { zip } = await fixture(solid, nativePlacementGroup(angle, 'roundRect'))
    const result = await projectSemanticImport({
      zip,
      geometryInheritance: true,
      presentation: {
        slides: [
          { id: 's1', elements: [] },
          { id: 's2', elements: [] },
        ],
      },
    })
    const model = result.presentation.pptxSemantic
    const leaf = Object.values(model.instances).find(
      (instance) =>
        instance.slideId === 's1' && model.definitions[instance.definitionId].kind === 'shape'
    )
    const world = multiply(
      model.instances[leaf.parentInstanceId].localTransform,
      leaf.localTransform
    )
    const geometry = materializeGeometry(model, leaf.id)
    const radius = evaluateGeometryGuides(geometry).x1 / 9525
    expect(radius * Math.hypot(world[0], world[1])).toBeCloseTo(radiusCss, 7)
    expect(radius * Math.hypot(world[2], world[3])).toBeCloseTo(radiusCss, 7)
    expect(model.definitions[leaf.definitionId].content.geometry).toMatchObject({
      width: 457200,
      height: 685800,
      preset: 'roundRect',
    })
    expect(leaf.overrides).toEqual({})
  })
  it.each(['shape', 'group'])('preserves custom %s adapter placement ownership', async (kind) => {
    const { zip } = await fixture(solid, nativePlacementGroup(30))
    const presentation = {
      slides: [
        { id: 's1', elements: [] },
        { id: 's2', elements: [] },
      ],
    }
    const baseline = await projectSemanticImport({ zip, geometryInheritance: true, presentation })
    const customTransform = [1, 0.2, 0.3, 1, 111, 222]
    const result = await projectSemanticImport({
      zip,
      geometryInheritance: true,
      presentation,
      adapters: {
        [kind]: ({ source, components }) => {
          const definition = baseline.presentation.pptxSemantic.definitions[source.id]
          return {
            kind: definition.kind,
            content: structuredClone(definition.content),
            extent: definition.content.extent,
            localTransform: customTransform,
            ...(kind === 'shape'
              ? { compatibility: baseline.presentation.slides[0].elements[0] }
              : {}),
            mappedDefinitionIds: [
              source.id,
              ...(kind === 'shape' ? components.map((component) => component.id) : []),
            ],
          }
        },
      },
    })
    const model = result.presentation.pptxSemantic
    const custom = Object.values(model.instances).find(
      (instance) =>
        instance.slideId === 's1' && model.definitions[instance.definitionId].kind === kind
    )
    expect(custom.localTransform).toEqual(customTransform)
    for (const instance of Object.values(model.instances))
      expect(instance.sourceBinding).not.toHaveProperty('nativeExtent')
  })
})
describe('immutable native group fill source declarations', () => {
  it('derives no fill for an omitted native group child fill without writing a source default', async () => {
    const { zip } = await fixture(solid)
    const uri = 'ppt/slides/one.xml'
    zip.file(uri, (await zip.file(uri).async('string')).replace('<a:grpFill/>', ''))
    const result = await projectSemanticImport({
      zip,
      geometryInheritance: true,
      presentation: {
        slides: [
          { id: 's1', elements: [] },
          { id: 's2', elements: [] },
        ],
      },
    })
    const model = result.presentation.pptxSemantic
    const leaf = Object.values(model.instances).find(
      (instance) =>
        instance.slideId === 's1' && model.definitions[instance.definitionId].kind === 'shape'
    )
    const declaration =
      model.styles[model.definitions[leaf.definitionId].content.geometrySource.styleId]
    expect(declaration.payload.properties).not.toHaveProperty('fill')
    expect(materializeGeometry(model, leaf.id).style.fill).toEqual({ color: { kind: 'none' } })
    expect(result.presentation.slides[0].elements[0].fill).toBe('none')
    expect(leaf.overrides).toEqual({})
    const reopened = normalizeSemanticPresentation(JSON.parse(JSON.stringify(result.presentation)))
    expect(reopened.pptxSemantic.styles).toEqual(model.styles)
    expect(reopened.pptxSemantic.definitions).toEqual(model.definitions)
    expect(reopened.slides[0].elements[0].fill).toBe('none')
  })
  it('projects source group paint contexts with exact group transform and only leaf DTOs', async () => {
    const { zip } = await fixture(solid)
    const result = await projectSemanticImport({
      zip,
      geometryInheritance: true,
      presentation: {
        slides: [
          { id: 's1', elements: [] },
          { id: 's2', elements: [] },
        ],
      },
    })
    const model = result.presentation.pptxSemantic
    const group = Object.values(model.instances).find(
      (instance) =>
        instance.slideId === 's1' && model.definitions[instance.definitionId].kind === 'group'
    )
    expect(group.localTransform).toEqual([2, 0, -0, 0.5, 952500, 4762.5])
    expect(model.styles[group.sourceBinding.contextId].kind).toBe('group-fill-context')
    const leaf = Object.values(model.instances).find(
      (instance) => instance.parentInstanceId === group.id
    )
    expect(materializeGeometry(model, leaf.id).style.fill).toEqual({
      color: { kind: 'srgb', value: 'F01E3C' },
    })
    expect(result.presentation.slides[0].elements.map((element) => element.pptxInstanceId)).toEqual(
      [leaf.id]
    )
    const reopened = normalizeSemanticPresentation(JSON.parse(JSON.stringify(result.presentation)))
    expect(reopened.pptxSemantic.styles).toEqual(model.styles)
    expect(reopened.pptxSemantic.definitions).toEqual(model.definitions)
    expect(reopened.pptxSemantic.instances[group.id].localTransform).toEqual(
      JSON.parse(JSON.stringify(group.localTransform))
    )
  })
  it.each([
    ['solid', solid],
    ['absent', ''],
    ['noFill', '<a:noFill/>'],
    ['group marker', '<a:grpFill/>'],
  ])(
    'retains %s fill and group coordinate provenance without leaf geometry authority',
    async (kind, paint) => {
      const { zip, inventory } = await fixture(paint)
      const hashes = Object.fromEntries(
        await Promise.all(
          inventory.parts.map(async (entry) => [
            entry.partUri,
            createHash('sha256')
              .update(await zip.file(entry.partUri).async('nodebuffer'))
              .digest('hex'),
          ])
        )
      )
      const result = await buildGeometryStyleSources(zip, inventory)
      const group = inventory.definitions.find(
        (entry) => entry.partUri === 'ppt/slides/one.xml' && entry.kind === 'group'
      )
      const binding = result.definitionBindings[group.id]
      expect(binding).toBeDefined()
      const declaration = result.styles[binding.styleId]
      expect(declaration).toMatchObject({
        kind: 'geometry-declarations',
        origin: 'source',
        source: { partUri: group.partUri, preconditionHash: group.preconditionHash },
        payload: {
          definitionId: group.id,
          paintComponentId: `${group.id}:group-properties`,
          styleRefs: {},
        },
      })
      expect(declaration.payload).not.toHaveProperty('geometry')
      expect(binding.paintComponent).toEqual({
        id: `${group.id}:group-properties`,
        kind: 'property',
        locator: {
          partUri: group.partUri,
          preconditionHash: group.preconditionHash,
          componentLocator: {
            path: [...group.componentLocators[0].path, 1],
            preconditionHash: group.preconditionHash,
          },
        },
      })
      const transform = declaration.payload.transform
      expect(transform.value.rot.value).toBe(0)
      expect(transform.value.flipH.value).toBe(false)
      expect(transform.value.chOff.value.y.value).toBe(-9525)
      expect(transform.value.chExt.value).toMatchObject({
        cx: { value: 952500 },
        cy: { value: 1905000 },
      })
      expect(transform.source.partUri).toBe(group.partUri)
      if (kind === 'absent') expect(declaration.payload.properties).not.toHaveProperty('fill')
      else if (kind === 'group marker')
        expect(declaration.payload.properties.fill.value).toEqual({ group: true })
      else if (kind === 'noFill')
        expect(declaration.payload.properties.fill.value.color.value.kind).toBe('none')
      else
        expect(declaration.payload.properties.fill.value.color.value).toEqual({
          kind: 'scheme',
          value: 'accent1',
        })
      const occurrence = inventory.occurrences.find((entry) => entry.definitionId === group.id)
      const context = result.styles[result.occurrenceBindings[occurrence.id].contextId]
      expect(context).toMatchObject({
        kind: 'group-fill-context',
        origin: 'source',
        payload: {
          definitionId: group.id,
          hostSlidePartUri: 'ppt/slides/one.xml',
          declarationIds: [binding.styleId],
        },
      })
      for (const key of ['geometry', 'matrixBindings', 'transformDeclarationIds'])
        expect(context.payload).not.toHaveProperty(key)
      const leaf = inventory.definitions.find(
        (entry) => entry.parentDefinitionId === group.id && entry.kind === 'shape'
      )
      expect(
        result.styles[result.definitionBindings[leaf.id].styleId].payload.properties.fill.value
      ).toEqual({ group: true })
      expect(JSON.parse(JSON.stringify(result))).toEqual(result)
      for (const entry of inventory.parts)
        expect(
          createHash('sha256')
            .update(await zip.file(entry.partUri).async('nodebuffer'))
            .digest('hex')
        ).toBe(hashes[entry.partUri])
    }
  )
})
