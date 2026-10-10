const path = require('node:path')
const fs = require('fs-extra')
const { DATA_DIR, UPLOADS_DIR, withFileLock } = require('./storage')
const { CAPABILITY_SCOPE } = require('./project-import-capability')
const { assertArchivePath } = require('./project-import-archive-validation')
const { PROJECT_IMPORT_LIMITS } = require('./project-import-archive-limits')
const { assertStagingShape } = require('./project-import-staging-ownership')
const { validateHead } = require('./pptx-import/package-store/schemas')

const SESSION_FILE = path.join(DATA_DIR, 'project-import-sessions.json')
let counter = 0
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu
const HASH = /^[a-f0-9]{64}$/u
const STATES = new Set(['pending', 'committing', 'committed', 'rolled-back', 'reconcile-required'])
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const text = (value) => typeof value === 'string' && value.length > 0
const timestamp = (value) => text(value) && Number.isFinite(Date.parse(value))

function recoveryError(cause) {
  return Object.assign(new Error('Project import ledger requires recovery. Back up the data root, inspect the retained ledger, repair the prerequisite, and restart.', { cause }), {
    code: 'PROJECT_IMPORT_RECOVERY_REQUIRED', status: 503,
  })
}

function requireShape(condition) {
  if (!condition) throw new TypeError('Invalid project import session record')
}

function validatePresentation(presentation) {
  requireShape(object(presentation) && Array.isArray(presentation.slides))
  const pending = [presentation.slides]
  let slides = 0
  let elements = 0
  while (pending.length) {
    for (const slide of pending.pop()) {
      requireShape(object(slide) && ++slides <= PROJECT_IMPORT_LIMITS.maxSlides &&
        (slide.elements === undefined || Array.isArray(slide.elements)))
      for (const element of slide.elements || []) {
        requireShape(object(element) && text(element.type) && ++elements <= PROJECT_IMPORT_LIMITS.maxElements &&
          (element.tracks === undefined || Array.isArray(element.tracks) && element.tracks.every(object)))
      }
      if (slide.children !== undefined) {
        requireShape(Array.isArray(slide.children))
        pending.push(slide.children)
      }
    }
  }
}

function validateRecord(key, record) {
  requireShape(object(record) && UUID.test(key) && record.sessionId === key && STATES.has(record.state))
  const terminal = record.state === 'committed' || record.state === 'rolled-back'
  if (!terminal) assertStagingShape(record)
  requireShape(record.scope === CAPABILITY_SCOPE && /^[a-f0-9]{32}$/u.test(record.capabilitySalt))
  requireShape(HASH.test(record.archiveDigest) && HASH.test(record.payloadDigest))
  requireShape(timestamp(record.createdAt) && timestamp(record.expiresAt) &&
    Date.parse(record.expiresAt) > Date.parse(record.createdAt))
  requireShape(Array.isArray(record.activeContent) && record.activeContent.every((item) => typeof item === 'string') &&
    Array.isArray(record.warnings) && typeof record.trustedAuthorActiveContentAcknowledged === 'boolean')
  requireShape(Array.isArray(record.placements))
  requireShape(terminal ? HASH.test(record.replayHash) && timestamp(record.revokedAt) &&
    record.capabilityHash === undefined : HASH.test(record.capabilityHash) && record.revokedAt === null)
  if (record.state === 'committing' || record.state === 'committed' || record.commitStartedAt !== undefined) {
    requireShape(UUID.test(record.intendedPresentationId) && UUID.test(record.leaseId) && timestamp(record.commitStartedAt))
  }
  if (record.state === 'committed') requireShape(timestamp(record.committedAt))
  if (record.state === 'rolled-back') requireShape(timestamp(record.rolledBackAt))
  if (record.state === 'reconcile-required') requireShape(text(record.reconcileReason))
  if (record.packageOutcome !== undefined) {
    requireShape(object(record.packageOutcome) && object(record.packageOutcome.head))
    validateHead(record.packageOutcome.head)
    requireShape(record.packageOutcome.head.presentationId === record.intendedPresentationId)
    requireShape(HASH.test(record.packageOutcome.originalSha256) &&
      Number.isSafeInteger(record.packageOutcome.originalByteLength) && record.packageOutcome.originalByteLength >= 0)
    if (!terminal) requireShape(record.packageBundlePath !== undefined && record.presentation?.id === record.intendedPresentationId)
  }
  const media = new Map()
  if (!terminal) {
    validatePresentation(record.presentation)
    requireShape(Array.isArray(record.media) && record.media.length <= PROJECT_IMPORT_LIMITS.maxMedia)
    for (const item of record.media) {
      requireShape(object(item) && text(item.archivePath) && text(item.originalUrl) &&
        text(item.stagingPath) && path.isAbsolute(item.stagingPath) && !media.has(item.archivePath))
      assertArchivePath(item.archivePath, PROJECT_IMPORT_LIMITS, { packageBacked: record.packageBundlePath !== undefined })
      requireShape(item.sha256 === undefined || HASH.test(item.sha256))
      requireShape(item.byteLength === undefined || Number.isSafeInteger(item.byteLength) && item.byteLength >= 0)
      requireShape(item.mimeType == null || typeof item.mimeType === 'string')
      media.set(item.archivePath, item)
    }
  }
  const placed = new Set()
  for (const item of record.placements) {
    requireShape(object(item) && text(item.archivePath) && !placed.has(item.archivePath) &&
      ['new', 'reused'].includes(item.ownership) && HASH.test(item.sha256) && text(item.filename) &&
      path.basename(item.filename) === item.filename && item.filename !== '.' && item.filename !== '..' &&
      text(item.absolutePath) && path.isAbsolute(item.absolutePath) &&
      (terminal || item.absolutePath === path.join(path.resolve(UPLOADS_DIR), item.filename)) &&
      Number.isSafeInteger(item.byteLength) && item.byteLength >= 0)
    if (!terminal) {
      const source = media.get(item.archivePath)
      requireShape(source && item.originalUrl === source.originalUrl &&
        (source.sha256 === undefined || source.sha256 === item.sha256) &&
        (source.byteLength === undefined || source.byteLength === item.byteLength))
    }
    placed.add(item.archivePath)
  }
  if (record.state === 'committing') requireShape(placed.size === media.size)
}

