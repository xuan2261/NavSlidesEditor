const path = require('node:path')
const fs = require('node:fs/promises')
const { constants } = require('node:fs')
const { UPLOADS_DIR, UPLOAD_HASHES_FILE, withFileLock } = require('../services/storage')
const { getUploadMimeType } = require('./presentations-helpers')
const { assertArchivePath, digest, importError } = require('../services/project-import-archive-validation')
const { externalMediaInventory, localMediaFilename, mediaUrls, validateMediaPayload } = require('../services/project-import-archive-media')

async function readOwnership() {
  return withFileLock(UPLOAD_HASHES_FILE, async () => {
    try {
      const value = JSON.parse(await fs.readFile(UPLOAD_HASHES_FILE, 'utf8'))
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid upload ownership ledger')
      return value
    } catch (error) {
      if (error.code === 'ENOENT') return {}
      throw error
    }
  })
}

function ownedRecord(hashes, presentationId, filename) {
  const owned = Object.entries(hashes[presentationId] || {})
  const global = Object.entries(hashes.global || {}).filter(([, record]) => record?.state === undefined || record.state === 'committed')
  return [...owned, ...global].find(([, record]) => record?.filename === filename)
}

async function readLocalMedia(filename, budget, limits) {
  const absolute = path.join(UPLOADS_DIR, filename)
  let handle
  try {
    const stats = await fs.lstat(absolute)
    if (!stats.isFile() || stats.isSymbolicLink()) throw importError('PROJECT_EXPORT_MEDIA_UNOWNED', 'Media path is not an owned regular file', 422)
    handle = await fs.open(absolute, constants.O_RDONLY | (constants.O_NOFOLLOW || 0))
    const stat = await handle.stat()
    if (stat.size > limits.maxEntryBytes || stat.size > limits.maxExpandedBytes - budget.used) {
      throw importError('PROJECT_ARCHIVE_EXPANSION_LIMIT', 'Owned media exceeds archive byte policy', 413)
    }
    const chunks = []
    let size = 0
    const stream = handle.createReadStream({ autoClose: false })
    for await (const chunk of stream) {
      size += chunk.length
      if (size > limits.maxEntryBytes || size > limits.maxExpandedBytes - budget.used) {
        stream.destroy()
        throw importError('PROJECT_ARCHIVE_EXPANSION_LIMIT', 'Owned media exceeds archive byte policy', 413)
      }
      chunks.push(chunk)
    }
    budget.used += size
    return Buffer.concat(chunks, size)
  } catch (error) {
    if (error.code === 'ENOENT') throw importError('PROJECT_EXPORT_MEDIA_MISSING', 'Required owned local media is missing', 422)
    throw error
  } finally { if (handle) await handle.close() }
}

async function collectOwnedArchiveMedia(presentationId, projections, origin, limits, budget, assertCurrent) {
  const urls = mediaUrls(projections)
  const local = urls.map((url) => ({ url, filename: localMediaFilename(url, origin) })).filter((item) => item.filename)
  if (local.length > limits.maxMedia) throw importError('PROJECT_MEDIA_LIMIT', 'Archive has too many media entries', 413)
  const hashes = await readOwnership()
  assertCurrent()
  const media = [], payloads = []
  for (const { url, filename } of local) {
    const archivePath = `media/${media.length}-${filename}`
    assertArchivePath(archivePath, limits, { packageBacked: true })
    const bytes = await readLocalMedia(filename, budget, limits)
    assertCurrent()
    const owner = ownedRecord(hashes, presentationId, filename)
    if (!owner) throw importError('PROJECT_EXPORT_MEDIA_UNOWNED', 'Required local media has no committed upload ownership', 422)
    const [key, record] = owner
    const sha256 = digest(bytes), expectedHash = record.sha256 || (/^[a-f0-9]{64}$/u.test(key) ? key : null)
    if ((expectedHash && expectedHash !== sha256) || (record.size != null && record.size !== bytes.length)) {
      throw importError('PROJECT_EXPORT_MEDIA_CHANGED', 'Owned local media no longer matches its recorded bytes', 422)
    }
    const extension = path.extname(filename).toLowerCase()
    const metafile = ['.emf', '.wmf'].includes(extension)
    const item = { archivePath, filename, originalUrl: url, byteLength: bytes.length, sha256,
      mimeType: record.mimeType || getUploadMimeType(filename), ...(metafile ? { browserSupport: 'limited' } : {}) }
    await validateMediaPayload(item, bytes, { packageBacked: true })
    assertCurrent()
    media.push(item); payloads.push({ archivePath, bytes })
  }
  return { media, payloads, externalLinks: externalMediaInventory(urls, new Set(local.map((item) => item.url))),
    ...(local.some((item) => !item.url.startsWith('/uploads/')) ? { sourceOrigin: origin } : {}) }
}

module.exports = { collectOwnedArchiveMedia }
