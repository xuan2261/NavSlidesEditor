import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import JSZip from 'jszip'
import { mkdtemp, rm, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
const require = createRequire(import.meta.url)
const { projectSemanticImport } = require('../../server/services/pptx-import/semantic-projector')
const { buildSemanticInventory } = require('../../server/services/pptx-import/semantic-inventory')
const {
  buildGeometryStyleSources,
} = require('../../server/services/pptx-import/ooxml-geometry-style-source')
const { readGeometrySource } = require('../../server/services/pptx-import/ooxml-geometry-source')
const { parseXml } = require('../../server/services/pptx-import/ooxml-text-run-xml')
const { createMediaTransaction } = require('../../server/services/pptx-import/media-dedup')
const {
  evaluateGeometryGuides,
  deriveGeometryPaths,
} = require('../../shared/src/pptx-geometry-document')
const {
  materializeGeometry,
  resolveGeometryTransform,
} = require('../../shared/src/pptx-geometry-style-resolution')
const { normalizeSemanticPresentation } = require('../../shared/src/pptx-semantic-presentation')
const { semanticRenderTree } = require('../../shared/src/pptx-semantic-render-tree')
const { instanceWorldTransform } = require('../../shared/src/pptx-semantic-groups')
const { multiply, groupTransform, leafTransform } = require('../../shared/src/pptx-affine')
const { renderSlideElements } = require('../../shared/src/element-renderers')
const {
  collectTrustedImportMetadata,
} = require('../../server/services/pptx-import/trusted-import-metadata')
const P = 'http://schemas.openxmlformats.org/presentationml/2006/main'
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const REL = 'http://schemas.openxmlformats.org/package/2006/relationships'
const ph = '<p:ph idx="7" type="body"/>'
const rect = '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>'
const xfrm = (cx = 952500, cy = 762000) =>
  `<a:xfrm rot="0" flipH="false"><a:off x="0" y="-9525"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>`
const fill = '<a:solidFill><a:schemeClr val="accent1"/></a:solidFill>'
const shape = (id, properties = '', placeholder = '', style = '') =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Source"/><p:cNvSpPr/><p:nvPr>${placeholder}</p:nvPr></p:nvSpPr><p:spPr>${properties}</p:spPr>${style}</p:sp>`
const part = (kind, shapes, map = '') =>
  `<p:${kind} xmlns:p="${P}" xmlns:a="${A}"><p:cSld><p:spTree>${shapes}</p:spTree></p:cSld>${map}</p:${kind}>`
const relationship = (type, target, id = 'edge') =>
  `<Relationship Id="${id}" Type="${R}/${type}" Target="${target}"/>`
const rels = (xml) => `<Relationships xmlns="${REL}">${xml}</Relationships>`
const slides = () => [
  { id: 'first', elements: [] },
  { id: 'second', elements: [] },
]

describe('single centered source outlines', () => {
  it('materializes native fields and preserves them through JSON reload without freezing source paint', async () => {
    const zip = await fixture({
      slide: shape(
        2,
        xfrm() +
          rect +
          '<a:ln w="12700" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:srgbClr val="445566"/></a:solidFill></a:ln>'
      ),
    })
    const result = await projectSemanticImport({
      zip,
      presentation: { slides: slides() },
      geometryInheritance: true,
    })
    const before = structuredClone(result.presentation.pptxSemantic)
    const model = result.presentation.pptxSemantic
    const instance = Object.values(model.instances).find(
      (entry) => model.definitions[entry.definitionId].source.nativeId === '2'
    )
    expect(materializeGeometry(model, instance.id).style.stroke).toMatchObject({
      compound: 'sng',
      alignment: 'ctr',
      color: { kind: 'srgb', value: '445566' },
      width: 12700,
    })
    expect(model.definitions[instance.definitionId].content.geometry).not.toHaveProperty('style')
    const restored = normalizeSemanticPresentation(JSON.parse(JSON.stringify(result.presentation)))
    expect(materializeGeometry(restored.pptxSemantic, instance.id).style.stroke).toEqual(
      materializeGeometry(model, instance.id).style.stroke
    )
    expect(
      renderSlideElements(restored.slides[0], { pptxSemantic: restored.pptxSemantic })
    ).toContain('stroke:#445566')
    expect(model).toEqual(before)
  })
})

describe('source pattern projection integration', () => {
  it.each([false, true])(
    'projects source pattern with matrix binding=%s and preserves wire reload',
    async (matrixBinding) => {
      const pattern =
        '<a:pattFill prst="diagCross"><a:fgClr><a:schemeClr val="phClr"><a:shade val="50000"/></a:schemeClr></a:fgClr><a:bgClr><a:prstClr val="cornflowerBlue"><a:alpha val="50000"/></a:prstClr></a:bgClr></a:pattFill>'
      const direct = pattern
        .replace('<a:schemeClr val="phClr">', '<a:srgbClr val="2468AC">')
        .replace('</a:schemeClr>', '</a:srgbClr>')
      const zip = await fixture({
        slide: shape(
          2,
          xfrm() + rect + (matrixBinding ? '' : direct),
          '',
          matrixBinding
            ? '<p:style><a:fillRef idx="1"><a:srgbClr val="2468AC"/></a:fillRef></p:style>'
            : ''
        ),
        matrix: matrixBinding ? `<a:fillStyleLst>${pattern}</a:fillStyleLst>` : '',
      })
      const bytes = await zip.file('ppt/slides/one.xml').async('string')
      const result = await projectSemanticImport({
        zip,
        presentation: { slides: slides() },
        geometryInheritance: true,
      })
      const model = result.presentation.pptxSemantic
      const before = structuredClone(model)
      if (matrixBinding) {
        const theme = Object.values(model.styles).find((style) => style.kind === 'theme')
        const sourceColor = theme.payload.fillStyles[0].value.pattern.value.foreground.value
        expect(sourceColor.kind).toBe('scheme')
        expect(sourceColor.value).toBe('phClr')
        expect(sourceColor.transforms.map((transform) => transform.value)).toEqual([
          { kind: 'shade', value: 50000 },
        ])
      } else {
        await expect(
          projectSemanticImport({
            zip,
            presentation: { slides: slides() },
            geometryInheritance: false,
          })
        ).rejects.toMatchObject({ code: 'PPTX_SEMANTIC_ADMISSION_FAILED' })
      }
      const instance = Object.values(model.instances).find(
        (entry) => model.definitions[entry.definitionId].source.nativeId === '2'
      )
      const fill = materializeGeometry(model, instance.id).style.fill.pattern
      expect(fill).toEqual({
        preset: 'diagCross',
        foreground: {
          kind: 'srgb',
          value: '2468AC',
          transforms: [{ kind: 'shade', value: 50000 }],
        },
        background: {
          kind: 'preset',
          value: 'cornflowerBlue',
          transforms: [{ kind: 'alpha', value: 50000 }],
        },
      })
      const reopened = normalizeSemanticPresentation(
        JSON.parse(JSON.stringify(result.presentation))
      )
      expect(materializeGeometry(reopened.pptxSemantic, instance.id).style.fill.pattern).toEqual(
        fill
      )
      const projected = semanticRenderTree(reopened.pptxSemantic, reopened.slides[0]).find(
        (node) => node.instanceId === instance.id
      ).element
      expect(projected.pptxOccurrenceMatrix).toEqual([1, 0, 0, 1, 0, -9525])
      const svg = renderSlideElements(reopened.slides[0], { pptxSemantic: reopened.pptxSemantic })
      expect(svg).toContain('<pattern')
      expect(svg).toContain('patternUnits="userSpaceOnUse"')
      expect(svg).toContain('#6495ED')
      expect(svg).toContain('patternTransform="matrix(9525 0 0 9525 0 9525)"')
      expect(model).toEqual(before)
      expect(await zip.file('ppt/slides/one.xml').async('string')).toBe(bytes)
    }
  )
  it('forwards the composed EMU world matrix through noncommuting source groups', async () => {
    const outer = {
      off: { x: 952500, y: 381000 },
      ext: { cx: 1905000, cy: 1143000 },
      chOff: { x: 0, y: 0 },
      chExt: { cx: 952500, cy: 381000 },
    }
    const inner = {
      off: { x: 190500, y: 95250 },
      ext: { cx: 762000, cy: 571500 },
      chOff: { x: 95250, y: 0 },
      chExt: { cx: 381000, cy: 190500 },
      rotation: 5400000,
    }
    const group = (id, frame, body) => {
      const xml = ['off', 'ext', 'chOff', 'chExt']
        .map(
          (key) =>
            `<a:${key} ${Object.entries(frame[key])
              .map(([name, value]) => `${name}="${value}"`)
              .join(' ')}/>`
        )
        .join('')
      return `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="${id}" name="Group ${id}"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm rot="${frame.rotation ?? 0}">${xml}</a:xfrm></p:grpSpPr>${body}</p:grpSp>`
    }
    const zip = await fixture({
      slide: group(
        20,
        outer,
        group(21, inner, shape(2, xfrm() + rect + '<a:pattFill prst="dnDiag"/>'))
      ),
    })
    const bytes = await zip.file('ppt/slides/one.xml').async('string')
    const result = await projectSemanticImport({
      zip,
      presentation: { slides: slides() },
      geometryInheritance: true,
    })
    const model = result.presentation.pptxSemantic
    const before = structuredClone(model)
    const sourceWorld = multiply(
      multiply(groupTransform(outer), groupTransform(inner)),
      leafTransform({ off: { x: 0, y: -9525 }, ext: { cx: 952500, cy: 762000 } })
    )
    const nodes = semanticRenderTree(model, result.presentation.slides[0])
    const leaf = nodes
      .find((node) => node.kind === 'group')
      .children.find((node) => node.kind === 'group')
      .children.find((node) => node.kind === 'shape').element
    const world = instanceWorldTransform(model, leaf.pptxInstanceId)
    expect(leaf.pptxOccurrenceMatrix).toEqual(world)
    const geometry = materializeGeometry(model, leaf.pptxInstanceId)
    expect(geometry.width * Math.hypot(world[0], world[1])).toBeCloseTo(
      952500 * Math.hypot(sourceWorld[0], sourceWorld[1]),
      6
    )
    expect(geometry.height * Math.hypot(world[2], world[3])).toBeCloseTo(
      762000 * Math.hypot(sourceWorld[2], sourceWorld[3]),
      6
    )
    expect(world[4]).toBeCloseTo(sourceWorld[4], 6)
    expect(world[5]).toBeCloseTo(sourceWorld[5], 6)
    const svg = renderSlideElements(result.presentation.slides[0], { pptxSemantic: model })
    const patternTransform = svg
      .match(/patternTransform="matrix\(([^)]+)\)"/)[1]
      .split(' ')
      .map(Number)
    const composed = multiply(world, patternTransform)
    for (const [index, value] of [9525, 0, 0, 9525, 0, 0].entries())
      expect(composed[index]).toBeCloseTo(value, 6)
    expect(model).toEqual(before)
    expect(await zip.file('ppt/slides/one.xml').async('string')).toBe(bytes)
  })
})

describe('compound outline source-context integration', () => {
  it.each(
    ['sng', 'dbl', 'thinThick', 'thickThin', 'tri'].flatMap((compound) =>
      ['ctr', 'in'].map((alignment) => [compound, alignment])
    )
  )(
    'materializes and renders %s/%s without mutating linked source',
    async (compound, alignment) => {
      const line =
        `<a:ln w="12700" cap="flat" cmpd="${compound}" algn="${alignment}">` +
        '<a:solidFill><a:srgbClr val="445566"/></a:solidFill>' +
        '<a:prstDash val="solid"/><a:miter lim="800000"/></a:ln>'
      const zip = await fixture({ slide: shape(2, xfrm() + rect + line) })
      const bytesBefore = await zip.file('ppt/slides/one.xml').async('string')
      const result = await projectSemanticImport({
        zip,
        presentation: { slides: slides() },
        geometryInheritance: true,
      })
      const model = result.presentation.pptxSemantic
      const before = structuredClone(model)
      const instance = Object.values(model.instances).find(
        (entry) => model.definitions[entry.definitionId].source.nativeId === '2'
      )
      expect(materializeGeometry(model, instance.id).style.stroke).toMatchObject({
        compound,
        alignment,
        width: 12700,
        cap: 'flat',
      })
      const restored = normalizeSemanticPresentation(
        JSON.parse(JSON.stringify(result.presentation))
      )
      expect(materializeGeometry(restored.pptxSemantic, instance.id)).toEqual(
        materializeGeometry(model, instance.id)
      )
      const rendered = renderSlideElements(restored.slides[0], {
        pptxSemantic: restored.pptxSemantic,
      })
      expect(rendered).toContain(
        compound === 'sng' && alignment === 'ctr' ? 'stroke:#445566' : 'fill:#445566;stroke:none'
      )
      expect(model.definitions[instance.definitionId].content.geometry).not.toHaveProperty('style')
      expect(model).toEqual(before)
      expect(await zip.file('ppt/slides/one.xml').async('string')).toBe(bytesBefore)
    }
  )
})

async function fixture({
  slide = shape(2, '', ph),
  layout = shape(3, '', ph),
  master,
  matrix = '',
} = {}) {
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
    rels(
      relationship('slide', 'slides/one.xml', 's1') + relationship('slide', 'slides/two.xml', 's2')
    )
  )
  for (const name of ['one', 'two']) {
    zip.file(
      `ppt/slides/${name}.xml`,
      part(
        'sld',
        typeof slide === 'function' ? slide(name) : slide,
        `<p:clrMapOvr><a:overrideClrMapping accent1="${name === 'one' ? 'accent2' : 'accent3'}"/></p:clrMapOvr>`
      )
    )
    zip.file(
      `ppt/slides/_rels/${name}.xml.rels`,
      rels(relationship('slideLayout', '../slideLayouts/layout.xml'))
    )
  }
  zip.file('ppt/slideLayouts/layout.xml', part('sldLayout', layout))
  zip.file(
    'ppt/slideLayouts/_rels/layout.xml.rels',
    rels(relationship('slideMaster', '../slideMasters/master.xml'))
  )
  zip.file(
    'ppt/slideMasters/master.xml',
    part(
      'sldMaster',
      master ?? shape(4, xfrm() + rect + fill, ph) + shape(5, xfrm() + rect + '<a:noFill/>'),
      '<p:clrMap accent1="accent1"/>'
    )
  )
  zip.file(
    'ppt/slideMasters/_rels/master.xml.rels',
    rels(relationship('theme', '../theme/theme.xml'))
  )
  zip.file(
    'ppt/theme/theme.xml',
    `<a:theme xmlns:a="${A}"><a:themeElements><a:clrScheme name="Source"><a:accent1><a:srgbClr val="123456"/></a:accent1><a:accent2><a:srgbClr val="FF0000"/></a:accent2><a:accent3><a:sysClr val="windowText" lastClr="0000FF"/></a:accent3></a:clrScheme><a:fmtScheme name="Source">${matrix}</a:fmtScheme></a:themeElements></a:theme>`
  )
  return zip
}
const project = (zip, options = {}) =>
  projectSemanticImport({
    zip,
    presentation: { title: 'Inheritance', slides: slides() },
    geometryInheritance: true,
    ...options,
  })

