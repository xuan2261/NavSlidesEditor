import JSZip from 'jszip'

export const fieldPart = 'ppt/slideLayouts/slideLayout7.xml'
export const nativeFields =
  '<a:fld id="{E594EA49-CA4C-4BFF-95ED-97BA24ADA151}" type="datetimeFigureOut"><a:rPr lang="en-US" smtClean="0"/><a:t>13/10/2026</a:t></a:fld>' +
  '<a:fld id="{C8A5E8D6-BDF0-478E-B146-1115331FE2D9}" type="slidenum"><a:rPr lang="en-US" smtClean="0"/><a:t>&#x2039;#&#x203A;</a:t></a:fld>'
export const fieldPresentation = () => ({
  id: 'fields',
  slides: [{ id: 'first', elements: [] }, { id: 'second', elements: [] }],
})

// Hand-authored source, using the relationship/ZIP pattern of feature-fixtures.
// Both hosts share a layout and master; no .omo evidence is needed at runtime.
export function fieldFixture(fields = nativeFields, { strict = false, aliases = false } = {}) {
  const P = strict ? 'http://purl.oclc.org/ooxml/presentationml/main' : 'http://schemas.openxmlformats.org/presentationml/2006/main'
  const A = strict ? 'http://purl.oclc.org/ooxml/drawingml/main' : 'http://schemas.openxmlformats.org/drawingml/2006/main'
  const R = strict ? 'http://purl.oclc.org/ooxml/officeDocument/relationships' : 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
  const ns = `xmlns:p="${P}" xmlns:a="${A}" xmlns:r="${R}"`
  const zip = new JSZip()
  const put = (part, xml) => zip.file(part, aliases
    ? xml.replace(/(<\/?)p:/g, '$1pres:').replace(/(<\/?)a:/g, '$1draw:')
      .replaceAll('xmlns:p=', 'xmlns:pres=').replaceAll('xmlns:a=', 'xmlns:draw=')
    : xml)
  const relationships = (items) => `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${items.map(([id, type, target]) => `<Relationship Id="${id}" Type="${R}/${type}" Target="${target}"/>`).join('')}</Relationships>`
  const shape = (id, content) => `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Field source"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="914400" cy="457200"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t> before </a:t></a:r>${content}<a:r><a:t> after </a:t></a:r></a:p></p:txBody></p:sp>`
  put('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/></Types>')
  put('ppt/presentation.xml', `<p:presentation ${ns}><p:sldIdLst><p:sldId id="256" r:id="first"/><p:sldId id="257" r:id="second"/></p:sldIdLst><p:sldSz cx="12192000" cy="6858000"/></p:presentation>`)
  put('ppt/_rels/presentation.xml.rels', relationships([['first', 'slide', 'slides/slide9.xml'], ['second', 'slide', 'slides/slide3.xml']]))
  for (const id of [9, 3]) {
    put(`ppt/slides/slide${id}.xml`, `<p:sld ${ns}><p:cSld><p:spTree/></p:cSld></p:sld>`)
    put(`ppt/slides/_rels/slide${id}.xml.rels`, relationships([['layout', 'slideLayout', '../slideLayouts/slideLayout7.xml']]))
  }
  put(fieldPart, `<p:sldLayout ${ns}><p:cSld><p:spTree>${shape('2', fields)}</p:spTree></p:cSld></p:sldLayout>`)
  put('ppt/slideLayouts/_rels/slideLayout7.xml.rels', relationships([['master', 'slideMaster', '../slideMasters/slideMaster1.xml']]))
  put('ppt/slideMasters/slideMaster1.xml', `<p:sldMaster ${ns}><p:cSld><p:spTree>${shape('900', nativeFields)}</p:spTree></p:cSld></p:sldMaster>`)
  return zip
}
