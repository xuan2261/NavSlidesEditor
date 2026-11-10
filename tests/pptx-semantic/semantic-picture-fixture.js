import JSZip from 'jszip'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { projectSemanticImport } = require('../../server/services/pptx-import/semantic-projector')
export const P = 'http://schemas.openxmlformats.org/presentationml/2006/main'
export const A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
export const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
export const pixels = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1cAAAAASUVORK5CYII=',
  'base64'
)
export async function pictureFixture({
  uploadsDir,
  effects = '<a:alphaModFix amt="200000"/><a:alphaModFix amt="35000"/>',
  crop = '<a:srcRect l="500" t="-250" r="0"/>',
  placement = '<a:stretch><a:fillRect/></a:stretch>',
  geometryInheritance = true,
  outline = '<a:ln w="9525"><a:solidFill><a:srgbClr val="123456"/></a:solidFill></a:ln>',
  mode = '',
  imageBytes = pixels,
  svgSource,
  frameGeometry = 'ellipse',
} = {}) {
  const zip = new JSZip()
  zip.file('[Content_Types].xml',
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="png" ContentType="image/png"/>${svgSource ? '<Default Extension="svg" ContentType="image/svg+xml"/>' : ''}</Types>`)
  zip.file('ppt/presentation.xml',
    `<p:presentation xmlns:p="${P}" xmlns:r="${R}"><p:sldIdLst><p:sldId id="256" r:id="slide"/></p:sldIdLst><p:sldSz cx="9144000" cy="5143500"/></p:presentation>`)
  const rels = (s) => `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${s}</Relationships>`
  zip.file('ppt/_rels/presentation.xml.rels',
    rels(`<Relationship Id="slide" Type="${R}/slide" Target="slides/slide1.xml"/>`))
  zip.file('ppt/slides/_rels/slide1.xml.rels',
    rels(`<Relationship Id="image" Type="${R}/image" Target="../media/${svgSource ? 'vector.svg' : 'image.png'}" ${mode}/>`))
  zip.file(svgSource ? 'ppt/media/vector.svg' : 'ppt/media/image.png', svgSource || imageBytes)
  const picture = (id) =>
    `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="Picture"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="image">${effects}</a:blip>${crop}${placement}</p:blipFill><p:spPr><a:xfrm rot="600000" flipH="1"><a:off x="-9525" y="19050"/><a:ext cx="952500" cy="762000"/></a:xfrm><a:prstGeom prst="${frameGeometry}"><a:avLst/></a:prstGeom>${outline}</p:spPr></p:pic>`
  zip.file('ppt/slides/slide1.xml',
    `<p:sld xmlns:p="${P}" xmlns:a="${A}" xmlns:r="${R}"><p:cSld><p:spTree>${picture(2)}${picture(3)}</p:spTree></p:cSld></p:sld>`)
  const result = await projectSemanticImport({
    zip, uploadsDir, geometryInheritance,
    presentation: { id: 'pictures', title: 'Pictures', slides: [{ id: 'slide', elements: [] }] },
  })
  return { ...result, zip }
}
