import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import JSZip from 'jszip'
const require = createRequire(import.meta.url)
const { buildSemanticInventory } = require('../../server/services/pptx-import/semantic-inventory')
const { buildGeometryStyleSources } = require('../../server/services/pptx-import/ooxml-geometry-style-source')
const P = 'http://schemas.openxmlformats.org/presentationml/2006/main'
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const REL = 'http://schemas.openxmlformats.org/package/2006/relationships'
const owners = ['ppt/slides/one.xml', 'ppt/slideLayouts/layout.xml', 'ppt/slideMasters/master.xml']
const themeUri = 'ppt/theme/theme.xml'
const transform = '<a:xfrm><a:off x="0" y="0"/><a:ext cx="762000" cy="762000"/></a:xfrm>'
const geometry = '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>'
const paint = '<a:solidFill><a:srgbClr val="445566"/></a:solidFill>'
const shape = (id, properties, reference = '') =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Source"/><p:cNvSpPr/><p:nvPr><p:ph idx="7" type="body"/></p:nvPr></p:nvSpPr><p:spPr>${properties}</p:spPr>${reference}</p:sp>`
const rels = (type, target, id = 'edge') =>
  `<Relationships xmlns="${REL}"><Relationship Id="${id}" Type="${R}/${type}" Target="${target}"/></Relationships>`
const hidden = (attributes) =>
  `<a:extLst><a:ext uri="{91240B29-F687-4F45-9708-019B960494DF}"><h:hiddenLine xmlns:h="http://schemas.microsoft.com/office/drawing/2010/main" w="12700" ${attributes}>${paint}</h:hiddenLine></a:ext></a:extLst>`
