import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import inventoryModule from './semantic-inventory.js'
import sourceModule from './ooxml-geometry-style-source.js'

const P = 'http://schemas.openxmlformats.org/presentationml/2006/main'
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const REL = 'http://schemas.openxmlformats.org/package/2006/relationships'
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
  const shape = `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Blur"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="952500" cy="762000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${matrix ? '' : `<a:effectLst>${effect}</a:effectLst>`}</p:spPr>${matrix ? '<p:style><a:effectRef idx="1"><a:srgbClr val="123456"/></a:effectRef></p:style>' : ''}</p:sp>`
  for (const [uri, kind, body] of [
    ['slides/one.xml', 'sld', shape],
    ['slideLayouts/layout.xml', 'sldLayout', ''],
    ['slideMasters/master.xml', 'sldMaster', ''],
  ])
    zip.file(
      `ppt/${uri}`,
      `<p:${kind} xmlns:p="${P}" xmlns:a="${A}"><p:cSld><p:spTree>${body}</p:spTree></p:cSld></p:${kind}>`
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
    `<a:theme xmlns:a="${A}"><a:themeElements><a:clrScheme name="Colors"><a:accent1><a:srgbClr val="ABCDEF"/></a:accent1></a:clrScheme><a:fmtScheme name="Effects">${matrix ? `<a:effectStyleLst><a:effectStyle><a:effectLst>${effect}</a:effectLst></a:effectStyle></a:effectStyleLst>` : ''}</a:fmtScheme></a:themeElements></a:theme>`
  )
  return { zip, inventory: await inventoryModule.buildSemanticInventory(zip) }
}
const read = ({ zip, inventory }) => sourceModule.buildGeometryStyleSources(zip, inventory)
const listFor = (result, matrix) =>
  matrix
    ? Object.values(result.styles).find((entry) => entry.kind === 'theme').payload.effectStyles[0]
        .value.effects
    : Object.values(result.styles).find((entry) => entry.kind === 'geometry-declarations').payload
        .properties.effects

describe('strict color-free blur source extraction', () => {
  it.each([false, true])(
    'retains optional typed fields and exact source locators (matrix=%s)',
    async (matrix) => {
      for (const [attributes, expected] of [
        ['', {}],
        ['rad="0"', { rad: 0 }],
        ['rad="27273042316900"', { rad: 27273042316900 }],
        ['grow="0"', { grow: false }],
        ['grow="false"', { grow: false }],
        ['grow="1"', { grow: true }],
        ['grow="true"', { grow: true }],
        ['rad="19050" grow="false"', { rad: 19050, grow: false }],
      ]) {
        const input = await fixture(`<a:blur ${attributes}/>`, matrix)
        const before = JSON.stringify(input.inventory),
          sourceXml = await input.zip.file('ppt/slides/one.xml').async('string')
        const list = listFor(await read(input), matrix),
          entry = list.value.effects[0]
        expect(entry.value).toEqual({
          kind: 'blur',
          ...Object.fromEntries(
            Object.entries(expected).map(([key, value]) => [key, { source: entry.source, value }])
          ),
        })
        expect(entry.source.partUri).toBe(matrix ? 'ppt/theme/theme.xml' : 'ppt/slides/one.xml')
        expect(entry.source.componentLocator.path.slice(0, -1)).toEqual(
          list.source.componentLocator.path
        )
        expect(JSON.stringify(input.inventory)).toBe(before)
        expect(await input.zip.file('ppt/slides/one.xml').async('string')).toBe(sourceXml)
      }
    }
  )
  it.each([false, true])('preserves blur beside soft edge in authored order (matrix=%s)', async (matrix) => {
    const input = await fixture('<a:blur/><a:softEdge/>', matrix)
    const list = listFor(await read(input), matrix)
    expect(list.value.effects.map((entry) => entry.value)).toEqual([
      { kind: 'blur' },
      { kind: 'softEdge' },
    ])
  })
  it.each([
    '<a:blur rad="-1"/>',
    '<a:blur rad="27273042316901"/>',
    '<a:blur rad="1.5"/>',
    '<a:blur rad="NaN"/>',
    '<a:blur rad=""/>',
    '<a:blur rad="1" rad="2"/>',
    '<a:blur a:rad="1"/>',
    '<a:blur grow="2"/>',
    '<a:blur grow="TRUE"/>',
    '<a:blur grow=""/>',
    '<a:blur grow="true" grow="false"/>',
    '<a:blur a:grow="true"/>',
    '<a:blur blurRad="1"/>',
    '<a:blur rotWithShape="true"/>',
    '<a:blur arbitrary="0"/>',
    '<a:blur><a:srgbClr val="123456"/></a:blur>',
    '<a:blur>text</a:blur>',
    '<a:blur/><a:blur/>',
    '<a:effectDag/>',
    '<p:blur rad="1"/>',
  ])('rejects malformed direct and selected matrix declarations: %s', async (effect) => {
    for (const matrix of [false, true]) {
      const input = await fixture(effect, matrix),
        before = JSON.stringify(input.inventory)
      await expect(read(input)).rejects.toMatchObject({
        code: 'PPTX_SEMANTIC_ADMISSION_FAILED',
        sourceLocation: { partUri: matrix ? 'ppt/theme/theme.xml' : 'ppt/slides/one.xml' },
      })
      expect(JSON.stringify(input.inventory)).toBe(before)
    }
  })
})
