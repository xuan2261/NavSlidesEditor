import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import inventoryModule from './semantic-inventory.js'
import sourceModule from './ooxml-geometry-style-source.js'

const P = 'http://schemas.openxmlformats.org/presentationml/2006/main'
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const REL = 'http://schemas.openxmlformats.org/package/2006/relationships'
const color = '<a:schemeClr val="accent1"><a:alpha val="50000"/></a:schemeClr>'
const inner = (attributes = '', children = color) =>
  `<a:innerShdw ${attributes}>${children}</a:innerShdw>`
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
  const shape = `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Inner"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="952500" cy="762000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${matrix ? '' : effects}</p:spPr>${matrix ? '<p:style><a:effectRef idx="1"><a:srgbClr val="123456"/></a:effectRef></p:style>' : ''}</p:sp>`
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

describe('OOXML inner shadow source reader', () => {
  it('retains typed native fields, ordered color transforms, and exact source locators', async () => {
    const input = await fixture(inner('blurRad="28575" dist="152400" dir="2700000"'))
    const before = JSON.stringify(input.inventory)
    const sourceXml = await input.zip.file('ppt/slides/one.xml').async('string')
    const result = await read(input)
    const declarations = Object.values(result.styles).find(
      (entry) => entry.kind === 'geometry-declarations'
    )
    const list = declarations.payload.properties.effects
    const entry = list.value.effects[0]
    expect(entry.value.kind).toBe('innerShdw')
    expect(entry.value.blurRad.value).toBe(28575)
    expect(entry.value.dist.value).toBe(152400)
    expect(entry.value.dir.value).toBe(2700000)
    expect(entry.value.color.value.kind).toBe('scheme')
    expect(entry.value.color.value.transforms[0].value).toEqual({ kind: 'alpha', value: 50000 })
    expect(entry.source.partUri).toBe('ppt/slides/one.xml')
    expect(entry.source.componentLocator.path.slice(0, -1)).toEqual(
      list.source.componentLocator.path
    )
    expect(entry.value.dist.source).toEqual(entry.source)
    expect(entry.source.preconditionHash).toBe(declarations.source.preconditionHash)
    expect(JSON.stringify(input.inventory)).toBe(before)
    expect(await input.zip.file('ppt/slides/one.xml').async('string')).toBe(sourceXml)
  })

  it.each(['', 'blurRad="0" dist="0" dir="0"'])(
    'preserves absence versus explicit zero: %s',
    async (attributes) => {
      const result = await read(await fixture(inner(attributes)))
      const declaration = Object.values(result.styles).find(
        (entry) => entry.kind === 'geometry-declarations'
      )
      const value = declaration.payload.properties.effects.value.effects[0].value
      expect(Object.hasOwn(value, 'dist')).toBe(Boolean(attributes))
      if (attributes) expect(value.dist.value).toBe(0)
    }
  )

  it('admits a selected inner shadow effect matrix without relaxing unsupported entries', async () => {
    const result = await read(
      await fixture(inner('dist="9525"', '<a:schemeClr val="phClr"/>'), true)
    )
    const theme = Object.values(result.styles).find((entry) => entry.kind === 'theme')
    const effect = theme.payload.effectStyles[0].value.effects.value.effects[0].value
    expect(effect.kind).toBe('innerShdw')
    expect(effect.color.value).toEqual({ kind: 'scheme', value: 'phClr' })
    const context = Object.values(result.styles).find((entry) => entry.kind === 'geometry-context')
    expect(context.payload.matrixBindings.effectRef.entryIndex).toBe(0)
    await expect(
      read(await fixture('<a:glow rad="-1"><a:srgbClr val="000000"/></a:glow>', true))
    ).rejects.toThrow()
  })

  it.each([
    inner('blurRad="-1"'),
    inner('dist="27273042316901"'),
    inner('dir="21600000"'),
    inner('dist="1.5"'),
    inner('dist="1" dist="2"'),
    inner('a:dist="1"'),
    inner('sx="100000"'),
    inner('rotWithShape="false"'),
    inner('algn="ctr"'),
    inner('', ''),
    inner('', color + color),
    inner('', color + '<a:extLst/>'),
    inner() + inner(),
    '<a:glow rad="-1"><a:srgbClr val="000000"/></a:glow>',
  ])('rejects malformed or unsupported effects without source mutation: %s', async (effect) => {
    const input = await fixture(effect)
    const before = JSON.stringify(input.inventory)
    await expect(read(input)).rejects.toMatchObject({ code: 'PPTX_SEMANTIC_ADMISSION_FAILED' })
    expect(JSON.stringify(input.inventory)).toBe(before)
  })
})
