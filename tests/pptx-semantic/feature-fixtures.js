import { createHash } from 'node:crypto'
import JSZip from 'jszip'
import PptxGenJS from 'pptxgenjs'
import { DOMParser } from '@xmldom/xmldom'

const A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
const P = 'http://schemas.openxmlformats.org/presentationml/2006/main'
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const C = 'http://schemas.openxmlformats.org/drawingml/2006/chart'
const D = 'http://schemas.openxmlformats.org/drawingml/2006/diagram'
const M = 'http://schemas.openxmlformats.org/officeDocument/2006/math'
const S = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const date = new Date('2000-01-01T00:00:00Z')
const header = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
const relationship = (id, type, target, external = false) =>
  `<Relationship Id="${id}" Type="${R}/${type}" Target="${target}"${external ? ' TargetMode="External"' : ''}/>`
const relationships = (items) =>
  `${header}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${items.join('')}</Relationships>`
const run = (text, size = 1200) =>
  `<a:r><a:rPr lang="en-US" sz="${size}"><a:latin typeface="Arial"/></a:rPr><a:t>${text}</a:t></a:r>`
const textBody = (content) =>
  `<a:bodyPr/><a:lstStyle/><a:p>${content}<a:endParaRPr lang="en-US"/></a:p>`
const shape = (
  id,
  name,
  content,
  transform = '<a:off x="0" y="0"/><a:ext cx="914400" cy="457200"/>'
) =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm>${transform}</a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody>${textBody(content)}</p:txBody></p:sp>`
const frame = (id, name, uri, content, x = 914400, y = 914400) =>
  `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${id}" name="${name}"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="2743200" cy="1828800"/></p:xfrm><a:graphic><a:graphicData uri="${uri}">${content}</a:graphicData></a:graphic></p:graphicFrame>`

export async function stableZip(zip) {
  const ordered = new JSZip()
  for (const name of Object.keys(zip.files)
    .filter((name) => !zip.files[name].dir)
    .sort()) {
    ordered.file(name, await zip.file(name).async('nodebuffer'), { date, createFolders: false })
  }
  return ordered.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })
}

async function literalWorkbook() {
  const zip = new JSZip()
  zip.file(
    '[Content_Types].xml',
    `${header}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`
  )
  zip.file(
    '_rels/.rels',
    relationships([relationship('rId1', 'officeDocument', 'xl/workbook.xml')])
  )
  zip.file(
    'xl/workbook.xml',
    `${header}<workbook xmlns="${S}" xmlns:r="${R}"><sheets><sheet name="Data" sheetId="1" r:id="rId1"/></sheets></workbook>`
  )
  zip.file(
    'xl/_rels/workbook.xml.rels',
    relationships([relationship('rId1', 'worksheet', 'worksheets/sheet1.xml')])
  )
  const inline = (address, value) => `<c r="${address}" t="inlineStr"><is><t>${value}</t></is></c>`
  zip.file(
    'xl/worksheets/sheet1.xml',
    `${header}<worksheet xmlns="${S}"><dimension ref="A1:B3"/><sheetData><row r="1">${inline('A1', 'Category')}${inline('B1', 'Series')}</row><row r="2">${inline('A2', 'Alpha')}<c r="B2"><v>7</v></c></row><row r="3">${inline('A3', 'Beta')}<c r="B3"><v>11</v></c></row></sheetData></worksheet>`
  )
  return stableZip(zip)
}

