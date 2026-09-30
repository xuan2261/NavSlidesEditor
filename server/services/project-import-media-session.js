const crypto = require('node:crypto')
const fs = require('fs-extra')
const ownership = require('./media-placement-ownership')
const { readSession, updateSession } = require('./project-import-media-session-store')
const {
  expirePendingProjectImports,
  listReconcileRequiredProjectImports,
  recoverProjectImport,
  recoverProjectImports,
} = require('./project-import-media-session-recovery')
const { withProjectImportSessionLock } = require('./project-import-media-session-lock')
const {
  CAPABILITY_SCOPE,
  hashCapability,
  sessionError,
  verifyCapability,
} = require('./project-import-capability')
const SESSION_TTL_MS = 30 * 60 * 1000

async function createProjectImportSession(validated) {
  const sessionId = crypto.randomUUID()
  const capability = crypto.randomBytes(32).toString('base64url')
  const capabilitySalt = crypto.randomBytes(16).toString('hex')
  const now = Date.now()
  const acknowledged = validated.trustedAuthorActiveContentAcknowledged === true
  const record = {
    sessionId,
    state: 'pending',
    scope: CAPABILITY_SCOPE,
    capabilitySalt,
    capabilityHash: hashCapability(capability, capabilitySalt),
    archiveDigest: validated.archiveDigest,
    payloadDigest: crypto.createHash('sha256')
      .update(`${validated.payloadDigest}:${acknowledged}`)
      .digest('hex'),
    presentation: validated.presentation,
    media: validated.media,
    placements: [],
    activeContent: validated.activeContent,
    warnings: validated.warnings || [],
    trustedAuthorActiveContentAcknowledged:
      acknowledged,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SESSION_TTL_MS).toISOString(),
    revokedAt: null,
  }
  await updateSession(sessionId, () => ({ record }))
  return {
    sessionId,
    capability,
    expiresAt: record.expiresAt,
    mediaCount: record.media.length,
    activeContent: record.activeContent,
    warnings: record.warnings,
    trustedAuthorActiveContentAcknowledged:
      record.trustedAuthorActiveContentAcknowledged,
  }
}

async function stageProjectImportMediaUnlocked({ sessionId, capability }) {
  const record = await readSession(sessionId)
  verifyCapability(record, capability)
  if (record.state !== 'pending') {
    if (record.state === 'committed') return { placed: record.placements.length }
    throw sessionError('PROJECT_IMPORT_NOT_PENDING', 'Import is no longer pending', 409)
  }
  const known = new Set(record.placements.map((item) => item.archivePath))
  for (const media of record.media) {
    if (known.has(media.archivePath)) continue
    const bytes = await fs.readFile(media.stagingPath)
    const placed = await ownership.placeMedia({
      ownerId: sessionId,
      bytes,
      originalName: media.filename || media.archivePath,
      mimeType: media.mimeType,
      sourceKey: media.archivePath,
    })
    record.placements.push({ ...placed, archivePath: media.archivePath, originalUrl: media.originalUrl })
    await updateSession(sessionId, (current) => {
      verifyCapability(current, capability)
      if (current.state !== 'pending') {
        throw sessionError('PROJECT_IMPORT_NOT_PENDING', 'Import is no longer pending', 409)
      }
      return { record: { ...current, placements: record.placements } }
    })
  }
  return { placed: record.placements.length }
}

async function beginProjectImportCommitUnlocked({
  sessionId,
  capability,
  trustedAuthorActiveContentAcknowledged,
}) {
  return updateSession(sessionId, (record) => {
    verifyCapability(record, capability)
    if (record.trustedAuthorActiveContentAcknowledged &&
        trustedAuthorActiveContentAcknowledged !== true) {
      throw sessionError('ACTIVE_CONTENT_ACK_REQUIRED', 'Trusted author acknowledgement must be repeated', 409)
    }
    if (record.state === 'committed') return { record, value: record }
    if (record.state !== 'pending' && record.state !== 'committing') {
      throw sessionError('PROJECT_IMPORT_NOT_PUBLISHABLE', 'Import cannot be published', 409)
    }
    if (record.placements.length !== record.media.length) {
      throw sessionError('PROJECT_IMPORT_MEDIA_INCOMPLETE', 'Import media is incomplete', 409)
    }
    const committing = record.state === 'committing' ? record : {
      ...record,
      state: 'committing',
      intendedPresentationId: crypto.randomUUID(),
      commitStartedAt: new Date().toISOString(),
      leaseId: crypto.randomUUID(),
    }
    return { record: committing, value: committing }
  })
}

async function publishProjectImport(input) {
  return withProjectImportSessionLock(input.sessionId, async () => {
    const record = await beginProjectImportCommitUnlocked(input)
    return record.state === 'committed'
      ? {
          status: 'committed',
          sessionId: record.sessionId,
          presentationId: record.intendedPresentationId,
          warnings: record.warnings || [],
        }
      : recoverProjectImport(record)
  })
}

async function rollbackProjectImportUnlocked({ sessionId, capability }) {
  const record = await readSession(sessionId)
  verifyCapability(record, capability)
  if (record.state === 'rolled-back') return { status: 'rolled-back' }
  if (record.state !== 'pending') {
    throw sessionError('PROJECT_IMPORT_NOT_ROLLBACKABLE', 'Import can no longer be rolled back', 409)
  }
  await ownership.rollbackOwner(sessionId)
  await Promise.all((record.media || []).map((item) => fs.remove(item.stagingPath).catch(() => {})))
  return updateSession(sessionId, (current) => ({
    record: {
      ...current,
      state: 'rolled-back',
      rolledBackAt: new Date().toISOString(),
      replayHash: current.capabilityHash,
      capabilityHash: undefined,
      revokedAt: new Date().toISOString(),
      presentation: undefined,
      media: undefined,
    },
    value: { status: 'rolled-back' },
  }))
}

function stageProjectImportMedia(input) {
  return withProjectImportSessionLock(input.sessionId, () =>
    stageProjectImportMediaUnlocked(input)
  )
}

function beginProjectImportCommit(input) {
  return withProjectImportSessionLock(input.sessionId, () =>
    beginProjectImportCommitUnlocked(input)
  )
}

function rollbackProjectImport(input) {
  return withProjectImportSessionLock(input.sessionId, () =>
    rollbackProjectImportUnlocked(input)
  )
}

module.exports = {
  beginProjectImportCommit,
  createProjectImportSession,
  expirePendingProjectImports,
  listReconcileRequiredProjectImports,
  publishProjectImport,
  readProjectImportSession: readSession,
  recoverProjectImports,
  rollbackProjectImport,
  stageProjectImportMedia,
}
