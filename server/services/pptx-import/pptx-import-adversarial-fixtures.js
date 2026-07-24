/**
 * Synthetic adversarial PPTX fixtures (license-safe, project-owned).
 * Kept small for the isolated adversarial lane — never mixed into metrics averages.
 */
const JSZip = require('jszip')

const MINIMAL_CONTENT_TYPES = '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'
const MINIMAL_PRESENTATION = '<?xml version="1.0"?><p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>'

function corruptZipCrc(bytes) {
  const corrupted = Buffer.from(bytes)
  for (let offset = 0; offset < corrupted.length - 4; offset += 1) {
    if (corrupted.readUInt32LE(offset) === 0x02014b50) {
      corrupted.writeUInt32LE((corrupted.readUInt32LE(offset + 16) + 1) >>> 0, offset + 16)
    }
    if (corrupted.readUInt32LE(offset) === 0x04034b50) {
      corrupted.writeUInt32LE((corrupted.readUInt32LE(offset + 14) + 1) >>> 0, offset + 14)
    }
  }
  return corrupted
}

async function baseZip(extra = {}) {
  const zip = new JSZip()
  zip.file('[Content_Types].xml', MINIMAL_CONTENT_TYPES)
  zip.file('ppt/presentation.xml', MINIMAL_PRESENTATION)
  for (const [name, content] of Object.entries(extra)) zip.file(name, content)
  return zip
}

async function buildGoodPackage() {
  return (await baseZip()).generateAsync({ type: 'nodebuffer', compression: 'STORE' })
}

async function buildBadCrcPackage() {
  return corruptZipCrc(await buildGoodPackage())
}

async function buildMalformedXmlPackage() {
  const zip = await baseZip({
    'ppt/slides/slide1.xml': '<!DOCTYPE a [<!ELEMENT a ANY>]><a/>',
  })
  return zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' })
}

async function buildNestedPackage(depth = 4) {
  let nested = Buffer.from('leaf-payload')
  for (let level = 0; level < depth; level += 1) {
    const inner = new JSZip()
    inner.file(`level-${level}.bin`, nested)
    nested = await inner.generateAsync({ type: 'nodebuffer', compression: 'STORE' })
  }
  const zip = await baseZip({ 'ppt/embeddings/nested.pptx': nested })
  return zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' })
}

async function buildExternalRelPackage() {
  const rels = [
    '<?xml version="1.0"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image"',
    ' Target="https://evil.example.test/remote.png" TargetMode="External"/>',
    '</Relationships>',
  ].join('')
  const zip = await baseZip({
    'ppt/slides/_rels/slide1.xml.rels': rels,
    'ppt/slides/slide1.xml': '<sld/>',
  })
  return zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' })
}

async function buildEmfStubPackage() {
  // Minimal EMF-ish header bytes (not a real Office binary); exercises vector classification.
  const emf = Buffer.from([0x01, 0x00, 0x00, 0x00, 0x58, 0x00, 0x00, 0x00, ...Buffer.alloc(24, 0)])
  const zip = await baseZip({ 'ppt/media/image1.emf': emf })
  return zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' })
}

async function buildSmartArtStubPackage() {
  const zip = await baseZip({
    'ppt/diagrams/data1.xml': '<dgm:dataModel xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram"/>',
    'ppt/diagrams/layout1.xml': '<dgm:layoutDef xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram"/>',
  })
  return zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' })
}

async function buildMacroOleStubPackage() {
  const zip = await baseZip({
    'ppt/vbaProject.bin': Buffer.from('VBA-STUB'),
    'ppt/embeddings/oleObject1.bin': Buffer.from('OLE-STUB'),
  })
  return zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' })
}

async function buildRtlCjkSmokePackage() {
  const slide = [
    '<?xml version="1.0"?>',
    '<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"',
    ' xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">',
    '<p:cSld><p:spTree><p:sp><p:txBody><a:p>',
    '<a:r><a:t>مرحبا שלום 你好 日本語</a:t></a:r>',
    '</a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>',
  ].join('')
  const zip = await baseZip({ 'ppt/slides/slide1.xml': slide })
  return zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' })
}

async function buildNotesCommentsPackage() {
  const zip = await baseZip({
    'ppt/notesSlides/notesSlide1.xml': '<p:notes xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>',
    'ppt/comments/comment1.xml': '<p:cm xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>',
    'ppt/slides/_rels/slide1.xml.rels': [
      '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide"',
      ' Target="../notesSlides/notesSlide1.xml"/>',
      '</Relationships>',
    ].join(''),
  })
  return zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' })
}

const FIXTURE_BUILDERS = Object.freeze({
  'good-package.pptx': buildGoodPackage,
  'bad-crc.pptx': buildBadCrcPackage,
  'malformed-xml.pptx': buildMalformedXmlPackage,
  'nested-package.pptx': buildNestedPackage,
  'external-rel.pptx': buildExternalRelPackage,
  'emf-stub.pptx': buildEmfStubPackage,
  'smartart-stub.pptx': buildSmartArtStubPackage,
  'macro-ole-stub.pptx': buildMacroOleStubPackage,
  'rtl-cjk-smoke.pptx': buildRtlCjkSmokePackage,
  'notes-comments.pptx': buildNotesCommentsPackage,
})

async function materializeFixtures(directory, fs = require('node:fs/promises'), path = require('node:path')) {
  await fs.mkdir(directory, { recursive: true })
  const written = []
  for (const [name, builder] of Object.entries(FIXTURE_BUILDERS)) {
    const bytes = await builder()
    const filePath = path.join(directory, name)
    await fs.writeFile(filePath, bytes)
    written.push({ name, bytes: bytes.length, path: filePath })
  }
  return written
}

module.exports = {
  FIXTURE_BUILDERS,
  buildBadCrcPackage,
  buildEmfStubPackage,
  buildExternalRelPackage,
  buildGoodPackage,
  buildMacroOleStubPackage,
  buildMalformedXmlPackage,
  buildNestedPackage,
  buildNotesCommentsPackage,
  buildRtlCjkSmokePackage,
  buildSmartArtStubPackage,
  corruptZipCrc,
  materializeFixtures,
}
