const path = require('node:path')
const { collectMediaUrls } = require('./project-import-presentation')
const { assertArchivePath, digest, importError } = require('./project-import-archive-validation')

function localMediaFilename(url, origin) {
  if (typeof url !== 'string') return null
  let pathname
  if (url.startsWith('/uploads/')) pathname = url.split(/[?#]/u, 1)[0]
  else if (origin) {
    let parsed
    try { parsed = new URL(url) } catch { return null }
    if (parsed.origin !== origin) return null
    pathname = parsed.pathname
  } else return null
  if (!pathname.startsWith('/uploads/')) return null
  let filename
  try { filename = decodeURIComponent(pathname.slice('/uploads/'.length)) } catch {
    throw importError('PROJECT_MEDIA_URL_INVALID', 'Local media URL is invalid')
  }
  if (!filename || path.basename(filename) !== filename || /[/\\:\x00-\x1f\x7f]/u.test(filename) || /[. ]$/u.test(filename) || ['.', '..'].includes(filename)) {
    throw importError('PROJECT_MEDIA_URL_INVALID', 'Local media URL is invalid')
  }
  return filename
}

function mediaUrls(presentations) {
  return [...new Set(presentations.flatMap(collectMediaUrls))]
}

function externalMediaInventory(urls, declaredUrls) {
  return urls.filter((url) => !declaredUrls.has(url)).sort()
    .map((url) => ({ url, type: 'external-media' }))
}

function validateV2MediaInventory(manifest, entries, limits, presentations) {
  if (!Array.isArray(manifest.media) || manifest.media.length > limits.maxMedia || !Array.isArray(manifest.externalLinks)) {
    throw importError('PROJECT_MANIFEST_INVALID', 'Portable media inventory is invalid')
  }
  if (manifest.sourceOrigin !== undefined) {
    let origin
    try { origin = new URL(manifest.sourceOrigin) } catch { throw importError('PROJECT_MANIFEST_INVALID', 'Portable source origin is invalid') }
    if (!['http:', 'https:'].includes(origin.protocol) || origin.origin !== manifest.sourceOrigin) {
      throw importError('PROJECT_MANIFEST_INVALID', 'Portable source origin is invalid')
    }
  }
  const urls = mediaUrls(presentations), referenced = new Set(urls), declared = new Set(), paths = new Set()
  for (const item of manifest.media) {
    if (!item || typeof item.originalUrl !== 'string' || !referenced.has(item.originalUrl) ||
        typeof item.archivePath !== 'string' || !item.archivePath.startsWith('media/') ||
        !Number.isSafeInteger(item.byteLength) || item.byteLength < 0 || item.byteLength > limits.maxEntryBytes ||
        !/^[a-f0-9]{64}$/u.test(item.sha256 || '') ||
        (item.mimeType != null && typeof item.mimeType !== 'string')) {
      throw importError('PROJECT_MANIFEST_INVALID', 'Portable media descriptor is invalid')
    }
    assertArchivePath(item.archivePath, limits, { packageBacked: true })
    if (declared.has(item.originalUrl) || paths.has(item.archivePath)) {
      throw importError('PROJECT_MEDIA_INVENTORY_MISMATCH', 'Portable media descriptors must be unique')
    }
    // Only owned local upload references may be embedded; absolute source URLs require their declared source origin.
    const filename = localMediaFilename(item.originalUrl, manifest.sourceOrigin)
    if (!filename) throw importError('PROJECT_MANIFEST_INVALID', 'Portable media must refer to local uploads')
    declared.add(item.originalUrl); paths.add(item.archivePath)
  }
  const actual = entries.filter((entry) => entry.name.startsWith('media/') && !entry.name.endsWith('/')).map((entry) => entry.name)
  if (actual.length !== paths.size || actual.some((name) => !paths.has(name)) ||
      urls.some((url) => localMediaFilename(url, manifest.sourceOrigin) && !declared.has(url))) {
    throw importError('PROJECT_MEDIA_INVENTORY_MISMATCH', 'Portable local media inventory is incomplete')
  }
  const expected = externalMediaInventory(urls, declared)
  const actualLinks = manifest.externalLinks
  if (actualLinks.length !== expected.length || actualLinks.some((item, index) =>
    !item || item.url !== expected[index].url || item.type !== expected[index].type || Object.keys(item).length !== 2)) {
    throw importError('PROJECT_EXTERNAL_LINKS_MISMATCH', 'Portable external media inventory does not match authority')
  }
  return manifest.media
}

async function validateMediaPayload(item, data, { packageBacked = false } = {}) {
  const signature = data.subarray(0, 4).toString('binary')
  if (signature.startsWith('MZ') || ['PK\u0003\u0004', 'PK\u0005\u0006', 'PK\u0007\u0008'].includes(signature)) {
    throw importError('PROJECT_MEDIA_TYPE_REJECTED', 'Archive media payload is not allowed')
  }
  if (item.byteLength != null && item.byteLength !== data.length) throw importError('PROJECT_MEDIA_SIZE_MISMATCH', 'Media byte length does not match manifest')
  const sha256 = digest(data)
  if (item.sha256 && item.sha256.toLowerCase() !== sha256) throw importError('PROJECT_MEDIA_HASH_MISMATCH', 'Media digest does not match manifest')
  const extension = path.extname(item.archivePath).toLowerCase()
  if (['.emf', '.wmf'].includes(extension)) {
    const matches = extension === '.emf' ? data.length >= 4 && data.readUInt32LE(0) === 1
      : data.length >= 4 && data.readUInt32LE(0) === 0x9ac6cdd7
    if (!packageBacked || !matches || item.mimeType !== `image/x-${extension.slice(1)}` || item.browserSupport !== 'limited') {
      throw importError('PROJECT_MEDIA_TYPE_REJECTED', 'Preserved metafile MIME, extension or signature is invalid')
    }
  } else if (item.mimeType) {
    const { fileTypeFromBuffer } = await import('file-type')
    let detected
    try { detected = await fileTypeFromBuffer(data) } catch (error) {
      if (!['EndOfStreamError', 'EOFError'].includes(error?.name)) throw error
    }
    if (detected && detected.mime !== item.mimeType) throw importError('PROJECT_MEDIA_MIME_MISMATCH', 'Media MIME type does not match manifest')
  }
  return sha256
}

module.exports = { externalMediaInventory, localMediaFilename, mediaUrls, validateMediaPayload, validateV2MediaInventory }