function authoredSlide() {
  const tableCell = (content, attributes = '') =>
    `<a:tc${attributes}><a:txBody>${textBody(content)}</a:txBody><a:tcPr/></a:tc>`
  const table = `<a:tbl><a:tblPr firstRow="1" bandRow="1"/><a:tblGrid><a:gridCol w="1371600"/><a:gridCol w="1371600"/></a:tblGrid><a:tr h="457200">${tableCell(run('Merged ', 1200) + run('rich', 2400), ' gridSpan="2"')}${tableCell('', ' hMerge="1"')}</a:tr><a:tr h="457200">${tableCell(run('A'))}${tableCell(run('B'))}</a:tr></a:tbl>`
  const groupProperties = (id, name, transform) =>
    `<p:nvGrpSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr>${transform}</p:grpSpPr>`
  const nested = `<p:grpSp>${groupProperties(4, 'Anisotropic outer', '<a:xfrm rot="1800000" flipV="1"><a:off x="3657600" y="914400"/><a:ext cx="2743200" cy="914400"/><a:chOff x="0" y="0"/><a:chExt cx="914400" cy="914400"/></a:xfrm>')}<p:grpSp>${groupProperties(5, 'Reflected inner', '<a:xfrm rot="900000" flipH="1"><a:off x="114300" y="228600"/><a:ext cx="457200" cy="685800"/><a:chOff x="0" y="0"/><a:chExt cx="914400" cy="914400"/></a:xfrm>')}${shape(6, 'Group child', run('Nested'))}</p:grpSp></p:grpSp>`
  const math = `<a14:m xmlns:a14="http://schemas.microsoft.com/office/drawing/2010/main"><m:oMathPara><m:oMath><m:f><m:fPr><m:type m:val="bar"/></m:fPr><m:num><m:r><m:t>1</m:t></m:r></m:num><m:den><m:r><m:t>2</m:t></m:r></m:den></m:f><m:m><m:mPr/><m:mr><m:e><m:r><m:t>a</m:t></m:r></m:e><m:e><m:r><m:t>b</m:t></m:r></m:e></m:mr><m:mr><m:e><m:r><m:t>c</m:t></m:r></m:e><m:e><m:r><m:t>d</m:t></m:r></m:e></m:mr></m:m></m:oMath></m:oMathPara></a14:m>`
  const links = `<a:r><a:rPr sz="1200"><a:hlinkClick r:id="rIdLink"/></a:rPr><a:t>Website</a:t></a:r><a:r><a:rPr sz="1200"><a:hlinkClick r:id="rIdJump" action="ppaction://hlinksldjump"/></a:rPr><a:t>Next slide</a:t></a:r>`
  const media = `<p:pic><p:nvPicPr><p:cNvPr id="11" name="Native audio"/><p:cNvPicPr/><p:nvPr><a:audioFile r:link="rIdAudio"/><p:extLst><p:ext uri="{DAA4B4D4-4CA0-4E4C-86DA-21E03BF9A436}"><p14:media xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main" r:embed="rIdMedia"/></p:ext></p:extLst></p:nvPr></p:nvPicPr><p:blipFill><a:blip r:embed="rIdPoster"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="8229600" y="914400"/><a:ext cx="457200" cy="457200"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`
  const blockedMedia = media
    .replace('id="11"', 'id="14"')
    .replace('name="Native audio"', 'name="Blocked external video"')
    .replace('<a:audioFile r:link="rIdAudio"/>', '<a:videoFile r:link="rIdBlocked"/>')
    .replace(/<p:extLst>.*?<\/p:extLst>/, '')
  const excluded =
    frame(
      12,
      'Excluded OLE metadata only',
      `${P}/ole`,
      '<p:oleObj name="Excluded workbook" progId="Excel.Sheet.12" showAsIcon="1"><p:embed/></p:oleObj>'
    ) +
    frame(
      13,
      'Excluded 3D metadata only',
      'http://schemas.microsoft.com/office/drawing/2017/model3d',
      '<am3d:model3d xmlns:am3d="http://schemas.microsoft.com/office/drawing/2017/model3d"><am3d:spPr/></am3d:model3d>'
    )
  const timing =
    '<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst><p:animEffect transition="in" filter="fade"><p:cBhvr><p:cTn id="2" dur="500" fill="hold"/><p:tgtEl><p:spTgt spid="2"/></p:tgtEl></p:cBhvr></p:animEffect></p:childTnLst></p:cTn></p:par></p:tnLst></p:timing>'
  return `${header}<p:sld xmlns:p="${P}" xmlns:a="${A}" xmlns:r="${R}" xmlns:c="${C}" xmlns:dgm="${D}" xmlns:m="${M}"><p:cSld><p:spTree>${groupProperties(1, 'Root', '<a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm>')}${shape(2, 'Off-slide mixed runs', run('Twelve ', 1200) + run('Twenty-four', 2400), '<a:off x="-114300" y="228600"/><a:ext cx="1257300" cy="571500"/>')}${shape(3, 'Typed hyperlinks', links)}${nested}${frame(7, 'Rich merged table', `${A}/table`, table)}${frame(8, 'Native chart', C, '<c:chart r:id="rIdChart"/>', 4572000, 2743200)}${frame(9, 'Native diagram', D, '<dgm:relIds r:dm="rIdDiagramData" r:lo="rIdDiagramLayout" r:qs="rIdDiagramStyle" r:cs="rIdDiagramColors"/>', 7315200, 2743200)}${shape(10, 'Native OMML', math)}${media}${excluded}${blockedMedia}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>${timing}</p:sld>`
}

