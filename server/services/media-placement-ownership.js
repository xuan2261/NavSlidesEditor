const crypto = require('node:crypto')
const path = require('node:path')
const fs = require('fs-extra')
const { UPLOADS_DIR, withUploadHashes } = require('./storage')

const OWNER_SCOPE = 'project-import'

function safeExtension(name) {
  const extension = path.extname(String(name || '')).toLowerCase()
  return /^[.][a-z0-9]{1,8}$/u.test(extension) ? extension : ''
}

function ownershipKey(ownerId) {
  return `${OWNER_SCOPE}:${ownerId}`
}

function exactOwner(record, ownerId) {
  return record?.placementOwner === ownershipKey(ownerId) && record?.state === 'pending'
}

async function placeMedia({ ownerId, bytes, originalName, mimeType, sourceKey }) {
  const data = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes)
  const sha256 = crypto.createHash('sha256').update(data).digest('hex')
  const election = await withUploadHashes(async (hashes) => {
    const global = hashes.global || {}
    const owned = Object.values(global).find((record) =>
      exactOwner(record, ownerId) && record.sha256 === sha256 && record.sourceKey === sourceKey
    )
    if (owned) {
      return {
        ownership: 'new', record: owned,
      }
    }
    const reusable = global[sha256]
    if (reusable?.state === 'committed') {
      const existingPath = path.join(UPLOADS_DIR, path.basename(reusable.filename))
      if (await fs.pathExists(existingPath)) {
        return {
          ownership: 'reused',
          record: reusable,
        }
      }
      delete global[sha256]
    }
    const filename = `${crypto.createHash('sha256')
      .update(`${ownershipKey(ownerId)}:${sourceKey || ''}:${sha256}`)
      .digest('hex')}${safeExtension(originalName)}`
    const record = {
      filename,
      originalName: path.basename(String(originalName || 'asset')),
      size: data.length,
      mimeType: String(mimeType || 'application/octet-stream'),
      uploadedAt: new Date().toISOString(),
      placementOwner: ownershipKey(ownerId),
      state: 'pending',
      sha256,
      sourceKey,
    }
    global[`${sha256}:${ownershipKey(ownerId)}:${filename}`] = record
    hashes.global = global
    return { ownership: 'new', record }
  })
  const record = election.record
  const absolutePath = path.join(UPLOADS_DIR, path.basename(record.filename))
  if (election.ownership === 'new' && !await fs.pathExists(absolutePath)) {
    await fs.ensureDir(UPLOADS_DIR)
    const candidate = `${absolutePath}.project-import-part`
    await fs.writeFile(candidate, data)
    await fs.rename(candidate, absolutePath)
  }
  return {
    ownership: election.ownership,
    filename: record.filename,
    absolutePath,
    sha256,
    byteLength: data.length,
    mimeType: record.mimeType,
    sourceKey,
  }
}

async function commitOwner(ownerId, presentationId) {
  return withUploadHashes(async (hashes) => {
    const global = hashes.global || {}
    let committed = 0
    for (const [key, record] of Object.entries(global)) {
      if (!exactOwner(record, ownerId)) continue
      delete global[key]
      const committedKey = global[record.sha256]?.state === 'committed'
        ? `${record.sha256}:committed:${record.filename}`
        : record.sha256
      global[committedKey] = {
        ...record,
        state: 'committed',
        presentationId,
        placementOwner: undefined,
        committedAt: new Date().toISOString(),
      }
      committed += 1
    }
    hashes.global = global
    return { committed }
  })
}

async function rollbackOwner(ownerId) {
  return withUploadHashes(async (hashes) => {
    const global = hashes.global || {}
    let removed = 0
    for (const [key, record] of Object.entries(global)) {
      if (!exactOwner(record, ownerId)) continue
      const absolutePath = path.join(UPLOADS_DIR, path.basename(record.filename))
      if (path.dirname(absolutePath) === path.resolve(UPLOADS_DIR)) {
        await fs.remove(absolutePath)
        await fs.remove(`${absolutePath}.project-import-part`)
      }
      delete global[key]
      removed += 1
    }
    hashes.global = global
    return { removed }
  })
}

module.exports = { commitOwner, placeMedia, rollbackOwner }
