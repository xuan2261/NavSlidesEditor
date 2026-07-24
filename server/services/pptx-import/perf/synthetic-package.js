/**
 * Synthetic PPTX builders for perf ladder (license-safe, project-owned).
 * Size/entry ladders pad with STORE-compressed opaque parts — not real media.
 */
const JSZip = require('jszip')

const MINIMAL_CONTENT_TYPES =
  '<?xml version="1.0" encoding="UTF-8"?>' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Override PartName="/ppt/presentation.xml" ' +
  'ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>' +
  '</Types>'

const MINIMAL_PRESENTATION =
  '<?xml version="1.0" encoding="UTF-8"?>' +
  '<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
  '<p:sldIdLst/><p:sldSz cx="12192000" cy="6858000"/></p:presentation>'

const PRESENTATION_RELS =
  '<?xml version="1.0" encoding="UTF-8"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>'

async function basePackageZip() {
  const zip = new JSZip()
  zip.file('[Content_Types].xml', MINIMAL_CONTENT_TYPES)
  zip.file('ppt/presentation.xml', MINIMAL_PRESENTATION)
  zip.file('ppt/_rels/presentation.xml.rels', PRESENTATION_RELS)
  return zip
}

/** Minimal valid PPTX for always-on timer tests (~few KB). */
async function buildTinyPptx() {
  const zip = await basePackageZip()
  return zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' })
}

/**
 * Build a package with approximately `entryCount` ZIP entries.
 * Always includes required Content_Types + presentation (+ rels).
 */
async function buildEntryLadderPackage({ entryCount = 50 } = {}) {
  const target = Math.max(3, Math.floor(entryCount))
  const zip = await basePackageZip()
  let current = 3
  let index = 0
  while (current < target) {
    zip.file(`ppt/media/pad-${index}.bin`, Buffer.alloc(16, index % 256))
    index += 1
    current += 1
  }
  return zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' })
}

/**
 * Build a package targeting ~targetBytes compressed size (STORE pad).
 * Caps pad work so CI never materializes multi-hundred-MiB unless caller asks.
 */
async function buildSizeLadderPackage({ targetBytes = 1024 * 1024, maxPadBytes = 12 * 1024 * 1024 } = {}) {
  const zip = await basePackageZip()
  const pad = Math.min(Math.max(0, Math.floor(targetBytes) - 2048), maxPadBytes)
  if (pad > 0) {
    // Chunk large pads so JSZip does not hold one giant contiguous string path.
    const chunkSize = 1024 * 1024
    let remaining = pad
    let index = 0
    while (remaining > 0) {
      const size = Math.min(chunkSize, remaining)
      zip.file(`ppt/media/size-pad-${index}.bin`, Buffer.alloc(size, 0x41))
      remaining -= size
      index += 1
    }
  }
  return zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' })
}

const SIZE_LADDER_MIB = Object.freeze([1, 10, 50, 100])
const ENTRY_LADDER = Object.freeze([50, 500, 5000])

module.exports = {
  ENTRY_LADDER,
  SIZE_LADDER_MIB,
  buildEntryLadderPackage,
  buildSizeLadderPackage,
  buildTinyPptx,
}
