import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import JSZip from 'jszip'
const require = createRequire(import.meta.url)
const { projectSemanticImport } = require('../../server/services/pptx-import/semantic-projector')
const { normalizeSemanticPresentation } = require('../../shared/src/pptx-semantic-presentation')
const { renderSlideElements } = require('../../shared/src/element-renderers')
const { semanticRenderTree } = require('../../shared/src/pptx-semantic-render-tree')
const {
  deriveConnectorGeometry,
  connectorEndpointLocators,
} = require('../../shared/src/pptx-semantic-connectors')
const {
  applyPresentationProjectionOperation,
} = require('../../shared/src/pptx-projection-operation')
const { getProjectionCapabilities } = require('../../shared/src/pptx-projection-capabilities')
const { materializeGeometry } = require('../../shared/src/pptx-geometry-style-resolution')
const {
  createPresentationSchema,
  updatePresentationSchema,
} = require('../../server/middleware/schemas')
const {
  collectTrustedImportMetadata,
} = require('../../server/services/pptx-import/trusted-import-metadata')
const P = 'http://schemas.openxmlformats.org/presentationml/2006/main'
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const straightConnector = (locks = '') =>
  `<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="4" name="Connector"/><p:cNvCxnSpPr>${locks}<a:stCxn id="2" idx="0"/><a:endCxn id="3" idx="0"/></p:cNvCxnSpPr><p:nvPr/></p:nvCxnSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="952500" cy="762000"/></a:xfrm><a:prstGeom prst="straightConnector1"><a:avLst/></a:prstGeom><a:noFill/><a:ln w="38100"><a:solidFill><a:srgbClr val="2468AC"/></a:solidFill></a:ln></p:spPr></p:cxnSp>`
const custom = `<a:custGeom><a:avLst><a:gd name="adj" fmla="val 25000"/></a:avLst>
  <a:gdLst><a:gd name="tip" fmla="*/ w adj 100000"/></a:gdLst>
  <a:ahLst><a:ahXY gdRefX="adj" minX="0" maxX="100000"><a:pos x="tip" y="0"/></a:ahXY></a:ahLst>
  <a:cxnLst><a:cxn ang="0"><a:pos x="w" y="h"/></a:cxn></a:cxnLst>
  <a:rect l="0" t="0" r="w" b="h"/>
  <a:pathLst><a:path w="100" h="80"><a:moveTo><a:pt x="0" y="0"/></a:moveTo>
  <a:cubicBezTo><a:pt x="tip" y="20"/><a:pt x="60" y="50"/><a:pt x="100" y="80"/></a:cubicBezTo>
  <a:close/></a:path></a:pathLst></a:custGeom>`
const shape = (
  id,
  geometry = custom,
  extent = { cx: 952500, cy: 762000 },
  properties = ''
) => `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Geometry"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
  <p:spPr><a:xfrm flipH="1"><a:off x="-9525" y="19050"/><a:ext cx="${extent.cx}" cy="${extent.cy}"/></a:xfrm>
  ${geometry}<a:solidFill><a:srgbClr val="123456"/></a:solidFill>${properties}</p:spPr></p:sp>`