describe('source-bound native geometry image fill projection', () => {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aGkwAAAAASUVORK5CYII=',
    'base64'
  )
  it.each(['slide', 'layout', 'master'])(
    'binds the %s declaration image rather than host aliases',
    async (scope) => {
      const paint = `<a:blipFill><a:blip xmlns:r="${R}" r:embed="imageOwner"/><a:stretch/></a:blipFill>`
      const owner =
        scope === 'slide'
          ? 'ppt/slides/one.xml'
          : scope === 'layout'
            ? 'ppt/slideLayouts/layout.xml'
            : 'ppt/slideMasters/master.xml'
      const zip = await fixture({
        slide:
          scope === 'slide'
            ? (name) => shape(2, xfrm() + rect + (name === 'one' ? paint : fill), ph)
            : shape(2, '', ph),
        layout: scope === 'layout' ? shape(3, xfrm() + rect + paint, ph) : shape(3, '', ph),
        ...(scope === 'master' ? { master: shape(4, xfrm() + rect + paint, ph) } : {}),
      })
      const types = await zip.file('[Content_Types].xml').async('string')
      zip.file(
        '[Content_Types].xml',
        types.replace('</Types>', '<Default Extension="png" ContentType="image/png"/></Types>')
      )
      zip.file('ppt/media/source.png', png)
      zip.file('ppt/media/decoy.png', Buffer.from('host alias is not the declaration image'))
      for (const [partUri, base] of [
        ['ppt/slides/one.xml', relationship('slideLayout', '../slideLayouts/layout.xml')],
        ['ppt/slides/two.xml', relationship('slideLayout', '../slideLayouts/layout.xml')],
        ['ppt/slideLayouts/layout.xml', relationship('slideMaster', '../slideMasters/master.xml')],
        ['ppt/slideMasters/master.xml', relationship('theme', '../theme/theme.xml')],
      ]) {
        const relPart = partUri.replace(/([^/]+)$/, '_rels/$1.rels')
        zip.file(
          relPart,
          rels(
            base +
              relationship(
                'image',
                partUri === owner ? '../media/source.png' : '../media/decoy.png',
                'imageOwner'
              )
          )
        )
      }
      const uploadsDir = await mkdtemp(join(tmpdir(), 'navslides-blip-project-'))
      const mediaTransaction = createMediaTransaction({ hashScope: {} })
      try {
        const result = await project(zip, { uploadsDir, mediaTransaction })
        const model = result.presentation.pptxSemantic
        const instance = Object.values(model.instances).find(
          (entry) => entry.slideId === 'first' && entry.definitionId.endsWith('#shape:2')
        )
        const geometry = materializeGeometry(model, instance.id)
        const binding = model.styles[geometry.style.fill.blip.bindingId]
        expect(binding.source.partUri).toBe(owner)
        expect(binding.payload.edge.fromPartUri).toBe(owner)
        expect(binding.payload.asset.preconditionHash).toBe(
          createHash('sha256').update(png).digest('hex')
        )
        expect(binding.payload.asset).toMatchObject({ width: 1, height: 1, format: 'png' })
        const before = structuredClone(model)
        const reopened = normalizeSemanticPresentation(
          JSON.parse(JSON.stringify(result.presentation))
        )
        const html = renderSlideElements(reopened.slides[0], {
          pptxSemantic: reopened.pptxSemantic,
        })
        expect(html).toContain('<image ')
        expect(html).toContain(binding.payload.asset.src)
        expect(html).toContain('data-pptx-geometry-path')
        expect(reopened.pptxSemantic).toEqual(JSON.parse(JSON.stringify(before)))
        expect(model).toEqual(before)
        expect(JSON.stringify(geometry)).not.toContain('/uploads/')
        expect(await readdir(uploadsDir)).toHaveLength(1)
      } finally {
        await mediaTransaction.rollback()
        expect(await readdir(uploadsDir)).toEqual([])
        await rm(uploadsDir, { recursive: true, force: true })
      }
    }
  )
})

