import JSZip from 'jszip'

export const P = 'http://schemas.openxmlformats.org/presentationml/2006/main'
export const A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
export const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
export const master = 'ppt/slideMasters/arbitrary.xml'
export const slide = 'ppt/slides/slide9.xml'
export const layout = 'ppt/slideLayouts/unrelated-name.xml'
const ns = `xmlns:p="${P}" xmlns:a="${A}" xmlns:r="${R}"`
const rels = (items) =>
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${items.map(([id, kind, target]) => `<Relationship Id="${id}" Type="${R}/${kind}" Target="${target}"/>`).join('')}</Relationships>`
export function shape(
  id,
  type,
  idx,
  list = '',
  paragraph = '<a:pPr/><a:r><a:rPr/><a:t>Text</a:t></a:r>'
) {
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="not-an-identity"/><p:cNvSpPr/><p:nvPr>${type === null ? '' : `<p:ph type="${type}" idx="${idx}"/>`}</p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr lIns="0" anchorCtr="0"/><a:lstStyle>${list}</a:lstStyle><a:p>${paragraph}</a:p></p:txBody></p:sp>`
}
export async function fixture() {
  const zip = new JSZip()
  zip.file(
    '[Content_Types].xml',
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/></Types>'
  )
  zip.file(
    'ppt/presentation.xml',
    `<p:presentation ${ns}><p:sldIdLst><p:sldId id="256" r:id="actualSlide"/></p:sldIdLst><p:defaultTextStyle><a:defPPr><a:defRPr sz="1100" b="0"/></a:defPPr></p:defaultTextStyle></p:presentation>`
  )
  zip.file('ppt/_rels/presentation.xml.rels', rels([['actualSlide', 'slide', 'slides/slide9.xml']]))
  zip.file(
    slide,
    `<p:sld ${ns}><p:cSld><p:spTree>${shape(2, 'obj', 7)}</p:spTree></p:cSld></p:sld>`
  )
  zip.file(
    'ppt/slides/_rels/slide9.xml.rels',
    rels([['actualLayout', 'slideLayout', '../slideLayouts/unrelated-name.xml']])
  )
  zip.file(
    layout,
    `<p:sldLayout ${ns}><p:cSld><p:spTree>${shape(8, 'body', 7, '<a:defPPr rtl="0"><a:defRPr b="1"/></a:defPPr><a:lvl1pPr marL="0"><a:defRPr sz="1800" b="0"><a:latin typeface="+mn-lt"/></a:defRPr></a:lvl1pPr>')}</p:spTree></p:cSld></p:sldLayout>`
  )
  zip.file(
    'ppt/slideLayouts/_rels/unrelated-name.xml.rels',
    rels([['actualMaster', 'slideMaster', '../slideMasters/arbitrary.xml']])
  )
  zip.file(
    master,
    `<p:sldMaster ${ns}><p:cSld><p:spTree>${shape(4, 'body', 23, '<a:lvl1pPr><a:defRPr sz="675"><a:solidFill><a:schemeClr val="tx1"><a:tint val="75000"/></a:schemeClr></a:solidFill></a:defRPr></a:lvl1pPr>')}</p:spTree></p:cSld><p:clrMap tx1="dk1" bg1="lt1"/><p:txStyles><p:bodyStyle><a:lvl1pPr><a:defRPr i="0"/></a:lvl1pPr></p:bodyStyle></p:txStyles></p:sldMaster>`
  )
  zip.file(
    'ppt/slideMasters/_rels/arbitrary.xml.rels',
    rels([['actualTheme', 'theme', '../theme/not-indexed.xml']])
  )
  zip.file(
    'ppt/theme/not-indexed.xml',
    `<a:theme xmlns:a="${A}"><a:themeElements><a:clrScheme name="test"><a:dk1><a:srgbClr val="102030"/></a:dk1><a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1></a:clrScheme><a:fontScheme name="test"><a:majorFont><a:latin typeface="Major"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Minor"/><a:ea typeface=""/><a:cs typeface=""/><a:font script="Arab" typeface="Arabic"/></a:minorFont></a:fontScheme></a:themeElements></a:theme>`
  )
  return zip
}
