import { fixture, shape, slide, layout, master, A } from './semantic-text-style-context-fixture.js'

export { slide, layout, master }
export const M = 'http://schemas.openxmlformats.org/officeDocument/2006/math'
export const math = '<m:oMath><m:r><m:t>x</m:t></m:r></m:oMath>'
export async function ommlSourceFixture({ placeholder = false, direct = '', list = '', equation = math } = {}) {
  const zip = await fixture()
  let source = shape(2, placeholder ? 'obj' : null, 7, list,
    `${direct}<a14:m xmlns:a14="http://schemas.microsoft.com/office/drawing/2010/main" xmlns:m="${M}">${equation}</a14:m><a:endParaRPr sz="9900"><a:latin typeface="Never paragraph defaults"/></a:endParaRPr>`)
  source = source.replace('<p:spPr/>', '<p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="914400" cy="457200"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>')
  const xml = await zip.file(slide).async('string')
  zip.file(slide, xml.replace(/<p:sp>[\s\S]*?<\/p:sp>/, source))
  for (const part of [layout, master]) {
    let xml = await zip.file(part).async('string')
    xml = xml.replaceAll('<p:spPr/>', '<p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="914400" cy="457200"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>')
    zip.file(part, xml)
  }
  zip.file('ppt/presentation.xml', (await zip.file('ppt/presentation.xml').async('string'))
    .replace('<a:defRPr sz="1100" b="0"/>', '<a:defRPr sz="1100" b="0" i="0"><a:latin typeface="+mj-lt"/><a:solidFill><a:srgbClr val="123456"/></a:solidFill></a:defRPr>')
    .replace('</p:presentation>', '<p:sldSz cx="9144000" cy="5143500"/></p:presentation>'))
  zip.file('ppt/theme/not-indexed.xml', (await zip.file('ppt/theme/not-indexed.xml').async('string'))
    .replace('typeface="Major"', 'typeface="Cambria Math"'))
  return zip
}
export const drawingRun = (text, attrs = '', face = '') =>
  `<m:r><a:rPr xmlns:a="${A}" ${attrs}>${face ? `<a:latin typeface="${face}"/>` : ''}</a:rPr><m:t>${text}</m:t></m:r>`
