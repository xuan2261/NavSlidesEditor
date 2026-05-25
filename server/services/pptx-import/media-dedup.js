const crypto = require('crypto')
const fs = require('fs-extra')
const path = require('path')
const uuidv4 = () => require('node:crypto').randomUUID()
const { DATA_DIR, withFileLock } = require('../storage')

const HASHES_FILE = path.join(DATA_DIR, 'upload-hashes.json')
const IMPORT_BUCKET = 'pptx-import'

function hashBuffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

async function loadHashes() {
  try {
    return await fs.readJson(HASHES_FILE)
  } catch {
    return {}
  }
}

async function saveHashes(hashes) {
  await fs.ensureDir(path.dirname(HASHES_FILE))
  await fs.writeJson(HASHES_FILE, hashes, { spaces: 2 })
}

function findHashEntry(hashes, hash) {
  for (const [bucket, entries] of Object.entries(hashes || {})) {
    if (entries?.[hash]?.filename) return { bucket, entry: entries[hash] }
  }
  return null
}

async function persistDedupedBuffer(buffer, ext, uploadsDir, metadata = {}) {
  metadata.signal?.throwIfAborted?.()
  const hash = hashBuffer(buffer)
  return withFileLock(HASHES_FILE, async () => {
    metadata.signal?.throwIfAborted?.()
    const hashes = await loadHashes()
    const existing = findHashEntry(hashes, hash)
    if (existing) {
      const existingPath = path.join(uploadsDir, existing.entry.filename)
      try {
        await fs.access(existingPath)
        return { url: `/uploads/${existing.entry.filename}`, deduped: true }
      } catch {
        delete hashes[existing.bucket][hash]
      }
    }

    await fs.ensureDir(uploadsDir)
    const filename = `${uuidv4()}.${ext}`
    const filePath = path.join(uploadsDir, filename)
    metadata.signal?.throwIfAborted?.()
    await fs.writeFile(filePath, buffer)
    try {
      metadata.signal?.throwIfAborted?.()
    } catch (err) {
      await fs.unlink(filePath).catch(() => {})
      throw err
    }
    const bucket = hashes[IMPORT_BUCKET] || {}
    bucket[hash] = {
      filename,
      originalName: metadata.originalName || filename,
      size: buffer.length,
      mimeType: metadata.mimeType,
      uploadedAt: new Date().toISOString(),
    }
    hashes[IMPORT_BUCKET] = bucket
    await saveHashes(hashes)
    try {
      metadata.signal?.throwIfAborted?.()
    } catch (err) {
      delete bucket[hash]
      if (Object.keys(bucket).length === 0) delete hashes[IMPORT_BUCKET]
      await saveHashes(hashes).catch(() => {})
      await fs.unlink(filePath).catch(() => {})
      throw err
    }
    return { url: `/uploads/${filename}`, deduped: false }
  })
}

module.exports = {
  persistDedupedBuffer,
}