async function fixture({ direct = '', layout = '', master = '', matrix, latent = '' } = {}) {
  const zip = new JSZip()
  zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/></Types>')
  zip.file('ppt/presentation.xml', `<p:presentation xmlns:p="${P}" xmlns:r="${R}"><p:sldIdLst><p:sldId id="256" r:id="slide"/></p:sldIdLst></p:presentation>`)
  zip.file('ppt/_rels/presentation.xml.rels', rels('slide', 'slides/one.xml', 'slide'))
  const reference = matrix === undefined ? '' : '<p:style><a:lnRef idx="1"><a:srgbClr val="112233"/></a:lnRef></p:style>'
  for (const [index, root, properties] of [
    [0, 'sld', direct + latent],
    [1, 'sldLayout', layout],
    [2, 'sldMaster', transform + geometry + master],
  ]) {
    zip.file(owners[index], `<p:${root} xmlns:p="${P}" xmlns:a="${A}"><p:cSld><p:spTree>${shape(index + 2, properties, index === 0 ? reference : '')}</p:spTree></p:cSld></p:${root}>`)
  }
  zip.file('ppt/slides/_rels/one.xml.rels', rels('slideLayout', '../slideLayouts/layout.xml'))
  zip.file('ppt/slideLayouts/_rels/layout.xml.rels', rels('slideMaster', '../slideMasters/master.xml'))
  zip.file('ppt/slideMasters/_rels/master.xml.rels', rels('theme', '../theme/theme.xml'))
  zip.file(themeUri, `<a:theme xmlns:a="${A}"><a:themeElements><a:fmtScheme name="Source"><a:lnStyleLst>${matrix ?? ''}</a:lnStyleLst></a:fmtScheme></a:themeElements></a:theme>`)
  return { zip, inventory: await buildSemanticInventory(zip) }
}
const declaration = (result, inventory, uri = owners[0]) => {
  const definition = inventory.definitions.find((d) => d.kind === 'shape' && d.partUri === uri)
  return result.styles[result.definitionBindings[definition.id].styleId].payload
}
const hashes = async (zip) => Object.fromEntries(await Promise.all(
  Object.keys(zip.files).filter((uri) => !zip.files[uri].dir).map(async (uri) =>
    [uri, createHash('sha256').update(await zip.file(uri).async('nodebuffer')).digest('hex')]
  )
))
const context = (result) => Object.values(result.styles).find((s) =>
  s.kind === 'geometry-context' && s.payload.hostSlidePartUri === owners[0] &&
  s.source.partUri === owners[0]
).payload
const compounds = ['sng', 'dbl', 'thinThick', 'thickThin', 'tri']
const alignments = ['ctr', 'in']
describe('authored compound outline source declarations', () => {
  it.each(compounds.flatMap((compound) => alignments.map((alignment) => [compound, alignment])))(
    'preserves %s/%s in direct, hidden and selected theme declarations with exact source identity',
    async (compound, alignment) => {
      const attributes = `cmpd="${compound}" algn="${alignment}"`
      const line = `<a:ln ${attributes}/>`
      const { zip, inventory } = await fixture({ direct: line, latent: hidden(attributes), matrix: line })
      const before = await hashes(zip), inventoryBefore = JSON.stringify(inventory)
      const result = await buildGeometryStyleSources(zip, inventory)
      const payload = declaration(result, inventory)
      const theme = result.styles[context(result).themeId]
      const strokes = [payload.properties.stroke, payload.hiddenStroke, theme.payload.lineStyles[0]]
      for (const [index, stroke] of strokes.entries()) {
        const uri = index === 2 ? themeUri : owners[0]
        expect(stroke.value.compound).toEqual({ source: stroke.source, value: compound })
        expect(stroke.value.alignment).toEqual({ source: stroke.source, value: alignment })
        expect(stroke.value.compound.source).toBe(stroke.source)
        expect(stroke.value.alignment.source).toBe(stroke.source)
        expect(stroke.source).toEqual({
          partUri: uri, preconditionHash: before[uri],
          componentLocator: { path: expect.any(Array), preconditionHash: before[uri] },
        })
        for (const field of ['cap', 'join', 'dash']) expect(stroke.value).not.toHaveProperty(field)
        if (index !== 1) expect(Object.keys(stroke.value)).toEqual(['compound', 'alignment'])
      }
      expect(payload.properties.stroke.source.componentLocator.path).not.toEqual(payload.hiddenStroke.source.componentLocator.path)
      expect(context(result).matrixBindings.lnRef.source).toEqual(strokes[2].source)
      expect(JSON.parse(JSON.stringify(result))).toEqual(result)
      expect(await hashes(zip)).toEqual(before)
      expect(JSON.stringify(inventory)).toBe(inventoryBefore)
    }
  )
  it('retains sparse inherited leaves without resolving or fabricating defaults', async () => {
    const { zip, inventory } = await fixture({
      direct: '<a:ln/>', layout: '<a:ln algn="in"/>', master: '<a:ln cmpd="tri"/>',
    })
    const before = await hashes(zip), inventoryBefore = JSON.stringify(inventory)
    const result = await buildGeometryStyleSources(zip, inventory)
    expect(declaration(result, inventory).properties.stroke.value).toEqual({})
    const layout = declaration(result, inventory, owners[1]).properties.stroke
    const master = declaration(result, inventory, owners[2]).properties.stroke
    expect(layout.value).toEqual({ alignment: { source: layout.source, value: 'in' } })
    expect(master.value).toEqual({ compound: { source: master.source, value: 'tri' } })
    expect(context(result).declarationIds.map((id) => result.styles[id].source.partUri)).toEqual(owners)
    expect(await hashes(zip)).toEqual(before)
    expect(JSON.stringify(inventory)).toBe(inventoryBefore)
  })
  it.each([
    ['cmpd', compounds, 'compound'], ['algn', alignments, 'alignment'],
  ])('retains isolated %s declarations without inventing the other enum', async (attribute, values, field) => {
    for (const value of values) {
      const { zip, inventory } = await fixture({ direct: `<a:ln ${attribute}="${value}"/>` })
      const result = await buildGeometryStyleSources(zip, inventory)
      const stroke = declaration(result, inventory).properties.stroke
      expect(stroke.value).toEqual({ [field]: { source: stroke.source, value } })
    }
  })
  const invalid = [
    'cmpd="dbl" cmpd="dbl"', 'cmpd="dbl" cmpd="sng"',
    'algn="in" algn="in"', 'algn="in" algn="ctr"',
    'cmpd=""', 'cmpd="double"', 'cmpd="DBL"', 'cmpd=" dbl"',
    'cmpd="ctr"', 'cmpd="1"', 'algn=""', 'algn="out"',
    'algn="IN"', 'algn="in "', 'algn="sng"', 'algn="1"',
    'a:cmpd="dbl"', 'a:algn="in"',
  ]
  it.each(['direct', 'latent', 'matrix'].flatMap((location) =>
    invalid.map((attributes) => [location, attributes])
  ))('rejects malformed %s enum attributes: %s without mutation', async (location, attributes) => {
    const options = location === 'latent' ? { latent: hidden(attributes) } :
      { [location]: `<a:ln ${attributes}/>` }
    const { zip, inventory } = await fixture(options)
    const before = await hashes(zip), inventoryBefore = JSON.stringify(inventory)
    await expect(buildGeometryStyleSources(zip, inventory)).rejects.toMatchObject({
      code: 'PPTX_SEMANTIC_ADMISSION_FAILED',
    })
    expect(await hashes(zip)).toEqual(before)
    expect(JSON.stringify(inventory)).toBe(inventoryBefore)
  })
  it.each([
    { direct: '<x:ln xmlns:x="urn:foreign" cmpd="dbl" algn="in"/>' },
    { direct: '<a:ln cmpd="dbl" algn="in">unexpected</a:ln>' },
    { latent: hidden('cmpd="dbl" algn="in"').replace('http://schemas.microsoft.com/office/drawing/2010/main', 'urn:foreign') },
    { matrix: '<x:ln xmlns:x="urn:foreign" cmpd="dbl" algn="in"/>' },
  ])('rejects namespace-forged or text-bearing declarations: %j', async (options) => {
    const { zip, inventory } = await fixture(options)
    await expect(buildGeometryStyleSources(zip, inventory)).rejects.toMatchObject({
      code: 'PPTX_SEMANTIC_ADMISSION_FAILED',
    })
  })
})
