const fs = require('fs-extra')
const path = require('node:path')
const JSZip = require('jszip')
const crypto = require('node:crypto')
const { collectGameMediaReferences } = require('revealjs-shared')
const { PROJECT_IMPORT_LIMITS } = require('./project-import-archive-limits')
const { buildLegacyMediaInventory } = require('./project-import-legacy-media')
const { collectMediaUrls } = require('./project-import-presentation')
const { assertVersionEntries, entryReader, inspectRawEntries } = require('./project-import-archive-entries')
const { readPortableArchive, stagePortableArchive } = require('./project-import-archive-v2')
const { localMediaFilename, validateMediaPayload, validateV2MediaInventory } = require('./project-import-archive-media')
const { activeContentInventory, digest, importError, inspectPresentation } = require('./project-import-archive-validation')



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
  const declaredUrls = new Set(media.map((item) => item.originalUrl))
  if (collectGameMediaReferences(presentation).some((ref) =>
    ref.kind === 'native' && localMediaFilename(ref.url, manifest.sourceOrigin) &&
      !declaredUrls.has(ref.url))) {
    throw importError('PROJECT_MEDIA_INVENTORY_MISMATCH', 'Native game media inventory is incomplete')
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
    zip = await JSZip.loadAsync(bytes, { checkCRC32: false })
  } catch {
    throw importError('PROJECT_ARCHIVE_INVALID', 'Archive is not a readable ZIP')
  }
  const read = entryReader(zip, entries, limits)
  const manifestBytes = await read('manifest.json', limits.maxJsonBytes)
  const presentationBytes = await read('presentation.json', limits.maxJsonBytes)
  let manifest
  let presentation
  try {
    manifest = JSON.parse(manifestBytes.toString('utf8'))
    presentation = JSON.parse(presentationBytes.toString('utf8'))
  } catch {
    throw importError('PROJECT_JSON_INVALID', 'Project JSON is invalid')
  }
  const packageBacked = manifest?.version === '2.0'
  assertVersionEntries(entries, limits, packageBacked)
  const portable = packageBacked ? await readPortableArchive(read, entries, presentation, limits) : null
  if (portable) presentation = portable.presentation
  const projections = [presentation, ...(portable?.mediaProjections || [])]
  const mediaManifest = packageBacked ? validateV2MediaInventory(manifest, entries, limits, projections)
    : validateManifest(manifest, entries, limits, presentation)
  inspectPresentation(presentation, limits)
  const activeContent = [...new Set(projections.flatMap(activeContentInventory))].sort()
  if (activeContent.length && options.trustedAuthorActiveContentAcknowledged !== true) {
    throw importError('ACTIVE_CONTENT_ACK_REQUIRED', 'Trusted author acknowledgement is required', 409, { activeContent })
  }
  if (!packageBacked && zip.file('presentation.html')) await read('presentation.html')
  const payloads = []
  for (const item of mediaManifest) {
    const data = await read(item.archivePath)
    const sha256 = await validateMediaPayload(item, data, { packageBacked })
    payloads.push({ item, data, sha256 })
  }
  // No filesystem side effects until every package, media and active-content guard succeeds.
  await fs.ensureDir(options.stagingDir)
  const media = []
  for (const { item, data, sha256 } of payloads) {
    const stagingPath = path.join(options.stagingDir, `${media.length}-${path.basename(item.archivePath)}`)
    await fs.writeFile(stagingPath, data, { flag: 'wx', mode: 0o600 })
    media.push({ ...item, byteLength: data.length, sha256, stagingPath })
  }
  const packageFields = portable ? await stagePortableArchive(portable, options.stagingDir) : {}
  const payloadHash = crypto.createHash('sha256').update(manifestBytes).update(Buffer.from([0])).update(presentationBytes)
  if (portable) payloadHash.update(Buffer.from([0])).update(portable.manifestBytes)
  return {
    archiveDigest: digest(bytes),
    payloadDigest: payloadHash.digest('hex'),
    manifest,
    presentation,
    media,
    ...packageFields,
    activeContent,
    warnings: manifest.version === '1.0' ? ['Imported legacy project archive version 1.0'] : [],
    trustedAuthorActiveContentAcknowledged: options.trustedAuthorActiveContentAcknowledged === true,
  }
}

module.exports = { PROJECT_IMPORT_LIMITS, validateProjectArchive }