describe('native geometry colors through source contexts', () => {
  const nativeColors = [
    [
      'scrgbClr r="50000" g="25000" b="10000"',
      { kind: 'scrgb', value: { r: 50000, g: 25000, b: 10000 } },
      'BC8959',
    ],
    [
      'hslClr hue="12600000" sat="50000" lum="40000"',
      { kind: 'hsl', value: { hue: 12600000, sat: 50000, lum: 40000 } },
      '336699',
    ],
    ['prstClr val="cornflowerBlue"', { kind: 'preset', value: 'cornflowerBlue' }, '6495ED'],
  ]
  it.each(
    nativeColors.flatMap(([tag, color], index) => [
      [tag, color, { kind: 'red', value: 50000 }, ['BC8959', 'BC6699', 'BC95ED'][index]],
      [tag, color, { kind: 'gray' }, ['909090', '5F5F5F', '919191'][index]],
      [tag, color, { kind: 'comp' }, ['598CBC', '996633', 'EDBC64'][index]],
    ])
  )(
    'retains %s with %j through source contexts, JSON and every geometry paint',
    async (tag, nativeColor, transform, expected) => {
      const name = tag.split(' ')[0]
      const xml = `<a:${tag}><a:${transform.kind}${Object.hasOwn(transform, 'value') ? ` val="${transform.value}"` : ''}/><a:alpha val="50000"/></a:${name}>`
      const zip = await fixture({
        slide: shape(
          2,
          xfrm() +
            rect +
            `<a:solidFill>${xml}</a:solidFill>` +
            `<a:ln w="12700"><a:solidFill>${xml}</a:solidFill></a:ln>` +
            `<a:effectLst><a:outerShdw dist="0" rotWithShape="false">${xml}</a:outerShdw></a:effectLst>`
        ),
      })
      const bytes = await zip.file('ppt/slides/one.xml').async('string')
      const { presentation, admission } = await project(zip)
      const model = presentation.pptxSemantic
      const before = structuredClone(model)
      const target = occurrence(model, '2')
      const color = { ...nativeColor, transforms: [transform, { kind: 'alpha', value: 50000 }] }
      const resolved = materializeGeometry(model, target.id)
      expect(resolved.style.fill.color).toEqual(color)
      expect(resolved.style.stroke.color).toEqual(color)
      expect(resolved.style.effects.effects[0].color).toEqual(color)
      const restored = normalizeSemanticPresentation(JSON.parse(JSON.stringify(presentation)))
      expect(materializeGeometry(restored.pptxSemantic, target.id)).toEqual(resolved)
      const html = renderSlideElements(restored.slides[0], { pptxSemantic: restored.pptxSemantic })
      expect(html).toContain(`fill:#${expected}`)
      expect(html).toContain(`stroke:#${expected}`)
      expect(html).toContain(`flood-color="#${expected}"`)
      expect(html).toContain('fill-opacity="0.5"')
      expect(html).toContain('stroke-opacity="0.5"')
      expect(model).toEqual(before)
      expect(await zip.file('ppt/slides/one.xml').async('string')).toBe(bytes)
      expect(admission.visualQualification).toBe('unqualified')
    }
  )
  it.each(nativeColors)(
    'retains %s through projector, JSON and actual solid/outline/shadow SVG',
    async (tag, nativeColor, expected) => {
      const name = tag.split(' ')[0]
      const xml = `<a:${tag}><a:alpha val="50000"/></a:${name}>`
      const zip = await fixture({
        slide: shape(
          2,
          xfrm() +
            rect +
            `<a:solidFill>${xml}</a:solidFill>` +
            `<a:ln w="12700"><a:solidFill>${xml}</a:solidFill></a:ln>` +
            `<a:effectLst><a:outerShdw dist="0" rotWithShape="false">${xml}</a:outerShdw></a:effectLst>`
        ),
      })
      const bytes = await zip.file('ppt/slides/one.xml').async('string')
      const result = await project(zip)
      const model = result.presentation.pptxSemantic
      const before = structuredClone(model)
      const target = occurrence(model, '2')
      const materialized = materializeGeometry(model, target.id)
      const color = { ...nativeColor, transforms: [{ kind: 'alpha', value: 50000 }] }
      expect(materialized.style.fill.color).toEqual(color)
      expect(materialized.style.stroke.color).toEqual(color)
      expect(materialized.style.effects.effects[0].color).toEqual(color)
      const restored = normalizeSemanticPresentation(
        JSON.parse(JSON.stringify(result.presentation))
      )
      expect(materializeGeometry(restored.pptxSemantic, target.id)).toEqual(materialized)
      const html = renderSlideElements(restored.slides[0], { pptxSemantic: restored.pptxSemantic })
      expect(html).toContain(`fill:#${expected}`)
      expect(html).toContain(`stroke:#${expected}`)
      expect(html).toContain('fill-opacity="0.5"')
      expect(html).toContain('stroke-opacity="0.5"')
      expect(html).toContain(`flood-color="#${expected}"`)
      expect(model).toEqual(before)
      expect(await zip.file('ppt/slides/one.xml').async('string')).toBe(bytes)
      expect(result.admission.visualQualification).toBe('unqualified')
    }
  )
  it.each([
    [
      'scrgbClr r="50000" g="50000" b="50000"',
      { kind: 'scrgb', value: { r: 50000, g: 50000, b: 50000 } },
      '898989',
    ],
    [
      'hslClr hue="7200000" sat="100000" lum="50000"',
      { kind: 'hsl', value: { hue: 7200000, sat: 100000, lum: 50000 } },
      '00BC00',
    ],
    ['prstClr val="cornflowerBlue"', { kind: 'preset', value: 'cornflowerBlue' }, '476CAE'],
  ])('preserves %s palette/reference/phClr transform order', async (tag, nativeColor, expected) => {
    const name = tag.split(' ')[0]
    const zip = await fixture({
      slide: shape(
        2,
        '',
        ph,
        '<p:style><a:fillRef idx="1"><a:schemeClr val="accent1"><a:alpha val="50000"/></a:schemeClr></a:fillRef></p:style>'
      ),
      matrix:
        '<a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"><a:shade val="50000"/></a:schemeClr></a:solidFill></a:fillStyleLst>',
    })
    const theme = await zip.file('ppt/theme/theme.xml').async('string')
    const source = theme.replace(
      '<a:accent2><a:srgbClr val="FF0000"/></a:accent2>',
      `<a:accent2><a:${tag}><a:shade val="100000"/></a:${name}></a:accent2>`
    )
    zip.file('ppt/theme/theme.xml', source)
    const { presentation } = await project(zip)
    const model = presentation.pptxSemantic
    const before = structuredClone(model)
    const target = occurrence(model, '2')
    expect(materializeGeometry(model, target.id).style.fill.color).toEqual({
      ...nativeColor,
      transforms: [
        { kind: 'shade', value: 100000 },
        { kind: 'alpha', value: 50000 },
        { kind: 'shade', value: 50000 },
      ],
    })
    const restored = normalizeSemanticPresentation(JSON.parse(JSON.stringify(presentation)))
    const html = renderSlideElements(restored.slides[0], { pptxSemantic: restored.pptxSemantic })
    expect(html).toContain(`fill:#${expected}`)
    expect(html).toContain('fill-opacity="0.5"')
    expect(model).toEqual(before)
    expect(await zip.file('ppt/theme/theme.xml').async('string')).toBe(source)
  })
})

