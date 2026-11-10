import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import inventoryModule from './semantic-inventory.js'
import sourceModule from './ooxml-geometry-style-source.js'

const P = 'http://schemas.openxmlformats.org/presentationml/2006/main'
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const REL = 'http://schemas.openxmlformats.org/package/2006/relationships'
const color = '<a:schemeClr val="accent1"><a:tint val="10000"/><a:alpha val="50000"/></a:schemeClr>'
const glow = (attributes = '', children = color) => `<a:glow ${attributes}>${children}</a:glow>`
async function fixture(effect, matrix = false) {
  const zip = new JSZip()
  const relationships = (type, target) =>
    `<Relationships xmlns="${REL}"><Relationship Id="r1" Type="${R}/${type}" Target="${target}"/></Relationships>`
  zip.file(
    '[Content_Types].xml',
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/></Types>'
  )
  zip.file(
    'ppt/presentation.xml',
    `<p:presentation xmlns:p="${P}" xmlns:r="${R}"><p:sldIdLst><p:sldId id="256" r:id="r1"/></p:sldIdLst></p:presentation>`
  )
  zip.file('ppt/_rels/presentation.xml.rels', relationships('slide', 'slides/one.xml'))
  const effects = `<a:effectLst>${effect}</a:effectLst>`
  const shape = `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Glow"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="952500" cy="762000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${matrix ? '' : effects}</p:spPr>${matrix ? '<p:style><a:effectRef idx="1"><a:srgbClr val="123456"/></a:effectRef></p:style>' : ''}</p:sp>`
  for (const [uri, kind, content] of [
    ['slides/one.xml', 'sld', shape],
    ['slideLayouts/layout.xml', 'sldLayout', ''],
    ['slideMasters/master.xml', 'sldMaster', ''],
  ])
    zip.file(
      `ppt/${uri}`,
      `<p:${kind} xmlns:p="${P}" xmlns:a="${A}"><p:cSld><p:spTree>${content}</p:spTree></p:cSld></p:${kind}>`
    )
  zip.file(
    'ppt/slides/_rels/one.xml.rels',
    relationships('slideLayout', '../slideLayouts/layout.xml')
  )
  zip.file(
    'ppt/slideLayouts/_rels/layout.xml.rels',
    relationships('slideMaster', '../slideMasters/master.xml')
  )
  zip.file('ppt/slideMasters/_rels/master.xml.rels', relationships('theme', '../theme/theme.xml'))
  zip.file(
    'ppt/theme/theme.xml',
    `<a:theme xmlns:a="${A}"><a:themeElements><a:clrScheme name="Colors"><a:accent1><a:srgbClr val="ABCDEF"/></a:accent1></a:clrScheme><a:fmtScheme name="Effects">${matrix ? `<a:effectStyleLst><a:effectStyle>${effects}</a:effectStyle></a:effectStyleLst>` : ''}</a:fmtScheme></a:themeElements></a:theme>`
  )
  return { zip, inventory: await inventoryModule.buildSemanticInventory(zip) }
}
const read = ({ zip, inventory }) => sourceModule.buildGeometryStyleSources(zip, inventory)

describe('strict OOXML glow source', () => {
  it.each([false, true])(
    'retains native radius and exact symbolic ordered color/locators (matrix=%s)',
    async (matrix) => {
      const input = await fixture(glow('rad="27273042316900"'), matrix)
      const before = JSON.stringify(input.inventory)
      const sourceXml = await input.zip.file('ppt/slides/one.xml').async('string')
      const result = await read(input)
      const declaration = Object.values(result.styles).find(
        (entry) => entry.kind === 'geometry-declarations'
      )
      const theme = Object.values(result.styles).find((entry) => entry.kind === 'theme')
      const list = matrix
        ? theme.payload.effectStyles[0].value.effects
        : declaration.payload.properties.effects
      const entry = list.value.effects[0]
      expect(entry.value.kind).toBe('glow')
      expect(entry.value.rad.value).toBe(27273042316900)
      expect(entry.value.rad.source).toEqual(entry.source)
      expect(entry.value.color.value).toMatchObject({ kind: 'scheme', value: 'accent1' })
      expect(entry.value.color.value.transforms.map((t) => t.value)).toEqual([
        { kind: 'tint', value: 10000 },
        { kind: 'alpha', value: 50000 },
      ])
      expect(entry.source.partUri).toBe(matrix ? 'ppt/theme/theme.xml' : 'ppt/slides/one.xml')
      expect(entry.source.componentLocator.path.slice(0, -1)).toEqual(
        list.source.componentLocator.path
      )
      expect(JSON.stringify(input.inventory)).toBe(before)
      expect(await input.zip.file('ppt/slides/one.xml').async('string')).toBe(sourceXml)
    }
  )

  it.each(['', 'rad="0"'])('preserves absence versus zero: %s', async (attributes) => {
    const result = await read(await fixture(glow(attributes)))
    const declaration = Object.values(result.styles).find(
      (entry) => entry.kind === 'geometry-declarations'
    )
    const effect = declaration.payload.properties.effects.value.effects[0].value
    expect(Object.hasOwn(effect, 'rad')).toBe(Boolean(attributes))
    if (attributes) expect(effect.rad.value).toBe(0)
  })

  it.each([
    glow('rad="-1"'),
    glow('rad="27273042316901"'),
    glow('rad="1.5"'),
    glow('rad="1" rad="2"'),
    glow('a:rad="1"'),
    glow('blurRad="1"'),
    glow('rotWithShape="true"'),
    glow('', ''),
    glow('', color + color),
    glow('', color + '<a:extLst/>'),
    glow() + glow(),
    glow('', 'text' + color),
    '<a:softEdge rad="-1"/>',
    '<a:effectDag/>',
  ])('rejects malformed/unsupported direct and selected matrix effect: %s', async (effect) => {
    for (const matrix of [false, true]) {
      const input = await fixture(effect, matrix),
        before = JSON.stringify(input.inventory)
      await expect(read(input)).rejects.toMatchObject({ code: 'PPTX_SEMANTIC_ADMISSION_FAILED' })
      expect(JSON.stringify(input.inventory)).toBe(before)
    }
  })
})
