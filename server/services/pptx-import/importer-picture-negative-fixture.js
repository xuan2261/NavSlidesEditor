const JSZip = require('jszip')

const P = 'http://schemas.openxmlformats.org/presentationml/2006/main'
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const supportedPixels = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1cAAAAASUVORK5CYII=',
  'base64'
)

// A one-pixel enhanced metafile: ENHMETAHEADER followed by EMR_EOF.
function enhancedMetafile() {
  const bytes = Buffer.alloc(128)
  for (const [offset, value] of [
    [0, 1], [4, 108], [16, 1], [20, 1], [32, 26], [36, 26],
    [40, 0x464d4520], [44, 0x10000], [48, 128], [52, 2], [56, 1],
    [72, 96], [76, 96], [80, 25], [84, 25], [100, 25000], [104, 25000],
    [108, 14], [112, 20], [124, 20],
  ]) bytes.writeUInt32LE(value, offset)
  return bytes
}

async function pictureNegativePackage(kind) {
  const zip = new JSZip()
  const namespaces = `xmlns:p="${P}" xmlns:a="${A}" xmlns:r="${R}"`
  const relationship = (type, target, id, mode = '') =>
    `<Relationship Id="${id}" Type="${R}/${type}" Target="${target}"${mode ? ` TargetMode="${mode}"` : ''}/>`
  const rels = (entries) =>
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${entries}</Relationships>`
  const group = '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>'
  const picture = (id, name, binding) =>
    `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="${name}"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip ${binding}/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="952500" y="952500"/><a:ext cx="1905000" cy="1905000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`
  const external = kind === 'external'
  zip.file('_rels/.rels', rels(relationship('officeDocument', 'ppt/presentation.xml', 'office')))
  zip.file('ppt/presentation.xml',
    `<p:presentation ${namespaces}><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="master"/></p:sldMasterIdLst><p:sldIdLst><p:sldId id="256" r:id="slide"/></p:sldIdLst><p:sldSz cx="9144000" cy="5143500"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`)
  zip.file('ppt/_rels/presentation.xml.rels', rels(
    relationship('slideMaster', 'slideMasters/slideMaster1.xml', 'master') +
    relationship('slide', 'slides/slide1.xml', 'slide') +
    relationship('theme', 'theme/theme1.xml', 'theme')))
  zip.file('ppt/slides/slide1.xml',
    `<p:sld ${namespaces}><p:cSld><p:spTree>${group}${picture(2, 'Supported PNG first', 'r:embed="supported"')}${picture(3, 'Rejected picture', external ? 'r:link="rejected"' : 'r:embed="rejected"')}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`)
  zip.file('ppt/slides/_rels/slide1.xml.rels', rels(
    relationship('slideLayout', '../slideLayouts/slideLayout1.xml', 'layout') +
    relationship('image', '../media/supported.png', 'supported') +
    relationship('image', external ? 'https://blocked.invalid/picture.svg' : '../media/rejected.emf',
      'rejected', external ? 'External' : '')))
  zip.file('ppt/media/supported.png', supportedPixels)
  if (!external) zip.file('ppt/media/rejected.emf', enhancedMetafile())
  zip.file('ppt/slideLayouts/slideLayout1.xml',
    `<p:sldLayout ${namespaces} type="blank"><p:cSld><p:spTree>${group}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`)
  zip.file('ppt/slideLayouts/_rels/slideLayout1.xml.rels',
    rels(relationship('slideMaster', '../slideMasters/slideMaster1.xml', 'master')))
  const colorMap = 'bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"'
  zip.file('ppt/slideMasters/slideMaster1.xml',
    `<p:sldMaster ${namespaces}><p:cSld><p:spTree>${group}</p:spTree></p:cSld><p:clrMap ${colorMap}/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="layout"/></p:sldLayoutIdLst></p:sldMaster>`)
  zip.file('ppt/slideMasters/_rels/slideMaster1.xml.rels', rels(
    relationship('slideLayout', '../slideLayouts/slideLayout1.xml', 'layout') +
    relationship('theme', '../theme/theme1.xml', 'theme')))
  const colors = ['dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 'accent3', 'accent4',
    'accent5', 'accent6', 'hlink', 'folHlink']
  const fonts = (name) => `<a:${name}Font><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:${name}Font>`
  zip.file('ppt/theme/theme1.xml',
    `<a:theme xmlns:a="${A}" name="Source theme"><a:themeElements><a:clrScheme name="Source colors">${colors.map((slot) => `<a:${slot}><a:srgbClr val="335577"/></a:${slot}>`).join('')}</a:clrScheme><a:fontScheme name="Source fonts">${fonts('major')}${fonts('minor')}</a:fontScheme><a:fmtScheme name="Source format"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst/><a:effectStyleLst/><a:bgFillStyleLst/></a:fmtScheme></a:themeElements></a:theme>`)
  const parts = [
    ['ppt/presentation.xml', 'presentation.main'], ['ppt/slides/slide1.xml', 'slide'],
    ['ppt/slideLayouts/slideLayout1.xml', 'slideLayout'],
    ['ppt/slideMasters/slideMaster1.xml', 'slideMaster'], ['ppt/theme/theme1.xml', 'theme'],
  ]
  zip.file('[Content_Types].xml',
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="emf" ContentType="image/x-emf"/>${parts.map(([uri, type]) => `<Override PartName="/${uri}" ContentType="application/vnd.openxmlformats-officedocument.${type === 'theme' ? 'theme' : `presentationml.${type}`}+xml"/>`).join('')}</Types>`)
  return zip.generateAsync({ type: 'nodebuffer' })
}

module.exports = { pictureNegativePackage, supportedPixels }
