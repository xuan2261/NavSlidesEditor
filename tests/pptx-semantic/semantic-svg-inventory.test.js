import { createRequire } from 'node:module'
import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
const require = createRequire(import.meta.url)
const { buildSemanticInventory } = require('../../server/services/pptx-import/semantic-inventory')
const P = 'http://schemas.openxmlformats.org/presentationml/2006/main'
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const PKG = 'http://schemas.openxmlformats.org/package/2006/relationships'
const CT = 'http://schemas.openxmlformats.org/package/2006/content-types'
const SVG = 'http://www.w3.org/2000/svg'
function packageWithSvg({ source = `<svg xmlns="${SVG}" viewBox="0 0 10 10"><path d="M0 0L10 10"/></svg>`, mime = 'image/svg+xml' } = {}) {
  const zip = new JSZip()
  zip.file('[Content_Types].xml', `<Types xmlns="${CT}"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="svg" ContentType="${mime}"/></Types>`)
  zip.file('ppt/presentation.xml', `<p:presentation xmlns:p="${P}" xmlns:r="${R}"><p:sldIdLst><p:sldId id="1" r:id="slide"/></p:sldIdLst></p:presentation>`)
  zip.file('ppt/_rels/presentation.xml.rels', `<Relationships xmlns="${PKG}"><Relationship Id="slide" Type="${R}/slide" Target="slides/slide1.xml"/></Relationships>`)
  zip.file('ppt/slides/slide1.xml', `<p:sld xmlns:p="${P}" xmlns:a="${A}" xmlns:r="${R}"><p:cSld><p:spTree><p:pic><p:nvPicPr><p:cNvPr id="2" name="Vector"/></p:nvPicPr><p:blipFill><a:blip r:embed="image"/></p:blipFill></p:pic></p:spTree></p:cSld></p:sld>`)
  zip.file('ppt/slides/_rels/slide1.xml.rels', `<Relationships xmlns="${PKG}"><Relationship Id="image" Type="${R}/image" Target="../media/vector.svg"/></Relationships>`)
  zip.file('ppt/media/vector.svg', source)
  return zip
}
describe('semantic inventory SVG source admission', () => {
  it('preflights a relationship-reachable SVG under the exact SVG MIME type', async () => {
    const inventory = await buildSemanticInventory(packageWithSvg())
    expect(inventory.parts).toContainEqual(expect.objectContaining({ partUri: 'ppt/media/vector.svg' }))
    expect(inventory.definitions.filter((entry) => entry.partUri === 'ppt/media/vector.svg'))
      .toContainEqual(expect.objectContaining({ kind: 'vector-component', localName: 'path',
        componentLocators: [{ path: [0, 0], preconditionHash: expect.any(String) }] }))
  })
  it.each([
    ['unsafe content', `<svg xmlns="${SVG}" viewBox="0 0 10 10"><script/></svg>`, 'image/svg+xml'],
    ['wrong MIME', `<svg xmlns="${SVG}" viewBox="0 0 10 10"><path d="M0 0L10 10"/></svg>`, 'image/png'],
  ])('rejects %s before exposing semantic definitions', async (_name, source, mime) => {
    await expect(buildSemanticInventory(packageWithSvg({ source, mime }))).rejects.toThrow(/SVG/i)
  })
})