function validateLedger(value) {
  requireShape(object(value))
  for (const [key, record] of Object.entries(value)) validateRecord(key, record)
  return value
}

async function readAllUnlocked() {
  try {
    return validateLedger(await fs.readJson(SESSION_FILE))
  } catch (error) {
    if (error.code === 'ENOENT') return {}
    throw recoveryError(error)
  }
}

async function writeAllUnlocked(value, signal) {
  let candidate
  try {
    signal?.throwIfAborted()
    validateLedger(value)
    await fs.ensureDir(path.dirname(SESSION_FILE))
    signal?.throwIfAborted()
    candidate = `${SESSION_FILE}.tmp.${process.pid}.${++counter}`
    await fs.writeJson(candidate, value, { spaces: 2, mode: 0o600 })
    signal?.throwIfAborted()
    await fs.rename(candidate, SESSION_FILE)
  } catch (error) {
    if (candidate) {
      try { await fs.unlink(candidate) } catch (cleanupError) {
        if (cleanupError.code !== 'ENOENT') throw recoveryError(cleanupError)
      }
    }
    if (signal?.aborted) throw error
    throw recoveryError(error)
  }
}

async function readSession(sessionId) {
  return withFileLock(SESSION_FILE, async () => {
    const sessions = await readAllUnlocked()
    return sessions[sessionId] ? structuredClone(sessions[sessionId]) : null
  })
}

async function updateSession(sessionId, action, { signal } = {}) {
  signal?.throwIfAborted()
  return withFileLock(SESSION_FILE, async () => {
    signal?.throwIfAborted()
    const sessions = await readAllUnlocked()
    signal?.throwIfAborted()
    const current = sessions[sessionId] || null
    const result = await action(current ? structuredClone(current) : null)
    signal?.throwIfAborted()
    if (result?.record) sessions[sessionId] = result.record
    else if (result?.remove) delete sessions[sessionId]
    await writeAllUnlocked(sessions, signal)
    return result?.value
  })
}

async function listSessions() {
  return withFileLock(SESSION_FILE, async () => Object.values(await readAllUnlocked()))
}

module.exports = { SESSION_FILE, listSessions, readSession, updateSession }
