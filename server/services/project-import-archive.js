const fs = require('fs-extra')
const path = require('node:path')
const JSZip = require('jszip')
const { parseRawEntries } = require('./pptx-import/package-store/raw-zip')
const { PROJECT_IMPORT_LIMITS } = require('./project-import-archive-limits')
const {
  buildLegacyMediaInventory,
  collectMediaUrls,
} = require('./project-import-legacy-media')
const {
  activeContentInventory,
  assertArchivePath,
  digest,
  importError,
  inspectPresentation,
} = require('./project-import-archive-validation')

function inspectRawEntries(bytes, limits) {
  let entries
  try {
    entries = parseRawEntries(bytes)
  } catch {
    throw importError('PROJECT_ARCHIVE_STRUCTURE_INVALID', 'Archive structure is invalid')
  }
  if (entries.length > limits.maxEntries) {
    throw importError('PROJECT_ARCHIVE_ENTRY_LIMIT', 'Archive has too many entries', 413)
  }
  let declared = 0
  for (const entry of entries) {
    if (entry.name.endsWith('/')) {
      if (entry.name !== 'media/') {
        throw importError('PROJECT_ARCHIVE_ENTRY_REJECTED', 'Archive contains an unexpected directory')
      }
      continue
    }
    assertArchivePath(entry.name, limits)
    const offset = entry.centralHeaderOffset
    const method = bytes.readUInt16LE(offset + 10)
    const externalAttributes = bytes.readUInt32LE(offset + 38)
    const unixType = (externalAttributes >>> 16) & 0xf000
    if (entry.encrypted || unixType === 0xa000 || ![0, 8].includes(method)) {
      throw importError('PROJECT_ARCHIVE_ENTRY_REJECTED', 'Archive contains an unsupported entry')
    }
    if (entry.uncompressedSize > limits.maxEntryBytes ||
        entry.uncompressedSize / Math.max(entry.compressedSize, 1) > limits.maxCompressionRatio) {
      throw importError('PROJECT_ARCHIVE_RATIO_LIMIT', 'Archive entry exceeds expansion policy', 413)
    }
    declared += entry.uncompressedSize
  }
  if (declared > limits.maxDeclaredBytes) {
    throw importError('PROJECT_ARCHIVE_EXPANSION_LIMIT', 'Archive exceeds expansion policy', 413)
  }
  return entries
}

async function readEntry(entry, budget, limit) {
  if (!entry) {
    throw importError('PROJECT_ARCHIVE_REQUIRED_ENTRY_MISSING', 'Archive is missing a required entry')
  }
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    const stream = entry.nodeStream('nodebuffer')
    stream.on('data', (chunk) => {
      size += chunk.length
      budget.used += chunk.length
      if (size > limit || budget.used > budget.max) {
        stream.destroy()
        reject(importError('PROJECT_ARCHIVE_EXPANSION_LIMIT', 'Archive exceeds expansion policy', 413))
      } else chunks.push(Buffer.from(chunk))
    })
    stream.on('end', () => resolve(Buffer.concat(chunks, size)))
    stream.on('error', () => reject(importError('PROJECT_ARCHIVE_INVALID', 'Archive cannot be expanded')))
  })
}

function validateManifest(manifest, entries, limits, presentation) {
  if (!manifest || !['1.0', '1.1'].includes(manifest.version)) {
    throw importError('PROJECT_MANIFEST_INVALID', 'Manifest version must be 1.0 or 1.1')
  }
  const actualPaths = entries
    .filter((item) => item.name.startsWith('media/') && !item.name.endsWith('/'))
    .map((item) => item.name)
  const media = manifest.version === '1.0' && !Array.isArray(manifest.media)
    ? buildLegacyMediaInventory(presentation, actualPaths)
    : Array.isArray(manifest.media) ? manifest.media : []
  if (media.length > limits.maxMedia) {
    throw importError('PROJECT_MEDIA_LIMIT', 'Archive has too many media entries', 413)
  }
  const declared = new Set()
  const referencedUrls = new Set(collectMediaUrls(presentation))
  for (const item of media) {
    if (!item || typeof item.archivePath !== 'string' || !item.archivePath.startsWith('media/') ||
        typeof item.originalUrl !== 'string' || !referencedUrls.has(item.originalUrl) ||
        (item.byteLength != null && (!Number.isSafeInteger(item.byteLength) || item.byteLength < 0)) ||
        (item.sha256 != null && !/^[a-f0-9]{64}$/iu.test(item.sha256)) ||
        (item.mimeType != null && typeof item.mimeType !== 'string')) {
      throw importError('PROJECT_MANIFEST_INVALID', 'Manifest media entry is invalid')
    }
    if (declared.has(item.archivePath)) {
      throw importError('PROJECT_MEDIA_INVENTORY_MISMATCH', 'Manifest media paths must be unique')
    }
    declared.add(item.archivePath)
  }
  const actual = new Set(actualPaths)
  if (declared.size !== actual.size || [...declared].some((name) => !actual.has(name))) {
    throw importError('PROJECT_MEDIA_INVENTORY_MISMATCH', 'Manifest media inventory does not match archive')
  }
  return media
}

