import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import inventoryModule from './semantic-inventory.js'
import sourceModule from './ooxml-geometry-style-source.js'
import projector from './semantic-projector.js'
import xml from './ooxml-text-run-xml.js'

const P = 'http://schemas.openxmlformats.org/presentationml/2006/main'
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const REL = 'http://schemas.openxmlformats.org/package/2006/relationships'
const shape = (effect) =>
  `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Soft edge"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="952500" cy="762000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:effectLst>${effect}</a:effectLst></p:spPr></p:sp>`
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
  const content = matrix
    ? shape('')
        .replace('<a:effectLst></a:effectLst>', '')
        .replace(
          '</p:sp>',
          '<p:style><a:effectRef idx="1"><a:srgbClr val="123456"/></a:effectRef></p:style></p:sp>'
        )
    : shape(effect)
  for (const [uri, kind, body] of [
    ['slides/one.xml', 'sld', content],
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

describe('strict color-free soft-edge source', () => {
  it.each([false, true])(
    'retains native radius and source locators (matrix=%s)',
    async (matrix) => {
      const input = await fixture('<a:softEdge rad="27273042316900"/>', matrix)
      const before = JSON.stringify(input.inventory),
        sourceXml = await input.zip.file('ppt/slides/one.xml').async('string')
      const result = await read(input)
      const declaration = Object.values(result.styles).find(
        (entry) => entry.kind === 'geometry-declarations'
      )
      const theme = Object.values(result.styles).find((entry) => entry.kind === 'theme')
      const list = matrix
        ? theme.payload.effectStyles[0].value.effects
        : declaration.payload.properties.effects
      const entry = list.value.effects[0]
      expect(entry.value).toEqual({
        kind: 'softEdge',
        rad: { source: entry.source, value: 27273042316900 },
      })
      expect(entry.source.partUri).toBe(matrix ? 'ppt/theme/theme.xml' : 'ppt/slides/one.xml')
      expect(entry.source.componentLocator.path.slice(0, -1)).toEqual(
        list.source.componentLocator.path
      )
      expect(JSON.stringify(input.inventory)).toBe(before)
      expect(await input.zip.file('ppt/slides/one.xml').async('string')).toBe(sourceXml)
    }
  )
  it.each(['', 'rad="0"'])('preserves missing versus zero: %s', async (attributes) => {
    const result = await read(await fixture(`<a:softEdge ${attributes}/>`))
    const declaration = Object.values(result.styles).find(
      (entry) => entry.kind === 'geometry-declarations'
    )
    const effect = declaration.payload.properties.effects.value.effects[0].value
    expect(Object.hasOwn(effect, 'rad')).toBe(Boolean(attributes))
    if (attributes) expect(effect.rad.value).toBe(0)
  })
  it.each([
    '<a:softEdge rad="-1"/>',
    '<a:softEdge rad="27273042316901"/>',
    '<a:softEdge rad="1.5"/>',
    '<a:softEdge rad="NaN"/>',
    '<a:softEdge rad="1" rad="2"/>',
    '<a:softEdge a:rad="1"/>',
    '<a:softEdge blurRad="1"/>',
    '<a:softEdge rotWithShape="true"/>',
    '<a:softEdge><a:srgbClr val="123456"/></a:softEdge>',
    '<a:softEdge>text</a:softEdge>',
    '<a:softEdge/><a:softEdge/>',
    '<a:effectDag/>',
    '<p:softEdge rad="1"/>',
  ])('rejects malformed direct and selected matrix effects: %s', async (effect) => {
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
  it.each(['', 'rad="0"', 'rad="19050"'])(
    'admits direct semantic geometry without linked declarations: %s',
    async (attributes) => {
      const sourceXml = `<p:root xmlns:p="${P}" xmlns:a="${A}">${shape(`<a:softEdge ${attributes}/>`)}</p:root>`
      const node = xml.parseXml(sourceXml)[0].children[0]
      const result = await projector.baselineAdapter({
        source: { id: 'shape', nativeId: '2', kind: 'shape', partUri: 'ppt/slides/one.xml' },
        node,
        xml: sourceXml,
        components: [{ id: 'geometry', kind: 'preset-geometry' }],
        nodes: new Map([['shape', node]]),
      })
      const effect = result.content.geometry.style.effects.effects[0]
      expect(effect).toEqual({
        kind: 'softEdge',
        ...(attributes ? { rad: Number(attributes.match(/\d+/)[0]) } : {}),
      })
    }
  )
})