function chartXml() {
  const category =
    '<c:cat><c:strRef><c:f>Data!$A$2:$A$3</c:f><c:strCache><c:ptCount val="2"/><c:pt idx="0"><c:v>Alpha</c:v></c:pt><c:pt idx="1"><c:v>Beta</c:v></c:pt></c:strCache></c:strRef></c:cat>'
  const values =
    '<c:val><c:numRef><c:f>Data!$B$2:$B$3</c:f><c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="2"/><c:pt idx="0"><c:v>7</c:v></c:pt><c:pt idx="1"><c:v>11</c:v></c:pt></c:numCache></c:numRef></c:val>'
  return `${header}<c:chartSpace xmlns:c="${C}" xmlns:a="${A}" xmlns:r="${R}"><c:chart><c:plotArea><c:layout/><c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:ser><c:idx val="0"/><c:order val="0"/><c:tx><c:v>Series</c:v></c:tx>${category}${values}</c:ser><c:axId val="100"/><c:axId val="200"/></c:barChart><c:catAx><c:axId val="100"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:axPos val="b"/><c:crossAx val="200"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/></c:catAx><c:valAx><c:axId val="200"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:axPos val="l"/><c:crossAx val="100"/><c:crosses val="autoZero"/><c:crossBetween val="between"/></c:valAx></c:plotArea><c:plotVisOnly val="1"/></c:chart><c:externalData r:id="rIdWorkbook"><c:autoUpdate val="0"/></c:externalData></c:chartSpace>`
}

