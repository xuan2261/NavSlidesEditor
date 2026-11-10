const JSZip = require('jszip')

const drawing = 'http://schemas.openxmlformats.org/drawingml/2006/main'
const presentation = 'http://schemas.openxmlformats.org/presentationml/2006/main'
const relationships = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const run = (text, props = '') => `<a:r><a:rPr ${props}/><a:t xml:space="preserve">${text}</a:t></a:r>`
const paragraph = (...runs) => `<a:p>${runs.join('')}</a:p>`
const cell = (text, props = '') => `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/>${text}</a:txBody><a:tcPr>${props}</a:tcPr></a:tc>`
function frame(rows, { id = 7, styleId = 'selected-style', flags = '', xfrm = '', width = 2540000, heights = null } = {}) {
  return `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${id}" name="Table ${id}"/></p:nvGraphicFramePr><p:xfrm ${xfrm}><a:off x="0" y="0"/><a:ext cx="${width}" cy="1016000"/></p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblPr ${flags}><a:tableStyleId>${styleId}</a:tableStyleId></a:tblPr><a:tblGrid>${rows[0].map(() => `<a:gridCol w="${width / rows[0].length}"/>`).join('')}</a:tblGrid>${rows.map((row, index) => `<a:tr h="${heights?.[index] ?? 1016000 / rows.length}">${row.join('')}</a:tr>`).join('')}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`
}
const part = (...frames) => `<p:sld xmlns:p="${presentation}" xmlns:a="${drawing}"><p:cSld><p:spTree>${frames.join('')}</p:spTree></p:cSld></p:sld>`
const parserTable = (data, props = {}) => ({ type: 'table', sourceId: '7', left: 0, top: 0, width: 200, height: 80, data, ...props })
const mapperContext = (scale = { x: 1, y: 1 }) => ({ scale, zIndex: 1, slideIndex: 0, warnings: [], stats: { tableCount: 0 } })
function packageWithTable(xml, styles = '', target = 'styles/selected.xml') {
  const zip = new JSZip().file('ppt/slides/slide1.xml', xml)
  if (styles) {
    zip.file('ppt/presentation.xml', `<p:presentation xmlns:p="${presentation}" xmlns:r="${relationships}"><p:sldIdLst><p:sldId id="256" r:id="s1"/></p:sldIdLst></p:presentation>`)
    zip.file('ppt/_rels/presentation.xml.rels', `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="s1" Type="${relationships}/slide" Target="slides/slide1.xml"/><Relationship Id="ts1" Type="${relationships}/tableStyles" Target="${target}"/></Relationships>`)
    zip.file(`ppt/${target}`, `<a:tblStyleLst xmlns:a="${drawing}" def="decoy-style">${styles}</a:tblStyleLst>`)
  }
  return zip
}
const style = (id, body) => `<a:tblStyle styleId="${id}" styleName="Arbitrary ${id}">${body}</a:tblStyle>`
const fill = (value) => value === 'transparent' ? '<a:noFill/>' : `<a:solidFill><a:srgbClr val="${value}"/></a:solidFill>`
const region = (name, value) => `<a:${name}><a:tcStyle><a:fill>${fill(value)}</a:fill></a:tcStyle></a:${name}>`

module.exports = { drawing, run, paragraph, cell, frame, part, parserTable, mapperContext, packageWithTable, style, fill, region }
