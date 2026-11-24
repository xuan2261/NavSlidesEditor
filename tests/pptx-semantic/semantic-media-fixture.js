import JSZip from 'jszip'
import PptxGenJS from 'pptxgenjs'
const P = 'http://schemas.openxmlformats.org/presentationml/2006/main'
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const P14 = 'http://schemas.microsoft.com/office/powerpoint/2010/main'

function waveBuffer(durationSeconds) {
  const dataBytes = Math.max(1, Math.round(durationSeconds * 8000)) * 2
  const buffer = Buffer.alloc(44 + dataBytes)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataBytes, 4)
  buffer.write('WAVEfmt ', 8)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(8000, 24)
  buffer.writeUInt32LE(16000, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataBytes, 40)
  return buffer
}

export async function createSemanticMediaFixture({ external = false, externalLinkOnly = false, malformedTrim = false, trimEnd = '250.25', durationSeconds = 0, mediaType = 'audio' } = {}) {
  const deck = new PptxGenJS()
  deck.layout = 'LAYOUT_WIDE'
  deck.addSlide()
  const zip = await JSZip.loadAsync(await deck.write({ outputType: 'nodebuffer' }))
  const filename = mediaType === 'video' ? 'video.mp4' : 'audio.wav'
  const trim = malformedTrim ? 'st="-1"' : `st="1000.5" end="${trimEnd}"`
  const embeddedDeclaration = externalLinkOnly
    ? ''
    : `<p:extLst><p:ext uri="{DAA4B4D4-4CA0-4E4C-86DA-21E03BF9A436}"><p14:media r:embed="rIdMedia"><p14:trim ${trim}/></p14:media></p:ext></p:extLst>`
  zip.file(
    'ppt/slides/slide1.xml',
    `<p:sld xmlns:p="${P}" xmlns:a="${A}" xmlns:r="${R}" xmlns:p14="${P14}"><p:cSld><p:spTree><p:pic><p:nvPicPr><p:cNvPr id="2" name="Authored ${mediaType}"/><p:cNvPicPr/><p:nvPr><a:${mediaType}File r:link="rIdLegacy"/>${embeddedDeclaration}</p:nvPr></p:nvPicPr><p:blipFill><a:blip r:embed="rIdPoster"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="914400" y="914400"/><a:ext cx="914400" cy="457200"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic></p:spTree></p:cSld></p:sld>`
  )
  const relsPath = 'ppt/slides/_rels/slide1.xml.rels'
  const original = await zip.file(relsPath).async('string')
  const blockedExternal = external || externalLinkOnly
  const target = blockedExternal ? `https://blocked.invalid/${filename}` : `../media/${filename}`
  const mode = blockedExternal ? ' TargetMode="External"' : ''
  const relations = [
    `<Relationship Id="rIdLegacy" Type="${R}/${mediaType}" Target="${target}"${mode}/>` ,
    ...(externalLinkOnly
      ? []
      : [`<Relationship Id="rIdMedia" Type="http://schemas.microsoft.com/office/2007/relationships/media" Target="${target}"${mode}/>`]),
    `<Relationship Id="rIdPoster" Type="${R}/image" Target="../media/poster.png"/>`,
  ].join('')
  zip.file(relsPath, original.replace('</Relationships>', `${relations}</Relationships>`))
  if (!external && !externalLinkOnly) zip.file(`ppt/media/${filename}`, mediaType === 'audio'
    ? waveBuffer(durationSeconds)
    // Signature-only admission fixture, not a browser-playback qualification clip.
    : Buffer.from([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0, 0, 2, 0, 0x69, 0x73, 0x6f, 0x6d, 0x69, 0x73, 0x6f, 0x32]))
  zip.file(
    'ppt/media/poster.png',
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=',
      'base64'
    )
  )
  const types = '[Content_Types].xml'
  zip.file(
    types,
    (await zip.file(types).async('string')).replace(
      '</Types>',
      `${external || externalLinkOnly ? '' : `<Override PartName="/ppt/media/${filename}" ContentType="${mediaType === 'audio' ? 'audio/wav' : 'video/mp4'}"/>`}<Override PartName="/ppt/media/poster.png" ContentType="image/png"/></Types>`
    )
  )
  for (const name of Object.keys(zip.files).filter((n) => n.endsWith('.rels'))) {
    zip.file(
      name,
      (await zip.file(name).async('string'))
        .replace(/<Relationship\b[^>]*Type="[^"]*\/notes(?:Slide|Master)"[^>]*\/>/g, '')
    )
  }
  zip.file(
    'ppt/presentation.xml',
    (await zip.file('ppt/presentation.xml').async('string')).replace(
      /<p:notesMasterIdLst>[\s\S]*?<\/p:notesMasterIdLst>/g,
      ''
    )
  )
  return zip
}