describe('native layout and master occurrence direction', () => {
  it.each(
    ['layout', 'master'].flatMap((owner) =>
      ['title', 'body', 'ctrTitle', 'subTitle', 'obj', 'dt', 'ftr', 'hdr', 'sldNum'].map((type) => [
        owner,
        type,
      ])
    )
  )(
    'retains unmatched %s %s placeholders as source templates, not slide ink',
    async (owner, type) => {
      const placeholder = shape(3, xfrm() + rect + fill, `<p:ph idx="17" type="${type}"/>`)
      const zip = await fixture({
        slide: shape(2, xfrm() + rect + fill),
        layout: shape(6, xfrm() + rect + fill) + (owner === 'layout' ? placeholder : ''),
        master: shape(5, xfrm() + rect + fill) + (owner === 'master' ? placeholder : ''),
      })
      const partUri =
        owner === 'layout' ? 'ppt/slideLayouts/layout.xml' : 'ppt/slideMasters/master.xml'
      const xmlBefore = await zip.file(partUri).async('string')
      const result = await project(zip)
      const model = result.presentation.pptxSemantic
      const source = Object.values(model.definitions).find(
        (definition) => definition.source.partUri === partUri && definition.source.nativeId === '3'
      )
      expect(source).toBeDefined()
      expect(model.styles[`${source.id}:geometry-declarations`].payload.placeholder.value).toEqual({
        idx: '17',
        type,
      })
      const templates = result.inventory.occurrences.filter(
        (occurrence) => occurrence.definitionId === source.id
      )
      expect(templates).toHaveLength(2)
      for (const occurrence of templates) {
        expect(result.admission.templateOccurrenceIds).toContain(occurrence.id)
        expect(Object.hasOwn(model.instances, occurrence.id)).toBe(false)
      }
      for (const slide of result.presentation.slides) {
        expect(
          semanticRenderTree(model, slide)
            .map(
              (node) =>
                model.definitions[model.instances[node.instanceId].definitionId].source.nativeId
            )
            .sort()
        ).toEqual(['2', '5', '6'])
      }
      const restored = normalizeSemanticPresentation(
        JSON.parse(JSON.stringify(result.presentation))
      )
      expect(JSON.stringify(restored)).toBe(JSON.stringify(result.presentation))
      expect(await zip.file(partUri).async('string')).toBe(xmlBefore)
    }
  )

  it('paints direct slide placeholders and keeps their inherited providers immutable', async () => {
    const zip = await fixture()
    const result = await project(zip)
    const model = result.presentation.pptxSemantic
    const before = JSON.stringify(model)
    for (const slide of result.presentation.slides) {
      const nodes = semanticRenderTree(model, slide)
      expect(
        nodes
          .map(
            (node) =>
              model.definitions[model.instances[node.instanceId].definitionId].source.nativeId
          )
          .sort()
      ).toEqual(['2', '5'])
      const local = nodes.find(
        (node) =>
          model.definitions[model.instances[node.instanceId].definitionId].source.nativeId === '2'
      )
      expect(model.instances[local.instanceId].sourceBinding).toBeDefined()
      expect(materializeGeometry(model, local.instanceId).width).toBe(952500)
    }
    expect(JSON.stringify(model)).toBe(before)
  })

  async function nativeBacklinks() {
    const zip = await fixture()
    const baseline = await buildSemanticInventory(zip)
    zip.file('ppt/slideLayouts/unused.xml', part('sldLayout', shape(900, xfrm() + rect + fill)))
    zip.file(
      'ppt/slideLayouts/_rels/unused.xml.rels',
      rels(relationship('slideMaster', '../slideMasters/master.xml'))
    )
    zip.file(
      'ppt/slideMasters/_rels/master.xml.rels',
      rels(
        relationship('slideLayout', '../slideLayouts/unused.xml', 'unused') +
          relationship('slideLayout', '../slideLayouts/layout.xml', 'selected') +
          relationship('theme', '../theme/theme.xml')
      )
    )
    return { zip, baseline }
  }

  it('inventories native backlinked source without painting unselected layouts or changing selected lineage', async () => {
    const { zip, baseline } = await nativeBacklinks()
    const inventory = await buildSemanticInventory(zip)
    const unused = inventory.definitions.find(
      (entry) => entry.partUri === 'ppt/slideLayouts/unused.xml' && entry.nativeId === '900'
    )
    expect(unused).toMatchObject({ kind: 'shape' })
    expect(inventory.parts.some((entry) => entry.partUri === unused.partUri)).toBe(true)
    expect(inventory.occurrences).toEqual(baseline.occurrences)
    expect(inventory.occurrences.some((entry) => entry.definitionId === unused.id)).toBe(false)
  })

  it('projects actual selected slide-layout-master inheritance in the presence of native catalog backlinks', async () => {
    const { zip } = await nativeBacklinks()
    const masterBefore = await zip.file('ppt/slideMasters/_rels/master.xml.rels').async('string')
    const unusedBefore = await zip.file('ppt/slideLayouts/unused.xml').async('string')
    const result = await project(zip)
    const model = result.presentation.pptxSemantic
    for (const [slideId, expected] of [
      ['first', 'FF0000'],
      ['second', '0000FF'],
    ]) {
      const target = Object.values(model.instances).find(
        (instance) =>
          instance.slideId === slideId &&
          model.definitions[instance.definitionId].source.nativeId === '2'
      )
      expect(materializeGeometry(model, target.id).style.fill.color).toMatchObject({
        kind: 'srgb',
        value: expected,
      })
      expect(
        Object.values(model.instances).some(
          (instance) =>
            model.definitions[instance.definitionId].source.partUri ===
            'ppt/slideLayouts/unused.xml'
        )
      ).toBe(false)
    }
    const restored = normalizeSemanticPresentation(JSON.parse(JSON.stringify(result.presentation)))
    expect(restored.pptxSemantic).toEqual(JSON.parse(JSON.stringify(model)))
    expect(await zip.file('ppt/slideMasters/_rels/master.xml.rels').async('string')).toBe(
      masterBefore
    )
    expect(await zip.file('ppt/slideLayouts/unused.xml').async('string')).toBe(unusedBefore)
  })
})