function diagramParts() {
  const points = Array.from({ length: 51 }, (_, index) => {
    const number = index + 1
    return `<dgm:pt modelId="node-${number}" type="node"><dgm:prSet/><dgm:spPr/><dgm:t>${textBody(run(`Node ${number}`))}</dgm:t></dgm:pt>`
  }).join('')
  const connections = Array.from(
    { length: 51 },
    (_, index) =>
      `<dgm:cxn modelId="edge-${index + 1}" type="parOf" srcId="${index === 0 ? 'root' : `node-${index}`}" destId="node-${index + 1}" srcOrd="0" destOrd="0"/>`
  ).join('')
  return {
    'data1.xml': `${header}<dgm:dataModel xmlns:dgm="${D}" xmlns:a="${A}"><dgm:ptLst><dgm:pt modelId="root" type="doc"><dgm:prSet/><dgm:spPr/><dgm:t>${textBody('')}</dgm:t></dgm:pt>${points}</dgm:ptLst><dgm:cxnLst>${connections}</dgm:cxnLst><dgm:bg/><dgm:whole/></dgm:dataModel>`,
    'layout1.xml': `${header}<dgm:layoutDef xmlns:dgm="${D}" xmlns:a="${A}" uniqueId="urn:navslides:fixture:linear" minVer="12.0"><dgm:title lang="en-US" val="Source linear layout"/><dgm:desc lang="en-US" val="51-node source chain"/><dgm:layoutNode name="root"><dgm:alg type="lin"><dgm:param type="linDir" val="fromT"/></dgm:alg><dgm:forEach name="nodes" axis="ch" ptType="node"><dgm:layoutNode name="node" styleLbl="node0"><dgm:alg type="sp"/><dgm:shape type="rect"/><dgm:presOf axis="self" ptType="node"/><dgm:constrLst><dgm:constr type="w" for="self" val="1"/><dgm:constr type="h" for="self" val="0.5"/></dgm:constrLst></dgm:layoutNode></dgm:forEach></dgm:layoutNode></dgm:layoutDef>`,
    'quickStyle1.xml': `${header}<dgm:styleDef xmlns:dgm="${D}" xmlns:a="${A}" uniqueId="urn:navslides:fixture:style" minVer="12.0"><dgm:title lang="en-US" val="Source style"/><dgm:desc lang="en-US" val="Source node style"/><dgm:styleLbl name="node0"><dgm:style><a:lnRef idx="1"><a:schemeClr val="accent1"/></a:lnRef><a:fillRef idx="1"><a:schemeClr val="accent1"/></a:fillRef><a:effectRef idx="0"><a:schemeClr val="accent1"/></a:effectRef><a:fontRef idx="minor"><a:schemeClr val="lt1"/></a:fontRef></dgm:style></dgm:styleLbl></dgm:styleDef>`,
    'colors1.xml': `${header}<dgm:colorsDef xmlns:dgm="${D}" xmlns:a="${A}" uniqueId="urn:navslides:fixture:colors" minVer="12.0"><dgm:title lang="en-US" val="Source colors"/><dgm:desc lang="en-US" val="Source accent"/><dgm:styleLbl name="node0"><dgm:fillClrLst meth="repeat"><a:schemeClr val="accent1"/></dgm:fillClrLst><dgm:linClrLst meth="repeat"><a:schemeClr val="dk1"/></dgm:linClrLst><dgm:txFillClrLst meth="repeat"><a:schemeClr val="lt1"/></dgm:txFillClrLst></dgm:styleLbl></dgm:colorsDef>`,
  }
}