async function validateProjectArchive(filePath, options = {}) {
  const limits = { ...PROJECT_IMPORT_LIMITS, ...(options.limits || {}) }
  const stat = await fs.stat(filePath)
  if (stat.size > limits.maxCompressedBytes) {
    throw importError('PROJECT_ARCHIVE_COMPRESSED_LIMIT', 'Archive is too large', 413)
  }
  const bytes = await fs.readFile(filePath)
  const entries = inspectRawEntries(bytes, limits)
  let zip
  try {
    zip = await JSZip.loadAsync(bytes, { checkCRC32: true })
  } catch {
    throw importError('PROJECT_ARCHIVE_INVALID', 'Archive is not a readable ZIP')
  }
  const budget = { used: 0, max: limits.maxExpandedBytes }
  const manifestBytes = await readEntry(zip.file('manifest.json'), budget, limits.maxJsonBytes)
  const presentationBytes = await readEntry(zip.file('presentation.json'), budget, limits.maxJsonBytes)
  let manifest
  let presentation
  try {
    manifest = JSON.parse(manifestBytes.toString('utf8'))
    presentation = JSON.parse(presentationBytes.toString('utf8'))
  } catch {
    throw importError('PROJECT_JSON_INVALID', 'Project JSON is invalid')
  }
  const mediaManifest = validateManifest(manifest, entries, limits, presentation)
  inspectPresentation(presentation, limits)
  const activeContent = activeContentInventory(presentation)
  if (activeContent.length && options.trustedAuthorActiveContentAcknowledged !== true) {
    throw importError('ACTIVE_CONTENT_ACK_REQUIRED', 'Trusted author acknowledgement is required', 409, { activeContent })
  }
  await fs.ensureDir(options.stagingDir)
  const media = []
  for (const item of mediaManifest) {
    const data = await readEntry(zip.file(item.archivePath), budget, limits.maxEntryBytes)
    const signature = data.subarray(0, 4).toString('binary')
    if (signature.startsWith('MZ') || signature === 'PK\u0003\u0004') {
      throw importError('PROJECT_MEDIA_TYPE_REJECTED', 'Archive media payload is not allowed')
    }
    if (item.byteLength != null && item.byteLength !== data.length) {
      throw importError('PROJECT_MEDIA_SIZE_MISMATCH', 'Media byte length does not match manifest')
    }
    const sha256 = digest(data)
    if (item.sha256 && item.sha256.toLowerCase() !== sha256) {
      throw importError('PROJECT_MEDIA_HASH_MISMATCH', 'Media digest does not match manifest')
    }
    if (item.mimeType) {
      try {
        const { fileTypeFromBuffer } = await import('file-type')
        const detected = await fileTypeFromBuffer(data)
        if (detected && detected.mime !== item.mimeType) {
          throw importError('PROJECT_MEDIA_MIME_MISMATCH', 'Media MIME type does not match manifest')
        }
      } catch (error) {
        if (error?.code === 'PROJECT_MEDIA_MIME_MISMATCH') throw error
      }
    }
    const stagingPath = path.join(options.stagingDir, `${media.length}-${path.basename(item.archivePath)}`)
    await fs.writeFile(stagingPath, data)
    media.push({ ...item, byteLength: data.length, sha256, stagingPath })
  }
  return {
    archiveDigest: digest(bytes),
    payloadDigest: digest(Buffer.concat([manifestBytes, Buffer.from([0]), presentationBytes])),
    manifest,
    presentation,
    media,
    activeContent,
    warnings: manifest.version === '1.0' ? ['Imported legacy project archive version 1.0'] : [],
    trustedAuthorActiveContentAcknowledged: options.trustedAuthorActiveContentAcknowledged === true,
  }
}

module.exports = { PROJECT_IMPORT_LIMITS, validateProjectArchive }