describe('linked source-native hidden outlines', () => {
  it('imports real typed latent paint without rewriting the source or painting it automatically', async () => {
    const latent =
      '<a:extLst><a:ext uri="{91240B29-F687-4F45-9708-019B960494DF}"><h:hiddenLine xmlns:h="http://schemas.microsoft.com/office/drawing/2010/main" w="12700" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="accent1"><a:shade val="50000"/></a:schemeClr></a:solidFill></h:hiddenLine></a:ext></a:extLst>'
    const zip = await fixture({
      slide: shape(2, xfrm() + rect + '<a:ln w="12700"><a:noFill/></a:ln>' + latent),
    })
    const bytes = await zip.file('ppt/slides/one.xml').async('string')
    const result = await project(zip)
    const model = result.presentation.pptxSemantic
    const instance = Object.values(model.instances).find(
      (entry) => model.definitions[entry.definitionId].source.nativeId === '2'
    )
    const source =
      model.styles[model.definitions[instance.definitionId].content.geometrySource.styleId]
    expect(source.payload.hiddenStroke.value.color.value).toMatchObject({
      kind: 'scheme',
      value: 'accent1',
    })
    expect(materializeGeometry(model, instance.id).style.stroke.color).toEqual({ kind: 'none' })
    expect(
      result.trustedSemanticImportMetadata.styles[
        source.payload.definitionId + ':geometry-declarations'
      ]
    ).toEqual(source)
    expect(
      normalizeSemanticPresentation(JSON.parse(JSON.stringify(result.presentation))).pptxSemantic
    ).toEqual(JSON.parse(JSON.stringify(model)))
    expect(await zip.file('ppt/slides/one.xml').async('string')).toBe(bytes)
    for (const geometryInheritance of [undefined, false])
      await expect(
        projectSemanticImport({ zip, presentation: { slides: slides() }, geometryInheritance })
      ).rejects.toMatchObject({ code: 'PPTX_SEMANTIC_ADMISSION_FAILED' })
  })
})
const definition = (model, nativeId, partUri) =>
  Object.values(model.definitions).find(
    (d) => d.source.nativeId === nativeId && (!partUri || d.source.partUri === partUri)
  )