function waveBuffer() {
  // A valid one-sample mono PCM WAV, not an opaque media stub.
  const buffer = Buffer.alloc(46)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(38, 4)
  buffer.write('WAVEfmt ', 8)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(8000, 24)
  buffer.writeUInt32LE(16000, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(2, 40)
  return buffer
}

/** Build an in-memory OPC package. Inventory is source evidence, never importer qualification. */
export async function buildFeatureFixture() {
  const deck = new PptxGenJS()
  deck.defineLayout({ name: 'SEMANTIC_CUSTOM', width: 12, height: 7 })
  deck.layout = 'SEMANTIC_CUSTOM'
  deck.author = 'NavSlides source fixture'
  deck.subject = 'Unqualified source-authored feature coverage'
  deck.title = 'Semantic feature fixture'
  deck.company = 'NavSlides'
  deck.addSlide()
  deck
    .addSlide()
    .addText('Internal link target', { x: 1, y: 1, w: 3, h: 1, fontFace: 'Arial', fontSize: 12 })
  const zip = await JSZip.loadAsync(await deck.write({ outputType: 'nodebuffer' }))
  zip.file('ppt/slides/slide1.xml', authoredSlide())
  const relsName = 'ppt/slides/_rels/slide1.xml.rels'
  const originalRels = await zip.file(relsName).async('string')
  const additions = [
    relationship('rIdChart', 'chart', '../charts/chart1.xml'),
    relationship('rIdDiagramData', 'diagramData', '../diagrams/data1.xml'),
    relationship('rIdDiagramLayout', 'diagramLayout', '../diagrams/layout1.xml'),
    relationship('rIdDiagramStyle', 'diagramQuickStyle', '../diagrams/quickStyle1.xml'),
    relationship('rIdDiagramColors', 'diagramColors', '../diagrams/colors1.xml'),
    relationship('rIdAudio', 'audio', '../media/feature.wav'),
    `<Relationship Id="rIdMedia" Type="http://schemas.microsoft.com/office/2007/relationships/media" Target="../media/feature.wav"/>`,
    relationship('rIdPoster', 'image', '../media/poster.png'),
    relationship('rIdLink', 'hyperlink', 'https://example.org/source', true),
    relationship('rIdJump', 'slide', 'slide2.xml'),
    relationship('rIdBlocked', 'video', 'https://blocked.invalid/video.mp4', true),
  ]
  zip.file(
    relsName,
    originalRels.replace('</Relationships>', additions.join('') + '</Relationships>')
  )
  zip.file('ppt/charts/chart1.xml', chartXml())
  zip.file(
    'ppt/charts/_rels/chart1.xml.rels',
    relationships([relationship('rIdWorkbook', 'package', '../embeddings/feature-data.xlsx')])
  )
  zip.file('ppt/embeddings/feature-data.xlsx', await literalWorkbook())
  for (const [name, content] of Object.entries(diagramParts()))
    zip.file(`ppt/diagrams/${name}`, content)
  zip.file('ppt/media/feature.wav', waveBuffer())
  zip.file(
    'ppt/media/poster.png',
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=',
      'base64'
    )
  )
  const types = [
    ['/ppt/charts/chart1.xml', 'application/vnd.openxmlformats-officedocument.drawingml.chart+xml'],
    [
      '/ppt/diagrams/data1.xml',
      'application/vnd.openxmlformats-officedocument.drawingml.diagramData+xml',
    ],
    [
      '/ppt/diagrams/layout1.xml',
      'application/vnd.openxmlformats-officedocument.drawingml.diagramLayout+xml',
    ],
    [
      '/ppt/diagrams/quickStyle1.xml',
      'application/vnd.openxmlformats-officedocument.drawingml.diagramStyle+xml',
    ],
    [
      '/ppt/diagrams/colors1.xml',
      'application/vnd.openxmlformats-officedocument.drawingml.diagramColors+xml',
    ],
    [
      '/ppt/embeddings/feature-data.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
    ['/ppt/media/feature.wav', 'audio/wav'],
    ['/ppt/media/poster.png', 'image/png'],
  ]
  zip.file(
    '[Content_Types].xml',
    (await zip.file('[Content_Types].xml').async('string')).replace(
      '</Types>',
      types.map(([name, type]) => `<Override PartName="${name}" ContentType="${type}"/>`).join('') +
        '</Types>'
    )
  )
  const coreName = 'docProps/core.xml'
  zip.file(
    coreName,
    (await zip.file(coreName).async('string')).replace(
      /<dcterms:(created|modified)\b[^>]*>[^<]*<\/dcterms:\1>/g,
      '<dcterms:$1 xsi:type="dcterms:W3CDTF">2000-01-01T00:00:00Z</dcterms:$1>'
    )
  )
  const buffer = await stableZip(zip)
  return { buffer, catalogue: await inspectFeatureFixture(buffer) }
}

/** Read the actual package XML; missing or unrecognised source evidence fails closed. */
export async function inspectFeatureFixture(buffer) {
  const zip = await JSZip.loadAsync(buffer, { checkCRC32: true })
  const documents = new Map()
  async function document(name) {
    if (documents.has(name)) return documents.get(name)
    const file = zip.file(name)
    if (!file) throw new Error(`Missing source part: ${name}`)
    const errors = []
    const doc = new DOMParser({
      onError: (level, message) => errors.push(`${level}: ${message}`),
    }).parseFromString(await file.async('string'), 'application/xml')
    if (errors.length) throw new Error(`Invalid source XML: ${name}: ${errors.join('; ')}`)
    documents.set(name, doc)
    return doc
  }
  const slidePart = 'ppt/slides/slide1.xml'
  const slide = await document(slidePart)
  const elements = (doc, namespace, tag) => Array.from(doc.getElementsByTagNameNS(namespace, tag))
  const features = []
  function feature(id, sourceParts, evidence) {
    if (!evidence) throw new Error(`Missing source feature: ${id}`)
    features.push({ id, sourceParts, qualification: 'unverified' })
  }
  const presentation = await document('ppt/presentation.xml')
  const size = elements(presentation, P, 'sldSz')[0]
  feature(
    'geometry',
    ['ppt/presentation.xml', slidePart],
    size && elements(slide, A, 'off').some((node) => Number(node.getAttribute('x')) < 0)
  )
  feature(
    'mixed-text',
    [slidePart],
    ['1200', '2400'].every((size) =>
      elements(slide, A, 'rPr').some((run) => run.getAttribute('sz') === size)
    )
  )
  feature('nested-group', [slidePart], elements(slide, P, 'grpSp').length === 2)
  feature(
    'rich-merged-table',
    [slidePart],
    elements(slide, A, 'tc').some((cell) => cell.getAttribute('gridSpan') === '2')
  )
  const chartPart = 'ppt/charts/chart1.xml'
  const chart = await document(chartPart)
  const workbookPart = 'ppt/embeddings/feature-data.xlsx'
  if (!zip.file(workbookPart)) throw new Error(`Missing source part: ${workbookPart}`)
  const workbook = await JSZip.loadAsync(await zip.file(workbookPart).async('nodebuffer'), {
    checkCRC32: true,
  })
  const sheetFile = workbook.file('xl/worksheets/sheet1.xml')
  if (!sheetFile) throw new Error('Missing source part: xl/worksheets/sheet1.xml')
  const sheet = new DOMParser().parseFromString(await sheetFile.async('string'), 'application/xml')
  feature(
    'chart-workbook',
    [slidePart, chartPart, 'ppt/charts/_rels/chart1.xml.rels', workbookPart],
    elements(chart, C, 'barChart').length === 1 &&
      elements(sheet, S, 'c').length === 6 &&
      elements(sheet, S, 'f').length === 0
  )
  const diagramSource = ['data1.xml', 'layout1.xml', 'quickStyle1.xml', 'colors1.xml'].map(
    (name) => `ppt/diagrams/${name}`
  )
  const diagramDocuments = await Promise.all(diagramSource.map(document))
  const diagramNodes = elements(diagramDocuments[0], D, 'pt').filter(
    (point) => point.getAttribute('type') === 'node'
  )
  feature(
    'diagram-51',
    [slidePart, ...diagramSource],
    diagramNodes.length === 51 &&
      elements(diagramDocuments[1], D, 'alg').length > 0 &&
      elements(diagramDocuments[2], D, 'styleLbl').length > 0 &&
      elements(diagramDocuments[3], D, 'styleLbl').length > 0
  )
  feature(
    'omml',
    [slidePart],
    elements(slide, M, 'f').length === 1 && elements(slide, M, 'mr').length === 2
  )
  await document('ppt/slides/_rels/slide1.xml.rels')
  feature(
    'media-timing-links',
    [slidePart, 'ppt/slides/_rels/slide1.xml.rels', 'ppt/media/feature.wav'],
    zip.file('ppt/media/feature.wav') &&
      elements(slide, P, 'timing').length === 1 &&
      elements(slide, A, 'hlinkClick').length === 2
  )
  feature(
    'excluded-metadata',
    [slidePart],
    elements(slide, P, 'oleObj').length === 1 &&
      elements(slide, 'http://schemas.microsoft.com/office/drawing/2017/model3d', 'model3d')
        .length === 1
  )
  return {
    id: 'source-authored-semantic-features',
    sha256: createHash('sha256').update(buffer).digest('hex'),
    dimensionsEmu: {
      width: Number(size.getAttribute('cx')),
      height: Number(size.getAttribute('cy')),
    },
    requiredFonts: [
      ...new Set(elements(slide, A, 'latin').map((font) => font.getAttribute('typeface'))),
    ].sort(),
    diagramNodeCount: diagramNodes.length,
    features,
    excluded: ['ole', '3d'],
    nativeReference: null,
  }
}