async function imported(
  geometry = custom,
  extent,
  properties,
  graphics = shape(2, geometry, extent, properties),
  geometryInheritance = false
) {
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
  zip.file(
    'ppt/slides/slide7.xml',
    `<p:sld xmlns:p="${P}" xmlns:a="${A}"><p:cSld><p:spTree>${graphics}</p:spTree></p:cSld></p:sld>`
  )
  const result = await projectSemanticImport({
    zip,
    geometryInheritance,
    presentation: { title: 'Geometry', slides: [{ id: 's1', elements: [] }] },
  })
  return result.presentation
}
describe('canonical geometry actual import projection', () => {
  it.each([false, true])(
    'imports color-free native blur through the projector (linked=%s)',
    async (geometryInheritance) => {
      for (const [attributes, effect] of [
        ['', { kind: 'blur' }],
        ['rad="0"', { kind: 'blur', rad: 0 }],
        ['grow="0"', { kind: 'blur', grow: false }],
        ['grow="true"', { kind: 'blur', grow: true }],
        ['rad="285750" grow="false"', { kind: 'blur', rad: 285750, grow: false }],
      ]) {
        const presentation = await imported(
          custom,
          undefined,
          `<a:effectLst><a:blur ${attributes}/></a:effectLst>`,
          undefined,
          geometryInheritance
        )
        const instance = Object.values(presentation.pptxSemantic.instances)[0]
        const expected = { kind: 'list', effects: [effect] }
        expect(materializeGeometry(presentation.pptxSemantic, instance.id).style.effects).toEqual(
          expected
        )
        const reopened = normalizeSemanticPresentation(JSON.parse(JSON.stringify(presentation)))
        expect(materializeGeometry(reopened.pptxSemantic, instance.id).style.effects).toEqual(
          expected
        )
        if (effect.rad > 0)
          expect(
            renderSlideElements(reopened.slides[0], { pptxSemantic: reopened.pptxSemantic })
          ).toContain('pptx-blur-')
      }
    }
  )
  it.each([
    '<a:blur rad=""/>',
    '<a:blur grow=""/>',
    '<a:blur grow="yes"/>',
    '<a:blur rad="-1"/>',
    '<a:blur rad="1.5"/>',
    '<a:blur rad="27273042316901"/>',
    '<a:blur rad="1" rad="2"/>',
    '<a:blur grow="false" color="123456"/>',
    '<a:blur><a:srgbClr val="123456"/></a:blur>',
    '<a:blur>lost</a:blur>',
  ])('rejects malformed direct blur source: %s', async (xml) => {
    await expect(
      imported(custom, undefined, `<a:effectLst>${xml}</a:effectLst>`)
    ).rejects.toMatchObject({ code: 'PPTX_SEMANTIC_ADMISSION_FAILED' })
  })
  it.each([false, true])(
    'imports native glow through the projector with linked style=%s',
    async (geometryInheritance) => {
      const presentation = await imported(
        custom,
        undefined,
        '<a:effectLst><a:glow rad="285750"><a:srgbClr val="2468AC"><a:alpha val="50000"/></a:srgbClr></a:glow></a:effectLst>',
        undefined,
        geometryInheritance
      )
      const before = structuredClone(presentation.pptxSemantic)
      const instance = Object.values(presentation.pptxSemantic.instances)[0]
      const expected = {
        kind: 'list',
        effects: [
          {
            kind: 'glow',
            rad: 285750,
            color: {
              kind: 'srgb',
              value: '2468AC',
              transforms: [{ kind: 'alpha', value: 50000 }],
            },
          },
        ],
      }
      expect(materializeGeometry(presentation.pptxSemantic, instance.id).style.effects).toEqual(
        expected
      )
      const reopened = normalizeSemanticPresentation(JSON.parse(JSON.stringify(presentation)))
      expect(materializeGeometry(reopened.pptxSemantic, instance.id).style.effects).toEqual(
        expected
      )
      expect(
        renderSlideElements(reopened.slides[0], { pptxSemantic: reopened.pptxSemantic })
      ).toContain('pptx-glow-')
      expect(presentation.pptxSemantic).toEqual(before)
    }
  )
  it.each([
    '<a:glow rad="-1"><a:srgbClr val="123456"/></a:glow>',
    '<a:glow rad="27273042316901"><a:srgbClr val="123456"/></a:glow>',
    '<a:glow dist="1"><a:srgbClr val="123456"/></a:glow>',
    '<a:glow rad="1" rad="2"><a:srgbClr val="123456"/></a:glow>',
    '<a:glow>lost<a:srgbClr val="123456"/></a:glow>',
    '<a:glow><a:srgbClr val="123456"/><a:srgbClr val="654321"/></a:glow>',
  ])('rejects malformed direct glow source: %s', async (xml) => {
    await expect(
      imported(custom, undefined, `<a:effectLst>${xml}</a:effectLst>`)
    ).rejects.toMatchObject({ code: 'PPTX_SEMANTIC_ADMISSION_FAILED' })
  })
  it.each([false, true])(
    'imports native inner shadow through the projector with linked style=%s',
    async (geometryInheritance) => {
      const presentation = await imported(
        custom,
        undefined,
        '<a:effectLst><a:innerShdw blurRad="28575" dist="152400" dir="2700000"><a:srgbClr val="2468AC"><a:alpha val="50000"/></a:srgbClr></a:innerShdw></a:effectLst>',
        undefined,
        geometryInheritance
      )
      const before = structuredClone(presentation.pptxSemantic)
      const instance = Object.values(presentation.pptxSemantic.instances)[0]
      const effects = materializeGeometry(presentation.pptxSemantic, instance.id).style.effects
      expect(effects).toEqual({
        kind: 'list',
        effects: [
          {
            kind: 'innerShdw',
            blurRad: 28575,
            dist: 152400,
            dir: 2700000,
            color: {
              kind: 'srgb',
              value: '2468AC',
              transforms: [{ kind: 'alpha', value: 50000 }],
            },
          },
        ],
      })
      const reopened = normalizeSemanticPresentation(JSON.parse(JSON.stringify(presentation)))
      expect(materializeGeometry(reopened.pptxSemantic, instance.id).style.effects).toEqual(effects)
      expect(
        renderSlideElements(reopened.slides[0], { pptxSemantic: reopened.pptxSemantic })
      ).toContain('operator="atop"')
      expect(presentation.pptxSemantic).toEqual(before)
    }
  )
  it.each([
    '<a:innerShdw blurRad="-1"><a:srgbClr val="123456"/></a:innerShdw>',
    '<a:innerShdw dist="27273042316901"><a:srgbClr val="123456"/></a:innerShdw>',
    '<a:innerShdw dir="21600000"><a:srgbClr val="123456"/></a:innerShdw>',
    '<a:innerShdw sx="100000"><a:srgbClr val="123456"/></a:innerShdw>',
    '<a:innerShdw rotWithShape="0"><a:srgbClr val="123456"/></a:innerShdw>',
    '<a:innerShdw dist="1" dist="2"><a:srgbClr val="123456"/></a:innerShdw>',
    '<a:innerShdw>lost<a:srgbClr val="123456"/></a:innerShdw>',
    '<a:innerShdw><a:srgbClr val="123456"/><a:srgbClr val="654321"/></a:innerShdw>',
  ])('rejects malformed direct inner-shadow source: %s', async (xml) => {
    await expect(
      imported(custom, undefined, `<a:effectLst>${xml}</a:effectLst>`)
    ).rejects.toMatchObject({ code: 'PPTX_SEMANTIC_ADMISSION_FAILED' })
  })
  it('imports ordered outline RGB transforms and paints alpha on native stroke and line ends', async () => {
    const result = await imported(
      custom.replace('<a:close/>', ''),
      undefined,
      '<a:ln w="38100"><a:solidFill><a:srgbClr val="2468AC"><a:tint val="50000"/><a:alpha val="50000"/><a:alphaMod val="50000"/></a:srgbClr></a:solidFill><a:tailEnd type="triangle"/></a:ln>'
    )
    const definition = Object.values(result.pptxSemantic.definitions).find(
      (entry) => entry.kind === 'shape'
    )
    expect(definition.content.geometry.style.stroke.color).toEqual({
      kind: 'srgb',
      value: '2468AC',
      transforms: [
        { kind: 'tint', value: 50000 },
        { kind: 'alpha', value: 50000 },
        { kind: 'alphaMod', value: 50000 },
      ],
    })
    const html = renderSlideElements(result.slides[0], { pptxSemantic: result.pptxSemantic })
    expect(html).toContain('stroke:#BDC7DB')
    expect(html).toContain('stroke-opacity="0.25"')
    expect(html.match(/<g data-pptx-line-end="tailEnd"[^>]*>/)?.[0]).toContain('opacity="0.25"')
    expect(result.slides[0].elements[0]).toMatchObject({
      stroke: '#BDC7DB',
      strokeWidth: 4,
      strokeOpacity: 0.25,
    })
    const before = structuredClone(result.pptxSemantic.definitions)
    const instance = Object.values(result.pptxSemantic.instances)[0]
    const changed = applyPresentationProjectionOperation(result, {
      type: 'geometry.edit',
      instanceId: instance.id,
      componentId: definition.content.geometry.componentId,
      command: { type: 'stroke-cap', cap: 'rnd' },
    })
    expect(changed.pptxSemantic.definitions).toEqual(before)
    expect(
      semanticRenderTree(changed.pptxSemantic, changed.slides[0])[0].element.pptxGeometry.style
        .stroke.color
    ).toEqual(definition.content.geometry.style.stroke.color)
  })
  it.each([
    '<a:alpha val="100001"/>',
    '<a:tint val="50000" extra="1"/>',
    '<a:alpha val="50000">unexpected</a:alpha>',
    '<a:unknown val="50000"/>',
  ])('rejects malformed outline color transforms %s', async (transform) => {
    await expect(
      imported(
        custom,
        undefined,
        `<a:ln w="38100"><a:solidFill><a:srgbClr val="2468AC">${transform}</a:srgbClr></a:solidFill></a:ln>`
      )
    ).rejects.toMatchObject({ code: 'PPTX_SEMANTIC_ADMISSION_FAILED' })
  })
  it.each([undefined, 38100])(
    'preserves explicit noFill outline and authored width %s',
    async (width) => {
      const outline = `<a:ln${width === undefined ? '' : ` w="${width}"`}><a:noFill/></a:ln>`
      const result = await imported(custom, undefined, outline)
      const definition = Object.values(result.pptxSemantic.definitions).find(
        (entry) => entry.kind === 'shape'
      )
      expect(definition.content.geometry.style.stroke).toEqual({
        color: { kind: 'none' },
        ...(width === undefined ? {} : { width }),
      })
      expect(Object.hasOwn(definition.content.geometry.style.stroke, 'width')).toBe(
        width !== undefined
      )
      expect(
        renderSlideElements(result.slides[0], { pptxSemantic: result.pptxSemantic })
      ).toContain('stroke:none;')
    }
  )
  it('preserves an explicit empty native effect list as no effects', async () => {
    const result = await imported(custom, undefined, '<a:effectLst/>')
    const definition = Object.values(result.pptxSemantic.definitions).find(
      (entry) => entry.kind === 'shape'
    )
    expect(definition.content.geometry.style.effects).toEqual({ kind: 'list', effects: [] })
    expect(
      renderSlideElements(result.slides[0], { pptxSemantic: result.pptxSemantic })
    ).not.toContain('<filter')
  })
  it('renders an outer shadow from one combined geometry alpha mask behind unchanged ink', async () => {
    const result = await imported(
      custom.replace('<a:close/>', ''),
      undefined,
      '<a:ln w="38100"><a:solidFill><a:srgbClr val="2468AC"/></a:solidFill><a:headEnd type="triangle"/></a:ln><a:effectLst><a:outerShdw blurRad="38100" dist="152400" dir="0"><a:srgbClr val="000000"><a:alpha val="50000"/></a:srgbClr></a:outerShdw></a:effectLst>'
    )
    const html = renderSlideElements(result.slides[0], { pptxSemantic: result.pptxSemantic })
    expect(html.match(/<filter\b/g)).toHaveLength(1)
    expect(html).toContain('filterUnits="userSpaceOnUse"')
    expect(html).toContain('data-pptx-geometry-shadow=')
    expect(html).toContain('in="SourceAlpha"')
    expect(html).toContain('data-pptx-line-end="headEnd"')
    expect(html).toContain('fill:#123456')
    expect(html).toContain('stroke:#2468AC')
    expect(html).not.toContain('<image')
    expect(html).not.toContain('data:image')
  })
  it('anchors a scaled center shadow at the midpoint, not the right edge', async () => {
    const result = await imported(
      custom,
      undefined,
      '<a:effectLst><a:outerShdw sx="50000" sy="125000" algn="ctr"><a:srgbClr val="000000"/></a:outerShdw></a:effectLst>'
    )
    const html = renderSlideElements(result.slides[0], { pptxSemantic: result.pptxSemantic })
    const matrix = html
      .match(/<g filter="[^"]+"><g transform="matrix\(([^"]+)\)"/)?.[1]
      .split(' ')
      .map(Number)
    expect(matrix).toEqual([0.5, 0, 0, 1.25, 25, -10])
  })
  it.each([
    ['', {}],
    [
      'blurRad="38100" dist="152400" dir="5400000" sx="100000" sy="100000" kx="0" ky="0" algn="ctr" rotWithShape="false"',
      {
        blurRad: 38100,
        dist: 152400,
        dir: 5400000,
        sx: 100000,
        sy: 100000,
        kx: 0,
        ky: 0,
        algn: 'ctr',
        rotWithShape: false,
      },
    ],
    [
      'blurRad="0" dist="0" dir="0" sx="-50000" sy="125000" kx="1200000" ky="-600000" algn="br" rotWithShape="1"',
      {
        blurRad: 0,
        dist: 0,
        dir: 0,
        sx: -50000,
        sy: 125000,
        kx: 1200000,
        ky: -600000,
        algn: 'br',
        rotWithShape: true,
      },
    ],
  ])(
    'preserves authored outer-shadow attributes and ordered paint: %s',
    async (attributes, expected) => {
      const result = await imported(
        custom,
        undefined,
        `<a:effectLst><a:outerShdw ${attributes}><a:srgbClr val="2468AC"><a:tint val="50000"/><a:alpha val="50000"/><a:alphaMod val="75000"/></a:srgbClr></a:outerShdw></a:effectLst>`
      )
      const definition = Object.values(result.pptxSemantic.definitions).find(
        (entry) => entry.kind === 'shape'
      )
      expect(definition.content.geometry.style.effects).toEqual({
        kind: 'list',
        effects: [
          {
            kind: 'outerShdw',
            color: {
              kind: 'srgb',
              value: '2468AC',
              transforms: [
                { kind: 'tint', value: 50000 },
                { kind: 'alpha', value: 50000 },
                { kind: 'alphaMod', value: 75000 },
              ],
            },
            ...expected,
          },
        ],
      })
      expect(
        normalizeSemanticPresentation(JSON.parse(JSON.stringify(result))).pptxSemantic
      ).toEqual(JSON.parse(JSON.stringify(result.pptxSemantic)))
    }
  )
  it.each([
    '<a:outerShdw/>',
    '<a:outerShdw><a:schemeClr val="accent1"/></a:outerShdw>',
    '<a:outerShdw blurRad="-1"><a:srgbClr val="123456"/></a:outerShdw>',
    '<a:outerShdw dist="27273042316901"><a:srgbClr val="123456"/></a:outerShdw>',
    '<a:outerShdw dir="21600000"><a:srgbClr val="123456"/></a:outerShdw>',
    '<a:outerShdw sx="2147483648"><a:srgbClr val="123456"/></a:outerShdw>',
    '<a:outerShdw kx="5400000"><a:srgbClr val="123456"/></a:outerShdw>',
    '<a:outerShdw algn="center"><a:srgbClr val="123456"/></a:outerShdw>',
    '<a:outerShdw rotWithShape="yes"><a:srgbClr val="123456"/></a:outerShdw>',
    '<a:outerShdw dist="1" dist="2"><a:srgbClr val="123456"/></a:outerShdw>',
    '<a:outerShdw a:dist="1"><a:srgbClr val="123456"/></a:outerShdw>',
    '<a:outerShdw unknown="1"><a:srgbClr val="123456"/></a:outerShdw>',
    '<a:outerShdw><a:srgbClr val="123456"/><a:srgbClr val="654321"/></a:outerShdw>',
    '<a:outerShdw><a:srgbClr val="123456"/><a:extLst/></a:outerShdw>',
    '<a:outerShdw>text<a:srgbClr val="123456"/></a:outerShdw>',
    '<a:outerShdw><a:srgbClr val="123456"/></a:outerShdw><a:outerShdw><a:srgbClr val="123456"/></a:outerShdw>',
  ])('rejects unsupported or malformed outer-shadow source: %s', async (xml) => {
    await expect(imported(custom, undefined, `<a:effectLst>${xml}</a:effectLst>`)).rejects.toThrow()
  })
  it.each([
    null,
    false,
    { kind: 'list' },
    { kind: 'list', effects: null },
    { kind: 'list', effects: [{ kind: 'outerShdw' }] },
    {
      kind: 'list',
      effects: [
        { kind: 'innerShdw', color: { kind: 'srgb', value: '123456' }, rotWithShape: false },
      ],
    },
    ...[
      { blurRad: -1 },
      { blurRad: 27273042316901 },
      { dist: 0.5 },
      { dir: 21600000 },
      { sx: 2147483648 },
      { sy: -2147483649 },
      { kx: 5400000 },
      { ky: -5400000 },
      { algn: 'center' },
      { rotWithShape: 'false' },
      { unknown: 1 },
    ].map((attrs) => ({
      kind: 'list',
      effects: [{ kind: 'outerShdw', color: { kind: 'srgb', value: '123456' }, ...attrs }],
    })),
  ])('rejects malformed canonical effects at save admission: %j', async (effects) => {
    const result = structuredClone(await imported())
    const definition = Object.values(result.pptxSemantic.definitions).find(
      (entry) => entry.kind === 'shape'
    )
    definition.content.geometry.style.effects = effects
    expect(() => normalizeSemanticPresentation(result)).toThrow()
  })
  it('imports exact native linear gradient angle, scaling and ordered repeated stops', async () => {
    const stops = [
      { pos: 0, color: { kind: 'srgb', value: 'FF0000' } },
      { pos: 50000, color: { kind: 'srgb', value: '00FF00' } },
      { pos: 50000, color: { kind: 'srgb', value: '0000FF' } },
      { pos: 100000, color: { kind: 'srgb', value: '0000FF' } },
    ]
    const fill = `<a:gradFill rotWithShape="1"><a:gsLst>${stops
      .map((stop) => `<a:gs pos="${stop.pos}"><a:srgbClr val="${stop.color.value}"/></a:gs>`)
      .join('')}</a:gsLst><a:lin ang="2700000" scaled="0"/></a:gradFill>`
    const result = await imported(
      custom,
      undefined,
      undefined,
      shape(2, custom).replace('<a:solidFill><a:srgbClr val="123456"/></a:solidFill>', fill)
    )
    const definition = Object.values(result.pptxSemantic.definitions).find(
      (entry) => entry.kind === 'shape'
    )
    expect(definition.content.geometry.style.fill).toEqual({
      gradient: { kind: 'linear', angle: 2700000, scaled: false, rotWithShape: true, stops },
    })
    const html = renderSlideElements(result.slides[0], { pptxSemantic: result.pptxSemantic })
    expect(
      [...html.matchAll(/<stop\b[^>]*offset="([^"]+)"/g)].map((match) => Number(match[1]))
    ).toEqual([0, 0.5, 0.5, 1])
    expect(normalizeSemanticPresentation(JSON.parse(JSON.stringify(result))).pptxSemantic).toEqual(
      JSON.parse(JSON.stringify(result.pptxSemantic))
    )
  })
  it.each(
    ['circle', 'rect', 'shape', undefined].flatMap((path) =>
      [false, true].map((geometryInheritance) => ({ path, geometryInheritance }))
    )
  )(
    'imports typed $path gradient with geometryInheritance=$geometryInheritance',
    async ({ path, geometryInheritance }) => {
      const fill = `<a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:srgbClr val="F01E3C"/></a:gs><a:gs pos="100000"><a:srgbClr val="1E50F0"/></a:gs></a:gsLst><a:path${path === undefined ? '' : ` path="${path}"`}><a:fillToRect l="25000" t="50000" r="75000" b="50000"/></a:path><a:tileRect l="-25000" r="10000"/></a:gradFill>`
      const result = await imported(
        custom,
        undefined,
        undefined,
        shape(2, custom).replace('<a:solidFill><a:srgbClr val="123456"/></a:solidFill>', fill),
        geometryInheritance
      )
      const definition = Object.values(result.pptxSemantic.definitions).find(
        (entry) => entry.kind === 'shape'
      )
      const instance = Object.values(result.pptxSemantic.instances).find(
        (entry) => entry.definitionId === definition.id
      )
      expect(
        materializeGeometry(result.pptxSemantic, instance.id).style.fill.gradient
      ).toMatchObject({
        kind: 'path',
        path: path ?? 'shape',
        rotWithShape: true,
        fillToRect: { l: 25000, t: 50000, r: 75000, b: 50000 },
        tileRect: { l: -25000, r: 10000 },
      })
      if (geometryInheritance) {
        const source =
          result.pptxSemantic.styles[definition.content.geometrySource.styleId].payload.properties
            .fill.value.gradient.value
        if (path === undefined) expect(Object.hasOwn(source, 'path')).toBe(false)
        else expect(source.path.value).toBe(path)
        expect(source.fillToRect.value.l.value).toBe(25000)
        expect(source.tileRect.value.l.value).toBe(-25000)
        expect(Object.hasOwn(source.tileRect.value, 't')).toBe(false)
      }
      expect(
        normalizeSemanticPresentation(JSON.parse(JSON.stringify(result))).pptxSemantic
      ).toEqual(JSON.parse(JSON.stringify(result.pptxSemantic)))
    }
  )
  it('preserves exact alpha and color transform order inside gradient stops', async () => {
    const fill =
      '<a:gradFill rotWithShape="true"><a:gsLst><a:gs pos="0"><a:srgbClr val="2468AC"><a:tint val="50000"/><a:alpha val="50000"/></a:srgbClr></a:gs><a:gs pos="100000"><a:srgbClr val="D89434"/></a:gs></a:gsLst><a:lin ang="0" scaled="true"/><a:tileRect/></a:gradFill>'
    const result = await imported(
      custom,
      undefined,
      undefined,
      shape(2, custom).replace('<a:solidFill><a:srgbClr val="123456"/></a:solidFill>', fill)
    )
    const definition = Object.values(result.pptxSemantic.definitions).find(
      (entry) => entry.kind === 'shape'
    )
    expect(definition.content.geometry.style.fill.gradient).toMatchObject({
      kind: 'linear',
      angle: 0,
      scaled: true,
      rotWithShape: true,
      tileRect: {},
      stops: [
        {
          pos: 0,
          color: {
            kind: 'srgb',
            value: '2468AC',
            transforms: [
              { kind: 'tint', value: 50000 },
              { kind: 'alpha', value: 50000 },
            ],
          },
        },
        { pos: 100000, color: { kind: 'srgb', value: 'D89434' } },
      ],
    })
  })
  it('imports ordered direct RGB fill transforms and renders alpha without changing shape opacity', async () => {
    const color = {
      kind: 'srgb',
      value: '2468AC',
      transforms: [
        { kind: 'tint', value: 50000 },
        { kind: 'shade', value: 50000 },
        { kind: 'alpha', value: 50000 },
        { kind: 'alphaMod', value: 50000 },
      ],
    }
    const result = await imported(
      custom,
      undefined,
      undefined,
      shape(2, custom).replace(
        '<a:solidFill><a:srgbClr val="123456"/></a:solidFill>',
        '<a:solidFill><a:srgbClr val="2468AC"><a:tint val="50000"/><a:shade val="50000"/><a:alpha val="50000"/><a:alphaMod val="50000"/></a:srgbClr></a:solidFill>'
      )
    )
    const definition = Object.values(result.pptxSemantic.definitions).find(
      (entry) => entry.kind === 'shape'
    )
    expect(definition.content.geometry.style.fill).toEqual({ color })
    expect(definition.content.fill).toEqual(color)
    const html = renderSlideElements(result.slides[0], { pptxSemantic: result.pptxSemantic })
    expect(html).toContain('fill:#8A91A0;')
    expect(html).toContain('fill-opacity="0.25"')
    const savedSemantic = JSON.parse(JSON.stringify(result.pptxSemantic))
    expect(normalizeSemanticPresentation(JSON.parse(JSON.stringify(result))).pptxSemantic).toEqual(
      savedSemantic
    )
  })
  it.each([
    '<a:alpha val="100001"/>',
    '<a:shade val="-1"/>',
    '<a:tint val="0.5"/>',
    '<a:alpha val="50000" extra="1"/>',
    '<a:alpha/>',
    '<a:alpha val="50000"><a:shade val="50000"/></a:alpha>',
    '<foreign:alpha xmlns:foreign="urn:wrong" val="50000"/>',
    '<a:blur val="50000"/>',
    '<a:alpha val="50000">unhandled text</a:alpha>',
  ])(
    'rejects malformed or unknown source color transforms without losing source: %s',
    async (transform) => {
      await expect(
        imported(
          custom,
          undefined,
          undefined,
          shape(2, custom).replace(
            '<a:solidFill><a:srgbClr val="123456"/></a:solidFill>',
            `<a:solidFill><a:srgbClr val="2468AC">${transform}</a:srgbClr></a:solidFill>`
          )
        )
      ).rejects.toThrow()
    }
  )
  it.each([
    ['<a:solidFill><a:srgbClr val="123456"/></a:solidFill>', { kind: 'srgb', value: '123456' }],
    ['<a:noFill/>', { kind: 'none' }],
  ])('retains direct source shape fill in canonical geometry: %s', async (xml, color) => {
    const result = await imported(
      custom,
      undefined,
      undefined,
      shape(2, custom).replace('<a:solidFill><a:srgbClr val="123456"/></a:solidFill>', xml)
    )
    const definition = Object.values(result.pptxSemantic.definitions).find(
      (entry) => entry.kind === 'shape'
    )
    expect(definition.content.geometry.style.fill).toEqual({ color })
    expect(definition.content.fill).toEqual(color)
  })
  it.each([
    '<a:solidFill><a:srgbClr val="123456"/></a:solidFill><a:noFill/>',
    '<a:noFill/><a:noFill/>',
    '<a:solidFill><a:srgbClr val="123456"/></a:solidFill><a:solidFill><a:srgbClr val="654321"/></a:solidFill>',
    '<a:noFill unknown="true"/>',
    '<a:solidFill unknown="true"><a:srgbClr val="123456"/></a:solidFill>',
    '<a:solidFill>unhandled text<a:srgbClr val="123456"/></a:solidFill>',
    '<a:solidFill><a:srgbClr val="123456">unhandled text</a:srgbClr></a:solidFill>',
  ])('rejects ambiguous or malformed source fill before semantic admission: %s', async (xml) => {
    await expect(
      imported(
        custom,
        undefined,
        undefined,
        shape(2, custom).replace('<a:solidFill><a:srgbClr val="123456"/></a:solidFill>', xml)
      )
    ).rejects.toThrow()
  })
  it.each(
    ['none', 'triangle', 'stealth', 'diamond', 'oval', 'arrow'].flatMap((type) =>
      ['sm', 'med', 'lg'].flatMap((w) => ['sm', 'med', 'lg'].map((len) => ({ type, w, len })))
    )
  )('preserves both native line ends and independent sizes: %j', async (end) => {
    const result = await imported(
      custom,
      undefined,
      `<a:ln w="38100" cap="flat"><a:solidFill><a:srgbClr val="2468AC"/></a:solidFill><a:prstDash val="dashDot"/><a:bevel/><a:headEnd type="${end.type}" w="${end.w}" len="${end.len}"/><a:tailEnd type="arrow" w="lg" len="sm"/></a:ln>`
    )
    const definition = Object.values(result.pptxSemantic.definitions).find(
      (entry) => entry.kind === 'shape'
    )
    const stroke = definition.content.geometry.style.stroke
    expect(stroke).toEqual({
      color: { kind: 'srgb', value: '2468AC' },
      width: 38100,
      cap: 'flat',
      join: { kind: 'bevel' },
      dash: { kind: 'preset', value: 'dashDot' },
      headEnd: end,
      tailEnd: { type: 'arrow', w: 'lg', len: 'sm' },
    })
    const reopened = normalizeSemanticPresentation(JSON.parse(JSON.stringify(result)))
    expect(reopened.pptxSemantic.definitions[definition.id].content.geometry.style.stroke).toEqual(
      stroke
    )
  })
  it.each([
    ['', {}],
    ['<a:headEnd/>', { headEnd: {} }],
    ['<a:tailEnd/>', { tailEnd: {} }],
    ['<a:headEnd type="none"/>', { headEnd: { type: 'none' } }],
    ['<a:headEnd type="triangle"/>', { headEnd: { type: 'triangle' } }],
    ['<a:headEnd w="sm"/>', { headEnd: { w: 'sm' } }],
    ['<a:tailEnd len="lg"/>', { tailEnd: { len: 'lg' } }],
  ])('retains omitted native end properties without inferred defaults: %s', async (xml, ends) => {
    const result = await imported(
      custom,
      undefined,
      `<a:ln w="38100"><a:solidFill><a:srgbClr val="2468AC"/></a:solidFill>${xml}</a:ln>`
    )
    const definition = Object.values(result.pptxSemantic.definitions).find(
      (entry) => entry.kind === 'shape'
    )
    expect(definition.content.geometry.style.stroke).toEqual({
      color: { kind: 'srgb', value: '2468AC' },
      width: 38100,
      ...ends,
    })
  })
  it.each([
    '<a:headEnd/><a:headEnd/>',
    '<a:tailEnd/><a:tailEnd/>',
    '<a:headEnd type="circle"/>',
    '<a:tailEnd type="Arrow"/>',
    '<a:headEnd w="medium"/>',
    '<a:tailEnd len=""/>',
    '<a:headEnd type=""/>',
    '<a:headEnd unknown="sm"/>',
    '<a:headEnd a:w="sm"/>',
    '<a:tailEnd><a:extLst/></a:tailEnd>',
    '<a:headEnd type="arrow" type="triangle"/>',
  ])('rejects malformed native line end XML before admission: %s', async (xml) => {
    await expect(
      imported(
        custom,
        undefined,
        `<a:ln w="38100"><a:solidFill><a:srgbClr val="2468AC"/></a:solidFill>${xml}</a:ln>`
      )
    ).rejects.toThrow()
  })
  it.each([
    null,
    false,
    'arrow',
    [],
    { type: '' },
    { type: 'circle' },
    { w: 'medium' },
    { len: 3 },
    { type: 'triangle', size: 'lg' },
  ])('rejects malformed canonical native end records at save admission: %j', async (end) => {
    const result = await imported(
      custom,
      undefined,
      '<a:ln w="38100"><a:solidFill><a:srgbClr val="2468AC"/></a:solidFill></a:ln>'
    )
    const definition = Object.values(result.pptxSemantic.definitions).find(
      (entry) => entry.kind === 'shape'
    )
    for (const field of ['headEnd', 'tailEnd']) {
      const malformed = structuredClone(result)
      malformed.pptxSemantic.definitions[definition.id].content.geometry.style.stroke[field] = end
      expect(() => normalizeSemanticPresentation(malformed)).toThrow()
    }
  })
  it.each([
    'bentConnector2',
    'bentConnector3',
    'bentConnector4',
    'bentConnector5',
    'curvedConnector2',
    'curvedConnector3',
    'curvedConnector4',
    'curvedConnector5',
  ])(
    'retains authored %s route controls through bound terminal detach and JSON reload',
    async (preset) => {
      const adjustment = preset.endsWith('2') ? '' : '<a:gd name="adj1" fmla="val 30000"/>'
      const connector = `<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="4" name="Connector"/><p:cNvCxnSpPr><a:stCxn id="2" idx="0"/><a:endCxn id="3" idx="0"/></p:cNvCxnSpPr><p:nvPr/></p:nvCxnSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="952500" cy="762000"/></a:xfrm><a:prstGeom prst="${preset}"><a:avLst>${adjustment}</a:avLst></a:prstGeom><a:noFill/><a:ln w="38100"><a:solidFill><a:srgbClr val="2468AC"/></a:solidFill></a:ln></p:spPr></p:cxnSp>`
      const result = await imported(custom, undefined, undefined, connector + shape(2) + shape(3))
      const before = structuredClone(result)
      const definition = Object.values(result.pptxSemantic.definitions).find(
        (entry) => entry.source.nativeId === '4'
      )
      const instance = Object.values(result.pptxSemantic.instances).find(
        (entry) => entry.definitionId === definition.id
      )
      const geometry = definition.content.geometry
      expect(geometry.preset).toBe(preset)
      if (adjustment)
        expect(geometry.adjustments).toContainEqual({ name: 'adj1', formula: 'val 30000' })
      const resolved = deriveConnectorGeometry(result.pptxSemantic, instance.id)
      const terminal = connectorEndpointLocators(resolved).end
      const pointAt = (value) =>
        value.paths[terminal.pathIndex].commands[terminal.commandIndex].points[terminal.pointIndex]
      expect(pointAt(resolved)).toMatchObject({ x: -9525, y: 781050 })
      const detached = applyPresentationProjectionOperation(result, {
        type: 'geometry.edit',
        instanceId: instance.id,
        componentId: geometry.componentId,
        command: { type: 'connector-detach', end: 'end' },
      })
      const frozen =
        detached.pptxSemantic.instances[instance.id].overrides.components[geometry.componentId]
          .geometryDocument
      expect(pointAt(frozen)).toEqual(pointAt(resolved))
      const authored = structuredClone(frozen.paths)
      authored[terminal.pathIndex].commands[terminal.commandIndex].points[terminal.pointIndex] =
        pointAt(geometry)
      expect(authored).toEqual(geometry.paths)
      expect(frozen.connector).toEqual(geometry.connector)
      expect(detached.pptxSemantic.definitions).toEqual(before.pptxSemantic.definitions)
      const persisted = JSON.parse(JSON.stringify(detached))
      const reopened = normalizeSemanticPresentation(persisted)
      expect(reopened).toEqual(persisted)
      expect(pointAt(deriveConnectorGeometry(reopened.pptxSemantic, instance.id))).toEqual(
        pointAt(frozen)
      )
      expect(result).toEqual(before)
    }
  )

  it.each(['', '<a:cxnSpLocks/>', '<a:cxnSpLocks></a:cxnSpLocks>'])(
    'binds a forward-declared straight connector with empty lock declaration %s',
    async (locks) => {
      const connector = straightConnector(locks)
      const result = await imported(
        custom,
        undefined,
        undefined,
        connector + shape(2, custom) + shape(3, custom)
      )
      const definitions = Object.values(result.pptxSemantic.definitions)
      const line = definitions.find((entry) => entry.source.nativeId === '4')
      const first = definitions.find((entry) => entry.source.nativeId === '2')
      const last = definitions.find((entry) => entry.source.nativeId === '3')
      expect(line.kind).toBe('shape')
      expect(line.content.geometry.connector.start).toMatchObject({
        shapeId: '2',
        index: 0,
        targetDefinitionId: first.id,
      })
      expect(line.content.geometry.connector.end).toMatchObject({
        shapeId: '3',
        index: 0,
        targetDefinitionId: last.id,
      })
      expect(
        line.components.some(
          (entry) => entry.id === line.content.geometry.connector.start.componentId
        )
      ).toBe(true)
      const instances = Object.values(result.pptxSemantic.instances)
      const occurrence = instances.find((entry) => entry.definitionId === line.id)
      expect(occurrence.connectorBindings).toEqual({
        start: {
          targetInstanceId: instances.find((entry) => entry.definitionId === first.id).id,
          index: 0,
        },
        end: {
          targetInstanceId: instances.find((entry) => entry.definitionId === last.id).id,
          index: 0,
        },
      })
      expect(() => normalizeSemanticPresentation(result)).not.toThrow()
      const rendered = semanticRenderTree(result.pptxSemantic, result.slides[0]).find(
        (entry) => entry.instanceId === occurrence.id
      )
      expect(rendered.element.pptxGeometry.paths[0].commands[0].points[0]).toMatchObject({
        x: -9525,
        y: 781050,
      })
      const operation = (command) => ({
        type: 'geometry.edit',
        instanceId: occurrence.id,
        componentId: line.content.geometry.componentId,
        command,
      })
      const startPoint = line.content.geometry.paths[0].commands[0].points[0]
      expect(() =>
        applyPresentationProjectionOperation(
          result,
          operation({
            type: 'control-point',
            componentId: startPoint.componentId,
            x: 500,
          })
        )
      ).toThrow('detach')
      const detached = applyPresentationProjectionOperation(
        result,
        operation({
          type: 'connector-detach',
          end: 'start',
        })
      )
      expect(detached.pptxSemantic.instances[occurrence.id].connectorBindings.start).toBeNull()
      const detachedGeometry =
        detached.pptxSemantic.instances[occurrence.id].overrides.components[
          line.content.geometry.componentId
        ].geometryDocument
      expect(detachedGeometry.paths[0].commands[0].points[0]).toMatchObject({ x: -9525, y: 781050 })
      expect(detachedGeometry.paths[0].commands[1]).toEqual(
        line.content.geometry.paths[0].commands[1]
      )
      expect(detached.pptxSemantic.definitions).toEqual(result.pptxSemantic.definitions)
      const rebound = applyPresentationProjectionOperation(
        detached,
        operation({
          type: 'connector-attach',
          end: 'start',
          targetInstanceId: occurrence.connectorBindings.start.targetInstanceId,
          index: 0,
        })
      )
      expect(rebound.pptxSemantic.instances[occurrence.id].connectorBindings.start).toEqual(
        occurrence.connectorBindings.start
      )
      expect(rebound.pptxSemantic.definitions).toEqual(result.pptxSemantic.definitions)
      for (const patch of [
        { targetInstanceId: 'missing', index: 0 },
        { targetInstanceId: occurrence.connectorBindings.start.targetInstanceId, index: 1 },
      ]) {
        const invalid = structuredClone(result)
        invalid.pptxSemantic.instances[occurrence.id].connectorBindings.start = patch
        expect(() => normalizeSemanticPresentation(invalid)).toThrow()
      }
    }
  )
  it.each([
    '<a:cxnSpLocks noMove="1"/>',
    '<a:cxnSpLocks><a:extLst/></a:cxnSpLocks>',
    '<a:cxnSpLocks>unrepresented</a:cxnSpLocks>',
    '<a:cxnSpLocks/><a:cxnSpLocks/>',
    '<p:cxnSpLocks/>',
    '<a:cxnSpLocks xmlns:a="urn:wrong"/>',
  ])('rejects nonempty, duplicate or wrong-namespace connector locks: %s', async (locks) => {
    await expect(
      imported(
        custom,
        undefined,
        undefined,
        straightConnector(locks) + shape(2, custom) + shape(3, custom)
      )
    ).rejects.toMatchObject({ code: 'PPTX_SEMANTIC_ADMISSION_FAILED' })
  })
  it('preserves native custom dash percentages cap and join in shape-local stroke units', async () => {
    const result = await imported(
      custom,
      undefined,
      '<a:ln w="38100" cap="flat"><a:solidFill><a:srgbClr val="2468AC"/></a:solidFill><a:custDash><a:ds d="200000" sp="100000"/></a:custDash><a:round/></a:ln>'
    )
    const definition = Object.values(result.pptxSemantic.definitions).find(
      (entry) => entry.kind === 'shape'
    )
    expect(definition.content.geometry.style.stroke).toMatchObject({
      width: 38100,
      cap: 'flat',
      join: { kind: 'round' },
      dash: { kind: 'custom', stops: [{ dash: 200000, space: 100000 }] },
    })
    const html = renderSlideElements(result.slides[0], { pptxSemantic: result.pptxSemantic })
    expect(html).toContain('stroke-dasharray="8 4"')
    expect(html).toContain('stroke-linecap="butt"')
    expect(html).toContain('stroke-linejoin="round"')
    expect(html).not.toContain('vector-effect="non-scaling-stroke"')
    expect(() => normalizeSemanticPresentation(result)).not.toThrow()
  })
  it.each([
    ['solid', null],
    ['dot', '4 12'],
    ['dash', '16 12'],
    ['dashDot', '16 12 4 12'],
    ['lgDash', '32 12'],
    ['lgDashDot', '32 12 4 12'],
    ['lgDashDotDot', '32 12 4 12 4 12'],
    ['sysDot', '4 4'],
    ['sysDash', '12 4'],
    ['sysDashDot', '12 4 4 4'],
    ['sysDashDotDot', '12 4 4 4 4 4'],
  ])('preserves native preset dash %s identity and width-relative ink', async (value, dash) => {
    const result = await imported(
      custom,
      undefined,
      `<a:ln w="38100"><a:solidFill><a:srgbClr val="2468AC"/></a:solidFill><a:prstDash val="${value}"/></a:ln>`
    )
    const definition = Object.values(result.pptxSemantic.definitions).find(
      (entry) => entry.kind === 'shape'
    )
    expect(definition.content.geometry.style.stroke.dash).toEqual({ kind: 'preset', value })
    const html = renderSlideElements(result.slides[0], { pptxSemantic: result.pptxSemantic })
    if (dash) expect(html).toContain(`stroke-dasharray="${dash}"`)
    else expect(html).not.toContain('stroke-dasharray')
    expect(() => normalizeSemanticPresentation(result)).not.toThrow()
    for (const invalid of [
      { kind: 'preset', value: 'unknown' },
      { kind: 'preset', value: 'constructor' },
      { kind: 'preset', value, stops: [] },
      { kind: 'preset' },
    ]) {
      const candidate = structuredClone(result)
      candidate.pptxSemantic.definitions[definition.id].content.geometry.style.stroke.dash = invalid
      expect(() => normalizeSemanticPresentation(candidate)).toThrow()
      expect(definition.content.geometry.style.stroke.dash).toEqual({ kind: 'preset', value })
    }
  })
  it.each([
    '<a:prstDash val="unknown"/>',
    '<a:prstDash/>',
    '<a:prstDash val="dash" extra="1"/>',
    '<a:prstDash val="dash"><a:ds d="1" sp="1"/></a:prstDash>',
    '<a:prstDash val="dash"/><a:prstDash val="dot"/>',
    '<a:prstDash val="dash"/><a:custDash><a:ds d="1" sp="1"/></a:custDash>',
  ])('rejects malformed or ambiguous preset dash %s', async (dash) => {
    await expect(
      imported(
        custom,
        undefined,
        `<a:ln w="38100"><a:solidFill><a:srgbClr val="2468AC"/></a:solidFill>${dash}</a:ln>`
      )
    ).rejects.toMatchObject({ code: 'PPTX_SEMANTIC_ADMISSION_FAILED' })
  })
  it.each([
    '<a:ln w="38100"><a:solidFill><a:srgbClr val="2468AC"/><a:schemeClr val="accent1"/></a:solidFill></a:ln>',
    '<a:ln w="38100"><a:solidFill><a:srgbClr val="2468AC"/></a:solidFill><a:solidFill><a:srgbClr val="ABCDEF"/></a:solidFill></a:ln>',
    '<a:ln w="38100"><a:solidFill><a:srgbClr val="2468AC"/></a:solidFill></a:ln><a:ln w="9525"><a:solidFill><a:srgbClr val="ABCDEF"/></a:solidFill></a:ln>',
  ])(
    'rejects ambiguous native outline paint instead of silently dropping a source choice: %s',
    async (outline) => {
      await expect(imported(custom, undefined, outline)).rejects.toThrow('outline')
    }
  )
  it.each([
    ['flat', 'butt', 'bevel'],
    ['rnd', 'round', 'bevel'],
    ['sq', 'square', 'bevel'],
    ['flat', 'butt', 'round'],
    ['rnd', 'round', 'round'],
    ['sq', 'square', 'round'],
  ])('retains authored cap %s (%s) and join %s', async (cap, svgCap, join) => {
    const result = await imported(
      custom,
      undefined,
      `<a:ln w="38100" cap="${cap}"><a:solidFill><a:srgbClr val="2468AC"/></a:solidFill><a:${join}/></a:ln>`
    )
    const definition = Object.values(result.pptxSemantic.definitions).find(
      (entry) => entry.kind === 'shape'
    )
    expect(definition.content.geometry.style.stroke).toMatchObject({
      cap,
      join: { kind: join },
    })
    const html = renderSlideElements(result.slides[0], { pptxSemantic: result.pptxSemantic })
    expect(html).toContain(`stroke-linecap="${svgCap}"`)
    expect(html).toContain(`stroke-linejoin="${join}"`)
    expect(() => normalizeSemanticPresentation(result)).not.toThrow()
  })
  it.each([
    '<a:bevel extra="1"/>',
    '<a:bevel><a:round/></a:bevel>',
    '<a:bevel/><a:bevel/>',
    '<a:round/><a:bevel/>',
  ])('rejects malformed or ambiguous native joins %s', async (join) => {
    await expect(
      imported(
        custom,
        undefined,
        `<a:ln w="38100"><a:solidFill><a:srgbClr val="2468AC"/></a:solidFill>${join}</a:ln>`
      )
    ).rejects.toMatchObject({ code: 'PPTX_SEMANTIC_ADMISSION_FAILED' })
  })
  it.each([undefined, 0, 100000, 800000, 2147483647])(
    'retains raw miter percentage limit %s through canonical import and SVG rendering',
    async (limit) => {
      const result = await imported(
        custom,
        undefined,
        `<a:ln w="38100"><a:solidFill><a:srgbClr val="2468AC"/></a:solidFill><a:miter${limit === undefined ? '' : ` lim="${limit}"`}/></a:ln>`
      )
      const definition = Object.values(result.pptxSemantic.definitions).find(
        (entry) => entry.kind === 'shape'
      )
      const join = limit === undefined ? { kind: 'miter' } : { kind: 'miter', limit }
      expect(definition.content.geometry.style.stroke.join).toEqual(join)
      const html = renderSlideElements(result.slides[0], { pptxSemantic: result.pptxSemantic })
      expect(html).toContain(`stroke-linejoin="${limit === 0 ? 'bevel' : 'miter'}"`)
      if (limit === undefined || limit === 0) expect(html).not.toContain('stroke-miterlimit=')
      else expect(html).toContain(`stroke-miterlimit="${limit / 100000}"`)
      expect(() => normalizeSemanticPresentation(result)).not.toThrow()
    }
  )
  it.each([
    '<a:miter lim="-1"/>',
    '<a:miter lim="2147483648"/>',
    '<a:miter lim="NaN"/>',
    '<a:miter lim="1.5"/>',
    '<a:miter extra="1"/>',
    '<a:miter><a:round/></a:miter>',
    '<a:miter/><a:miter/>',
    '<a:round/><a:miter/>',
    '<a:bevel/><a:miter/>',
  ])('rejects malformed or ambiguous native miter %s', async (join) => {
    await expect(
      imported(
        custom,
        undefined,
        `<a:ln w="38100"><a:solidFill><a:srgbClr val="2468AC"/></a:solidFill>${join}</a:ln>`
      )
    ).rejects.toMatchObject({ code: 'PPTX_SEMANTIC_ADMISSION_FAILED' })
  })
  it('imports direct native RGB outline and EMU width through actual source adapter and render tree', async () => {
    const result = await imported(
      custom,
      undefined,
      '<a:ln w="38100"><a:solidFill><a:srgbClr val="2468AC"/></a:solidFill></a:ln>'
    )
    expect(result.slides[0].elements[0]).toMatchObject({ stroke: '#2468AC', strokeWidth: 4 })
    const tree = semanticRenderTree(result.pptxSemantic, result.slides[0])
    expect(tree[0].element).toMatchObject({ stroke: '#2468AC', strokeWidth: 4 })
    const html = renderSlideElements(result.slides[0], { pptxSemantic: result.pptxSemantic })
    expect(html).toContain('stroke:#2468AC')
    expect(html).toContain('stroke-width="4"')
    expect(() => normalizeSemanticPresentation(result)).not.toThrow()
  })
  it('renders canonical native outline rather than trusting a stale compatibility paint cache', async () => {
    const result = await imported(
      custom,
      undefined,
      '<a:ln w="38100"><a:solidFill><a:srgbClr val="2468AC"/></a:solidFill></a:ln>'
    )
    result.slides[0].elements[0].stroke = '#ABCDEF'
    result.slides[0].elements[0].strokeWidth = 32
    const before = JSON.stringify(result.pptxSemantic)
    const tree = semanticRenderTree(result.pptxSemantic, result.slides[0])
    expect(tree[0].element).toMatchObject({ stroke: '#2468AC', strokeWidth: 4 })
    const html = renderSlideElements(result.slides[0], { pptxSemantic: result.pptxSemantic })
    expect(html).toContain('stroke:#2468AC')
    expect(html).toContain('stroke-width="4"')
    expect(JSON.stringify(result.pptxSemantic)).toBe(before)
  })
  it('does not admit zero legacy or spoofed/unmatched canonical dimensions through actual DTO schemas', async () => {
    const legacy = {
      slides: [{ id: 's1', elements: [{ id: 'leaf', type: 'shape', width: 0, height: 80 }] }],
    }
    const spoofed = structuredClone(legacy)
    Object.assign(spoofed.slides[0].elements[0], {
      pptxInstanceId: 'forged',
      nativeFullyEditable: true,
      supportsZero: true,
    })
    const mismatched = await imported()
    mismatched.slides[0].elements[0].width = 0
    for (const schema of [createPresentationSchema, updatePresentationSchema]) {
      expect(schema.safeParse(legacy).success).toBe(false)
      expect(schema.safeParse(spoofed).success).toBe(false)
      expect(schema.safeParse(mismatched).success).toBe(false)
    }
  })
  it.each([
    { cx: 0, cy: 762000 },
    { cx: 952500, cy: 0 },
  ])(
    'admits authored zero extent %j through actual source import and save normalization',
    async (extent) => {
      const geometry =
        '<a:custGeom><a:pathLst><a:path fill="none"><a:moveTo><a:pt x="0" y="0"/></a:moveTo><a:lnTo><a:pt x="w" y="h"/></a:lnTo></a:path></a:pathLst></a:custGeom>'
      const result = await imported(geometry, extent)
      const instance = Object.values(result.pptxSemantic.instances)[0]
      const definition = result.pptxSemantic.definitions[instance.definitionId]
      expect(definition.content.extent).toEqual(extent)
      expect(definition.content.geometry).toMatchObject({
        width: extent.cx,
        height: extent.cy,
      })
      expect(() => normalizeSemanticPresentation(result)).not.toThrow()
      expect(createPresentationSchema.safeParse(result).success).toBe(true)
      expect(updatePresentationSchema.safeParse(result).success).toBe(true)
      const tree = semanticRenderTree(result.pptxSemantic, result.slides[0])
      expect(tree[0].element.width).toBe(extent.cx / 9525)
      expect(tree[0].element.height).toBe(extent.cy / 9525)
    }
  )
  it('records geometry edit coverage as server-owned Original-bound projection capability', async () => {
    const result = await imported()
    const instance = Object.values(result.pptxSemantic.instances)[0]
    const metadata = collectTrustedImportMetadata(result, 'original')
    expect(metadata.originalRevisionId).toBe('original')
    expect(metadata.projection.operations).toEqual([
      { instanceId: instance.id, operations: ['geometry.edit'] },
    ])
    expect(metadata.projection).not.toHaveProperty('transactionEligible')
  })
  it('admits reflected custom geometry with source-bound editable components and no SVG flattening', async () => {
    const result = await imported()
    const definition = Object.values(result.pptxSemantic.definitions).find(
      (def) => def.kind === 'shape'
    )
    expect(definition.content.geometry).toMatchObject({ schemaVersion: 1, kind: 'custom' })
    expect(definition.components.some((component) => component.kind === 'control-point')).toBe(true)
    const point = definition.content.geometry.paths[0].commands[1].points[0]
    expect(
      definition.components.some(
        (component) => component.id === point.componentId && component.kind === 'control-point'
      )
    ).toBe(true)
    expect(
      definition.components.some(
        (component) => component.id === definition.content.geometry.componentId
      )
    ).toBe(true)
    expect(result.slides[0].elements[0].type).toBe('shape')
    expect(result.slides[0].elements[0]).not.toHaveProperty('svgContent')
    expect(() => normalizeSemanticPresentation(result)).not.toThrow()
    const tree = semanticRenderTree(result.pptxSemantic, result.slides[0])
    expect(tree[0].element.pptxGeometry).toEqual(definition.content.geometry)
    expect(renderSlideElements(result.slides[0], { pptxSemantic: result.pptxSemantic })).toContain(
      'data-pptx-geometry-path='
    )
  })
  it('admits source preset adjustments under their original name', async () => {
    const result = await imported(
      '<a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val 30000"/></a:avLst></a:prstGeom>'
    )
    const definition = Object.values(result.pptxSemantic.definitions).find(
      (def) => def.kind === 'shape'
    )
    expect(definition.content.geometry.preset).toBe('roundRect')
    expect(definition.content.geometry.adjustments).toEqual([{ name: 'adj', formula: 'val 30000' }])
  })
  it('rejects unknown formulas at actual import before producing a misleading mapped shape', async () => {
    await expect(imported(custom.replace('*/ w adj 100000', 'eval globalThis'))).rejects.toThrow()
  })
  it('rejects malformed canonical geometry and wrongly bound geometry overrides at save admission', async () => {
    const result = await imported()
    const definition = Object.values(result.pptxSemantic.definitions).find(
      (def) => def.kind === 'shape'
    )
    const instance = Object.values(result.pptxSemantic.instances)[0]
    const malformed = structuredClone(result)
    malformed.pptxSemantic.definitions[definition.id].content.geometry.guides[0].formula =
      'eval globalThis'
    expect(() => normalizeSemanticPresentation(malformed)).toThrow()
    const missingSchema = structuredClone(result)
    delete missingSchema.pptxSemantic.definitions[definition.id].content.geometry.schemaVersion
    expect(() => normalizeSemanticPresentation(missingSchema)).toThrow()
    const wrongBinding = structuredClone(result)
    const changed = structuredClone(definition.content.geometry)
    changed.componentId = 'invented-geometry'
    wrongBinding.pptxSemantic.instances[instance.id].overrides.components = {
      [definition.content.geometry.componentId]: { geometryDocument: changed },
    }
    expect(() => normalizeSemanticPresentation(wrongBinding)).toThrow()
    const valid = structuredClone(result)
    valid.pptxSemantic.instances[instance.id].overrides.components = {
      [definition.content.geometry.componentId]: { geometryDocument: definition.content.geometry },
    }
    expect(() => normalizeSemanticPresentation(valid)).not.toThrow()
  })
  it('edits a source-bound local control point without changing definitions or transforms', async () => {
    const result = await imported()
    const before = JSON.stringify(result)
    const instance = Object.values(result.pptxSemantic.instances)[0]
    const definition = result.pptxSemantic.definitions[instance.definitionId]
    const geometry = definition.content.geometry
    const point = geometry.paths[0].commands[1].points[0]
    expect(getProjectionCapabilities(result.pptxSemantic, instance.id).operations).toContain(
      'geometry.edit'
    )
    const changed = applyPresentationProjectionOperation(result, {
      type: 'geometry.edit',
      instanceId: instance.id,
      componentId: geometry.componentId,
      command: { type: 'control-point', componentId: point.componentId, x: 58, y: 37 },
    })
    expect(JSON.stringify(result)).toBe(before)
    expect(changed.pptxSemantic.definitions).toEqual(result.pptxSemantic.definitions)
    expect(changed.pptxSemantic.instances[instance.id].localTransform).toEqual(
      instance.localTransform
    )
    const derived = semanticRenderTree(changed.pptxSemantic, changed.slides[0])[0].element
      .pptxGeometry
    expect(derived.paths[0].commands[1].points[0]).toMatchObject({ x: 58, y: 37 })
    expect(() => normalizeSemanticPresentation(changed)).not.toThrow()
    for (const command of [
      { type: 'control-point', componentId: 'missing', x: 0, y: 0 },
      { type: 'control-point', componentId: point.componentId, x: 'bad', y: 0 },
      { type: 'adjustment', name: 'missing', value: 1 },
    ]) {
      expect(() =>
        applyPresentationProjectionOperation(result, {
          type: 'geometry.edit',
          instanceId: instance.id,
          componentId: geometry.componentId,
          command,
        })
      ).toThrow()
      expect(JSON.stringify(result)).toBe(before)
    }
  })
  it('changes a source preset adjustment without rewriting authored guides or preset identity', async () => {
    const result = await imported(
      '<a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val 30000"/></a:avLst></a:prstGeom>'
    )
    const instance = Object.values(result.pptxSemantic.instances)[0]
    const geometry = result.pptxSemantic.definitions[instance.definitionId].content.geometry
    const changed = applyPresentationProjectionOperation(result, {
      type: 'geometry.edit',
      instanceId: instance.id,
      componentId: geometry.componentId,
      command: { type: 'adjustment', name: 'adj', value: 40000 },
    })
    const derived = semanticRenderTree(changed.pptxSemantic, changed.slides[0])[0].element
      .pptxGeometry
    expect(derived.preset).toBe('roundRect')
    expect(derived.adjustments).toEqual([{ name: 'adj', formula: 'val 40000' }])
    expect(derived.guides).toEqual(geometry.guides)
  })
})