const occurrence = (model, nativeId, slideId = 'first') =>
  Object.values(model.instances).find(
    (i) => i.slideId === slideId && model.definitions[i.definitionId].source.nativeId === nativeId
  )
describe('source-derived schema two geometry projection', () => {
  it('resolves genuine slide/layout theme override color schemes without rewriting source geometry', async () => {
    const zip = await fixture()
    const slots = [
      'dk1',
      'lt1',
      'dk2',
      'lt2',
      'accent1',
      'accent2',
      'accent3',
      'accent4',
      'accent5',
      'accent6',
      'hlink',
      'folHlink',
    ]
    for (const [owner, target, colors] of [
      [
        'ppt/slideLayouts/layout.xml',
        'layoutOverride.xml',
        { accent2: '118811', accent3: '445566' },
      ],
      ['ppt/slides/one.xml', 'slideOverride.xml', { accent2: 'ABCDEF', accent3: '778899' }],
    ]) {
      const relationshipUri = owner.replace(/([^/]+)$/, '_rels/$1.rels')
      const existing = await zip.file(relationshipUri).async('string')
      zip.file(
        relationshipUri,
        existing.replace(
          '</Relationships>',
          relationship('themeOverride', `../theme/${target}`, 'themeOverride') + '</Relationships>'
        )
      )
      zip.file(
        `ppt/theme/${target}`,
        `<a:themeOverride xmlns:a="${A}"><a:clrScheme name="Authored">${slots
          .map((slot) => `<a:${slot}><a:srgbClr val="${colors[slot] ?? '112233'}"/></a:${slot}>`)
          .join('')}</a:clrScheme></a:themeOverride>`
      )
    }
    const packageMasterBefore = await zip.file('ppt/slideMasters/master.xml').async('string')
    const { presentation, admission } = await project(zip),
      model = presentation.pptxSemantic
    expect(model.schemaVersion).toBe(2)
    for (const [index, expected] of ['#ABCDEF', '#445566'].entries()) {
      const slide = presentation.slides[index],
        instance = occurrence(model, '2', slide.id)
      expect(slide.elements.find((e) => e.id === instance.id).fill).toBe(expected)
      expect(renderSlideElements(slide, { pptxSemantic: model })).toContain(`fill:${expected}`)
      expect(instance.overrides).toEqual({})
    }
    expect(definition(model, '4').content.geometry).not.toHaveProperty('style')
    expect(
      model.styles[definition(model, '4').content.geometrySource.styleId].payload.properties.fill
        .value.color.value
    ).toEqual({ kind: 'scheme', value: 'accent1' })
    expect(await zip.file('ppt/slideMasters/master.xml').async('string')).toBe(packageMasterBefore)
    expect(
      normalizeSemanticPresentation(JSON.parse(JSON.stringify(presentation))).pptxSemantic
    ).toEqual(JSON.parse(JSON.stringify(model)))
    expect(admission.visualQualification).toBe('unqualified')
  })
  it('materializes one immutable master on distinct host maps without painting templates twice', async () => {
    const zip = await fixture(),
      result = await project(zip),
      model = result.presentation.pptxSemantic
    expect(model.schemaVersion).toBe(2)
    const provider = definition(model, '4'),
      local = definition(model, '2', 'ppt/slides/one.xml')
    expect(Object.isFrozen(provider.content.geometry)).toBe(true)
    expect(provider.content.geometry).not.toHaveProperty('style')
    expect(local.content).not.toHaveProperty('geometry')
    expect(local.content).not.toHaveProperty('extent')
    expect(
      model.styles[provider.content.geometrySource.styleId].payload.properties.fill.value.color
        .value
    ).toEqual({ kind: 'scheme', value: 'accent1' })
    const before = JSON.stringify(model)
    for (const [index, color] of ['#FF0000', '#0000FF'].entries()) {
      const slide = result.presentation.slides[index],
        leaf = occurrence(model, '2', slide.id)
      const context = model.styles[leaf.sourceBinding.contextId].payload
      expect(context.geometry).toEqual({
        definitionId: provider.id,
        componentId: provider.content.geometry.componentId,
      })
      expect(leaf.relationshipChain).toEqual([index ? 'ppt/slides/two.xml' : 'ppt/slides/one.xml'])
      expect(
        slide.elements.map(
          (e) => model.definitions[model.instances[e.id].definitionId].source.nativeId
        )
      ).toEqual(['5', '2'])
      expect(slide.elements.find((e) => e.id === leaf.id)).toMatchObject({
        width: 100,
        height: 80,
        fill: color,
      })
      expect(semanticRenderTree(model, slide)).toHaveLength(2)
      expect(renderSlideElements(slide, { pptxSemantic: model })).toContain(`fill:${color}`)
      for (const element of slide.elements) {
        const sourceOccurrence = result.inventory.occurrences.find((o) => o.id === element.id)
        expect(element.zIndex).toBe(sourceOccurrence.paintIndex)
      }
    }
    expect(JSON.stringify(model)).toBe(before)
    expect(result.admission.dispositions).toHaveLength(result.inventory.definitions.length)
    expect(Object.values(model.instances)).toHaveLength(4)
    expect(
      normalizeSemanticPresentation(JSON.parse(JSON.stringify(result.presentation))).pptxSemantic
    ).toEqual(JSON.parse(JSON.stringify(model)))
    expect(result.trustedSemanticImportMetadata).toMatchObject({
      schemaVersion: 2,
      modelVersion: 2,
      definitions: model.definitions,
      styles: model.styles,
    })
    expect(result.trustedSemanticImportMetadata.occurrenceBindings).toEqual(
      Object.fromEntries(Object.values(model.instances).map((i) => [i.id, i.sourceBinding]))
    )
    const trusted = collectTrustedImportMetadata(result.presentation, 'original')
    expect(trusted.projection.modelVersion).toBe(2)
    expect(trusted.projection).not.toHaveProperty('transactionEligible')
    expect(trusted.elements).toEqual([])
    expect(result.admission.visualQualification).toBe('unqualified')
  })
  it('derives occurrence extents without rewriting source dimensions or authored path units', async () => {
    const custom =
      '<a:custGeom><a:pathLst><a:path w="100" h="80" stroke="false" extrusionOk="0"><a:moveTo><a:pt x="0" y="0"/></a:moveTo><a:lnTo><a:pt x="w" y="h"/></a:lnTo></a:path></a:pathLst></a:custGeom>'
    const zip = await fixture({
      slide: (name) => shape(2, xfrm(name === 'one' ? 0 : 1905000), ph),
      master: shape(4, xfrm() + custom + fill, ph),
    })
    const { presentation } = await project(zip),
      model = presentation.pptxSemantic
    const geometry = definition(model, '4').content.geometry,
      first = occurrence(model, '2')
    expect(geometry).toMatchObject({ width: 952500, height: 762000 })
    expect(geometry.paths[0]).toMatchObject({
      width: 100,
      height: 80,
      stroke: false,
      extrusionOk: false,
    })
    expect(geometry.paths[0].commands[1].points[0]).toMatchObject({ x: 'w', y: 'h' })
    expect(
      definition(model, '4').components.some(
        (c) => c.id === geometry.paths[0].commands[1].points[0].componentId
      )
    ).toBe(true)
    expect(resolveGeometryTransform(model, first.id).transform).toMatchObject({
      rot: 0,
      flipH: false,
      ext: { cx: 0, cy: 762000 },
    })
    expect(materializeGeometry(model, first.id).width).toBe(0)
    expect(materializeGeometry(model, occurrence(model, '2', 'second').id).width).toBe(1905000)
    expect(presentation.slides[0].elements[0].width).toBe(0)
  })
  it('composes scheme/phClr matrix paints and retains native zero, false, ordered transforms and locators', async () => {
    const style =
      '<p:style><a:fillRef idx="1001"><a:schemeClr val="accent1"><a:tint val="0"/></a:schemeClr></a:fillRef><a:lnRef idx="1"><a:schemeClr val="accent1"/></a:lnRef><a:effectRef idx="1"><a:schemeClr val="accent1"/></a:effectRef></p:style>'
    const matrix =
      '<a:fillStyleLst><a:pattFill prst="pct5"/></a:fillStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"><a:shade val="50000"/><a:alpha val="0"/></a:schemeClr></a:solidFill></a:bgFillStyleLst><a:lnStyleLst><a:ln w="0"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst><a:outerShdw dist="0" rotWithShape="false"><a:schemeClr val="phClr"/></a:outerShdw></a:effectLst></a:effectStyle></a:effectStyleLst>'
    const { presentation } = await project(
      await fixture({ slide: shape(2, '', ph, style), matrix })
    )
    const model = presentation.pptxSemantic,
      first = occurrence(model, '2')
    const paint = materializeGeometry(model, first.id).style
    expect(paint.fill.color).toEqual({
      kind: 'srgb',
      value: 'FF0000',
      transforms: [
        { kind: 'tint', value: 0 },
        { kind: 'shade', value: 50000 },
        { kind: 'alpha', value: 0 },
      ],
    })
    expect(paint.stroke.width).toBe(0)
    expect(paint.effects.effects[0]).toMatchObject({ dist: 0, rotWithShape: false })
    const context = model.styles[first.sourceBinding.contextId].payload
    const entry = model.styles[context.themeId].payload.backgroundFillStyles[0]
    expect(entry.source.partUri).toBe('ppt/theme/theme.xml')
    expect(entry.value.color.value.value).toBe('phClr')
    expect(context.matrixBindings.fillRef.source).toEqual(entry.source)
  })
  it('preserves a local structural geometry extent while inheriting only missing transform fields', async () => {
    const local = '<a:xfrm flipV="true"><a:ext cx="1905000" cy="381000"/></a:xfrm>'
    const { presentation } = await project(
      await fixture({
        slide: shape(
          2,
          local + rect + '<a:noFill/><a:ln w="0"><a:noFill/></a:ln><a:effectLst/>',
          ph
        ),
      })
    )
    const model = presentation.pptxSemantic,
      first = occurrence(model, '2')
    const own = model.definitions[first.definitionId]
    expect(own.content.geometry).toMatchObject({ width: 1905000, height: 381000 })
    expect(own.content.geometry).not.toHaveProperty('style')
    const resolved = resolveGeometryTransform(model, first.id)
    expect(resolved.transform).toMatchObject({
      off: { x: 0, y: -9525 },
      ext: { cx: 1905000, cy: 381000 },
      flipH: false,
      flipV: true,
    })
    expect(resolved.properties.off.source.partUri).toBe('ppt/slideMasters/master.xml')
    expect(resolved.properties.ext.source.partUri).toBe('ppt/slides/one.xml')
    expect(materializeGeometry(model, first.id).style).toEqual({
      fill: { color: { kind: 'none' } },
      stroke: { color: { kind: 'none' }, width: 0 },
      effects: { kind: 'list', effects: [] },
    })
    expect(first.localTransform[3]).toBe(-1)
  })
  it('binds master connector native targets to their visible slide substitution without changing source identities', async () => {
    const connector = `<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="6"/><p:cNvCxnSpPr><a:stCxn id="4" idx="0"/></p:cNvCxnSpPr><p:nvPr/></p:nvCxnSpPr><p:spPr>${xfrm()}<a:prstGeom prst="straightConnector1"><a:avLst/></a:prstGeom><a:noFill/><a:ln w="9525"><a:solidFill><a:srgbClr val="123456"/></a:solidFill></a:ln></p:spPr></p:cxnSp>`
    const { presentation } = await project(
      await fixture({ master: connector + shape(4, xfrm() + rect + fill, ph) })
    )
    const model = presentation.pptxSemantic,
      line = occurrence(model, '6'),
      target = occurrence(model, '2')
    expect(line.connectorBindings.start).toEqual({ targetInstanceId: target.id, index: 0 })
    expect(line.relationshipChain).toEqual(['ppt/slides/one.xml', 'edge', 'edge'])
    expect(target.relationshipChain).toEqual(['ppt/slides/one.xml'])
    expect(definition(model, '6').content.geometry.connector.start).toMatchObject({
      shapeId: '4',
      targetDefinitionId: definition(model, '4').id,
      index: 0,
    })
    expect(
      semanticRenderTree(model, presentation.slides[0]).find((n) => n.instanceId === line.id)
        .element.pptxGeometry.connector
    ).toEqual(definition(model, '6').content.geometry.connector)
  })
  it.each([
    ['ambiguous placeholder', { layout: shape(3, '', ph) + shape(8, '', ph) }],
    [
      'selected unsupported matrix',
      {
        slide: shape(
          2,
          '',
          ph,
          '<p:style><a:fillRef idx="1"><a:srgbClr val="123456"/></a:fillRef></p:style>'
        ),
        matrix: '<a:fillStyleLst><a:blipFill/></a:fillStyleLst>',
      },
    ],
  ])('rejects %s atomically', async (_, options) => {
    const zip = await fixture(options),
      presentation = { slides: slides() },
      before = structuredClone(presentation)
    await expect(
      projectSemanticImport({ zip, presentation, geometryInheritance: true })
    ).rejects.toMatchObject({ code: 'PPTX_SEMANTIC_ADMISSION_FAILED' })
    expect(presentation).toEqual(before)
  })
  it('rejects recursive relationship and palette sources without a supported fallback', async () => {
    const zip = await fixture()
    zip.file(
      'ppt/slides/_rels/one.xml.rels',
      rels(relationship('slideLayout', '../slides/one.xml'))
    )
    await expect(project(zip)).rejects.toThrow()
    const recursive = await fixture()
    recursive.file(
      'ppt/theme/theme.xml',
      `<a:theme xmlns:a="${A}"><a:themeElements><a:clrScheme name="cycle"><a:accent1><a:schemeClr val="accent1"/></a:accent1></a:clrScheme></a:themeElements></a:theme>`
    )
    await expect(project(recursive)).rejects.toMatchObject({
      code: 'PPTX_SEMANTIC_ADMISSION_FAILED',
    })
  })
  it('keeps the default and explicit false selector on unchanged schema one behavior', async () => {
    const zip = await fixture({
      slide: shape(2, xfrm() + rect + '<a:noFill/>'),
      layout: '',
      master: '',
    })
    const args = { zip, presentation: { slides: slides() } }
    const old = await projectSemanticImport(args),
      explicit = await projectSemanticImport({ ...args, geometryInheritance: false })
    expect(old).toEqual(explicit)
    expect(old.presentation.pptxSemantic.schemaVersion).toBe(1)
    expect(old.presentation.pptxSemantic.styles).toEqual({})
    expect(old.trustedSemanticImportMetadata.schemaVersion).toBe(1)
  })
  it.each([
    ['preset', rect],
    [
      'custom',
      '<a:custGeom><a:gdLst><a:gd name="half" fmla="*/ w 1 2"/></a:gdLst><a:cxnLst><a:cxn ang="cd4"><a:pos x="half" y="h"/></a:cxn></a:cxnLst><a:pathLst><a:path w="100" h="80" stroke="false" extrusionOk="0"><a:moveTo><a:pt x="0000" y="+0"/></a:moveTo><a:lnTo><a:pt x="half" y="h"/></a:lnTo></a:path></a:pathLst></a:custGeom>',
    ],
  ])(
    'emits one immutable extent-less %s source template for two genuine hosts',
    async (kind, authoredGeometry) => {
      const zip = await fixture({
        slide: (name) => shape(2, xfrm(name === 'one' ? 952500 : 1905000), ph),
        layout: shape(3, authoredGeometry, ph),
      })
      const inventory = await buildSemanticInventory(zip),
        source = await buildGeometryStyleSources(zip, inventory)
      const contexts = Object.values(source.styles).filter(
        (s) => s.kind === 'geometry-context' && s.payload.definitionId.includes('shape:2')
      )
      expect(contexts).toHaveLength(2)
      const provider = inventory.definitions.find((d) => d.nativeId === '3')
      expect(contexts.every((c) => c.payload.geometry.definitionId === provider.id)).toBe(true)
      expect(
        contexts.map(
          (c) =>
            source.styles[c.payload.transformDeclarationIds[0]].payload.transform.value.ext.value.cx
              .value
        )
      ).toEqual([952500, 1905000])
      expect(
        source.styles[source.definitionBindings[provider.id].styleId].payload
      ).not.toHaveProperty('transform')
      const node = parseXml(authoredGeometry.replace('>', ` xmlns:a="${A}">`))[0]
      expect(() =>
        readGeometrySource(node, { componentId: contexts[0].payload.geometry.componentId })
      ).toThrow()
      const { presentation } = await project(zip),
        model = presentation.pptxSemantic
      const retained = definition(model, '3'),
        geometry = retained.content.geometry
      expect(geometry).toMatchObject({
        schemaVersion: 2,
        kind,
        componentId: contexts[0].payload.geometry.componentId,
      })
      expect(Object.isFrozen(geometry)).toBe(true)
      for (const field of ['width', 'height', 'style']) expect(geometry).not.toHaveProperty(field)
      expect(retained.content).not.toHaveProperty('extent')
      expect(retained.source).toMatchObject({
        partUri: provider.partUri,
        preconditionHash: provider.preconditionHash,
      })
      expect(
        Object.values(model.definitions).filter((d) => d.content.geometry?.schemaVersion === 2)
      ).toHaveLength(1)
      const before = JSON.stringify(model)
      const materialized = ['first', 'second'].map((slideId) => {
        const leaf = occurrence(model, '2', slideId)
        expect(model.styles[leaf.sourceBinding.contextId].payload.geometry).toEqual({
          definitionId: retained.id,
          componentId: geometry.componentId,
        })
        return materializeGeometry(model, leaf.id)
      })
      expect(materialized.map((g) => g.width)).toEqual([952500, 1905000])
      expect(
        materialized.every((g) => g.schemaVersion === 1 && g.componentId === geometry.componentId)
      ).toBe(true)
      if (kind === 'custom') {
        expect(geometry.guides[0].formula).toBe('*/ w 1 2')
        expect(geometry.paths[0]).toMatchObject({
          width: 100,
          height: 80,
          stroke: false,
          extrusionOk: false,
        })
        expect(geometry.paths[0].commands[0].points[0]).toMatchObject({ x: '0000', y: '+0' })
        expect(
          retained.components.some(
            (c) => c.id === geometry.paths[0].commands[1].points[0].componentId
          )
        ).toBe(true)
        expect(materialized.map((g) => evaluateGeometryGuides(g).half)).toEqual([476250, 952500])
        expect(materialized.map((g) => deriveGeometryPaths(g).connections[0].position.x)).toEqual([
          476250, 952500,
        ])
      } else {
        expect(materialized.map((g) => deriveGeometryPaths(g).textRect.r)).toEqual([
          952500, 1905000,
        ])
      }
      const reloaded = normalizeSemanticPresentation(JSON.parse(JSON.stringify(presentation)))
      expect(reloaded.pptxSemantic).toEqual(JSON.parse(before))
      expect(definition(reloaded.pptxSemantic, '3').content.geometry).toEqual(geometry)
      expect(definition(reloaded.pptxSemantic, '3').source.preconditionHash).toBe(
        provider.preconditionHash
      )
      expect(JSON.stringify(model)).toBe(before)
      for (const geometryInheritance of [undefined, false]) {
        await expect(
          projectSemanticImport({ zip, presentation: { slides: slides() }, geometryInheritance })
        ).rejects.toThrow()
      }
    }
  )
})
