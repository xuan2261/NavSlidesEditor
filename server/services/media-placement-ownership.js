const crypto = require('node:crypto')
const path = require('node:path')
const fs = require('fs-extra')
const { UPLOADS_DIR, UPLOAD_HASHES_FILE, withFileLock, withUploadHashes } = require('./storage')
const { inspectPath, stagingError } = require('./project-import-staging-ownership')

const OWNER_SCOPE = 'project-import'
const OWNER_SCOPES = new Set([OWNER_SCOPE, 'pptx-import'])

function ownershipKey(ownerId, scope) {
  if (typeof ownerId !== 'string' || !ownerId || !OWNER_SCOPES.has(scope)) {
    throw new TypeError('Media placement requires an exact supported owner')
  }
  return `${scope}:${ownerId}`
}

function exactOwner(record, ownerKey) {
  return record?.placementOwner === ownerKey && record?.state === 'pending'
}

async function placeMedia({
  ownerId, bytes, originalName, mimeType, sourceKey, scope = OWNER_SCOPE,
  uploadsDir = UPLOADS_DIR, signal, mediaBudget,
}) {
  const ownerKey = ownershipKey(ownerId, scope)
  const root = path.resolve(uploadsDir)
  signal?.throwIfAborted?.()
  const data = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes)
  const sha256 = crypto.createHash('sha256').update(data).digest('hex')
  const election = await withUploadHashes(async (hashes) => {
    signal?.throwIfAborted?.()
    const global = hashes.global || {}
    const owned = Object.values(global).find((record) =>
      exactOwner(record, ownerKey) && record.sha256 === sha256
    )
    if (owned) return { ownership: 'new', record: owned, deduped: true }
    const reusable = global[sha256]
    if (reusable?.state === 'committed') {
      if (await fs.pathExists(path.join(root, path.basename(reusable.filename)))) {
        return { ownership: 'reused', record: reusable, deduped: true }
      }
    }
    if (mediaBudget && !mediaBudget.tryReserve(data.length)) return { budgetExceeded: true }
    const filename = `${crypto.createHash('sha256')
      .update(`${ownerKey}:${sourceKey || ''}:${sha256}`)
      .digest('hex')}${safeExtension(originalName)}`
    const record = {
      filename, originalName: path.basename(String(originalName || 'asset')),
      size: data.length, mimeType: String(mimeType || 'application/octet-stream'),
      uploadedAt: new Date().toISOString(), placementOwner: ownerKey,
      state: 'pending', sha256, sourceKey,
    }
    global[`${sha256}:${ownerKey}:${filename}`] = record
    hashes.global = global
    return { ownership: 'new', record, deduped: false }
  })
  if (election.budgetExceeded) return election
  const record = election.record
  const absolutePath = path.join(root, path.basename(record.filename))
  if (election.ownership === 'new') {
    // The pending intent is durable before bytes; serialize materialization
    // separately under the existing hash lock, never under package/JSON locks.
    await withFileLock(UPLOAD_HASHES_FILE, async () => {
      signal?.throwIfAborted?.()
      const hashes = await fs.readJson(UPLOAD_HASHES_FILE)
      const current = hashes.global?.[`${sha256}:${ownerKey}:${record.filename}`]
      if (!exactOwner(current, ownerKey) || current.sha256 !== sha256) {
        throw Object.assign(new Error('Media placement ownership changed'), {
          code: 'MEDIA_PLACEMENT_OWNERSHIP_CHANGED',
        })
      }
      if (!await fs.pathExists(absolutePath)) {
        await fs.ensureDir(root)
        const candidate = `${absolutePath}.${scope}-part`
        await fs.writeFile(candidate, data)
        signal?.throwIfAborted?.()
        await fs.rename(candidate, absolutePath)
      }
    })
  }
  return {
    ownership: election.ownership, deduped: election.deduped,
    filename: record.filename, absolutePath, sha256,
    byteLength: data.length, mimeType: record.mimeType, sourceKey,
  }
}

function safeExtension(name) {
  const extension = path.extname(String(name || '')).toLowerCase()
  return /^[.][a-z0-9]{1,8}$/u.test(extension) ? extension : ''
}

async function commitOwner(ownerId, presentationId, { scope = OWNER_SCOPE, signal } = {}) {
  signal?.throwIfAborted()
  const ownerKey = ownershipKey(ownerId, scope)
  if (typeof presentationId !== 'string' || !presentationId) throw new TypeError('Media commit requires a presentation')
  return withUploadHashes(async (hashes) => {
    signal?.throwIfAborted()
    const global = hashes.global || {}
    let committed = 0
    for (const [key, record] of Object.entries(global)) {
      signal?.throwIfAborted()
      if (!exactOwner(record, ownerKey)) continue
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
    return { committed }
  }, { signal })
}

async function inspectRollbackFile(candidate, signal) {
  try {
    const stat = await inspectPath(candidate, { allowMissing: true, signal })
    if (stat && !stat.isFile()) throw stagingError()
  } catch (error) {
    if (signal?.aborted || error.code === 'PROJECT_IMPORT_RECOVERY_REQUIRED') throw error
    throw stagingError(error)
  }
}

async function rollbackOwner(ownerId, { scope = OWNER_SCOPE, uploadsDir = UPLOADS_DIR, signal } = {}) {
  signal?.throwIfAborted()
  const ownerKey = ownershipKey(ownerId, scope)
  const root = path.resolve(uploadsDir)
  return withUploadHashes(async (hashes) => {
    signal?.throwIfAborted()
    const global = hashes.global || {}
    const retained = new Set()
    for (const bucket of Object.values(hashes)) {
      for (const record of Object.values(bucket || {})) {
        if (record?.filename && !exactOwner(record, ownerKey)) retained.add(record.filename)
      }
    }
    const pending = []
    for (const [key, record] of Object.entries(global)) {
      signal?.throwIfAborted()
      if (!exactOwner(record, ownerKey)) continue
      const filename = record.filename
      if (typeof filename !== 'string' || !filename || filename === '.' || filename === '..' || /[\\/:]/u.test(filename)) {
        throw stagingError()
      }
      const files = retained.has(filename) ? [] : [
        path.join(root, filename), path.join(root, `${filename}.${scope}-part`),
      ]
      for (const file of files) await inspectRollbackFile(file, signal)
      pending.push({ key, files })
    }
    // Refuse the entire batch before touching any bytes or ledger entries.
    for (const { key, files } of pending) {
      for (const file of files) {
        await inspectRollbackFile(file, signal)
        signal?.throwIfAborted()
        try { await fs.unlink(file) } catch (error) {
          if (error.code !== 'ENOENT') throw error
        }
        signal?.throwIfAborted()
      }
      signal?.throwIfAborted()
      delete global[key]
    }
    const removed = pending.length
    return { removed }
  }, { signal })
}

module.exports = { commitOwner, placeMedia, rollbackOwner }
