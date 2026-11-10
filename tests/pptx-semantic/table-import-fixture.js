import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import JSZip from 'jszip'
import { expect } from 'vitest'

const require = createRequire(import.meta.url)
const { projectSemanticImport } = require('../../server/services/pptx-import/semantic-projector')
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
const P = 'http://schemas.openxmlformats.org/presentationml/2006/main'
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
export const tablePart = 'ppt/slides/slide7.xml'
const text = (value, size = 1200) => `<a:r><a:rPr sz="${size}"/><a:t>${value}</a:t></a:r>`
const cell = (runs, attrs = '') =>
  `<a:tc${attrs}><a:txBody><a:bodyPr/><a:lstStyle/><a:p>${runs}</a:p></a:txBody><a:tcPr/></a:tc>`
const table = `<a:tbl><a:tblPr firstRow="1"/><a:tblGrid><a:gridCol w="1371600"/><a:gridCol w="1371600"/></a:tblGrid><a:tr h="457200">${cell(text('Merged &amp; ') + text('rich', 2400), ' gridSpan="2"')}${cell(text('Covered'), ' hMerge="1"')}</a:tr><a:tr h="685800">${cell(text('A'))}${cell(text('B'))}</a:tr></a:tbl>`
export const tableFrame = (metadata = '') =>
  `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="7" name="Table">${metadata}</p:cNvPr><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr><p:xfrm rot="1800000" flipH="1"><a:off x="-9525" y="19050"/><a:ext cx="2743200" cy="1828800"/></p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table">${table}</a:graphicData></a:graphic></p:graphicFrame>`
export const linkedTableShape =
  '<p:sp><p:nvSpPr><p:cNvPr id="8" name="Shape"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="914400" cy="914400"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr></p:sp>'

export async function importTableFixture({
  graphic = tableFrame(),
  geometryInheritance = false,
} = {}) {
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
  const xml = `<p:sld xmlns:p="${P}" xmlns:a="${A}"><p:cSld><p:spTree>${graphic}</p:spTree></p:cSld></p:sld>`
  zip.file(tablePart, xml)
  const result = await projectSemanticImport({
    zip,
    geometryInheritance,
    presentation: { title: 'Source table', slides: [{ id: 's1', elements: [] }] },
  })
  expect(await zip.file(tablePart).async('string')).toBe(xml)
  return { presentation: result.presentation, hash: createHash('sha256').update(xml).digest('hex') }
}
