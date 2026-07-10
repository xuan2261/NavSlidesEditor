const crypto = require('crypto')
const fs = require('fs-extra')
const path = require('path')
const uuidv4 = () => require('node:crypto').randomUUID()
const { withUploadHashes } = require('../storage')
const IMPORT_BUCKET = 'pptx-import'

function hashBuffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

function findHashEntry(hashes, hash) {
  for (const [bucket, entries] of Object.entries(hashes || {})) {
    if (entries?.[hash]?.filename) return { bucket, entry: entries[hash] }
  }
  return null
}

function createMediaTransaction() {
  const records = []
  let closed = false
  return {
    record(record) {
      if (closed) throw new Error('PPTX media transaction is already closed')
      records.push(record)
    },
    async commit() {
      closed = true
      records.length = 0
    },
    async rollback() {
      if (closed) return
      closed = true
      await withUploadHashes(async (hashes) => {
        for (const record of records) {
          const entry = hashes[record.bucket]?.[record.hash]
          if (entry?.filename === record.filename) delete hashes[record.bucket][record.hash]
          if (hashes[record.bucket] && Object.keys(hashes[record.bucket]).length === 0) {
            delete hashes[record.bucket]
          }
        }
      })
      await Promise.all(records.map((record) => fs.unlink(record.filePath).catch(() => {})))
      records.length = 0
    },
  }
}

async function persistDedupedBuffer(buffer, ext, uploadsDir, metadata = {}) {
  metadata.signal?.throwIfAborted?.()
  const hash = hashBuffer(buffer)
  let createdFilePath = null
  try {
    return await withUploadHashes(async (hashes) => {
      metadata.signal?.throwIfAborted?.()
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
      createdFilePath = filePath
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
      try {
        metadata.signal?.throwIfAborted?.()
      } catch (err) {
        delete bucket[hash]
        if (Object.keys(bucket).length === 0) delete hashes[IMPORT_BUCKET]
        await fs.unlink(filePath).catch(() => {})
        throw err
      }
      metadata.transaction?.record({ bucket: IMPORT_BUCKET, hash, filename, filePath })
      return { url: `/uploads/${filename}`, deduped: false }
    })
  } catch (err) {
    if (createdFilePath) await fs.unlink(createdFilePath).catch(() => {})
    throw err
  }
}

module.exports = {
  createMediaTransaction,
  persistDedupedBuffer,
}
