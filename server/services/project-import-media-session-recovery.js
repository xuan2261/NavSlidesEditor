const fs = require('fs-extra')
const { readPresentations, withPresentations } = require('./storage')
const ownership = require('./media-placement-ownership')
const { buildImportedPresentation } = require('./project-import-presentation')
const {
  listSessions,
  updateSession,
} = require('./project-import-media-session-store')
const { withProjectImportSessionLock } = require('./project-import-media-session-lock')

async function recoverProjectImport(record) {
  const expected = buildImportedPresentation(record)
  const existing = (await readPresentations()).find((item) =>
    item.id === record.intendedPresentationId
  )
  if (existing && (existing._projectImport?.sessionId !== record.sessionId ||
      existing._projectImport?.payloadDigest !== record.payloadDigest)) {
    await updateSession(record.sessionId, (current) => ({
      record: {
        ...current,
        state: 'reconcile-required',
        reconcileReason: 'PRESENTATION_CONFLICT',
      },
    }))
    return { status: 'reconcile-required' }
  }
  if (!existing) {
    await withPresentations((rows) => {
      const current = rows.find((item) => item.id === record.intendedPresentationId)
      if (!current) rows.push(expected)
      else if (current._projectImport?.sessionId !== record.sessionId) {
        throw Object.assign(new Error('Presentation identity conflicts'), {
          code: 'PROJECT_IMPORT_PRESENTATION_CONFLICT',
          status: 409,
        })
      }
    })
  }
  await ownership.commitOwner(record.sessionId, record.intendedPresentationId)
  await Promise.all((record.media || []).map((item) =>
    fs.remove(item.stagingPath).catch(() => {})
  ))
  return updateSession(record.sessionId, (current) => {
    const committed = {
      ...current,
      state: 'committed',
      committedAt: new Date().toISOString(),
      replayHash: current.capabilityHash,
      capabilityHash: undefined,
      revokedAt: new Date().toISOString(),
      presentation: undefined,
      media: undefined,
    }
    return {
      record: committed,
      value: {
        status: 'committed',
        sessionId: committed.sessionId,
        presentationId: committed.intendedPresentationId,
        warnings: committed.warnings || [],
      },
    }
  })
}

async function recoverProjectImports() {
  const results = []
  for (const record of await listSessions()) {
    if (record.state === 'committing') {
      results.push(await withProjectImportSessionLock(record.sessionId, () =>
        recoverProjectImport(record)
      ))
    }
  }
  return results
}

async function expirePendingProjectImports(now = Date.now()) {
  const results = []
  for (const record of await listSessions()) {
    if (record.state !== 'pending' || Date.parse(record.expiresAt) > now) continue
    await withProjectImportSessionLock(record.sessionId, async () => {
      await ownership.rollbackOwner(record.sessionId)
      await Promise.all((record.media || []).map((item) =>
        fs.remove(item.stagingPath).catch(() => {})
      ))
      await updateSession(record.sessionId, (current) => ({
        record: {
          ...current,
          state: 'rolled-back',
          rolledBackAt: new Date(now).toISOString(),
          replayHash: current.capabilityHash,
          capabilityHash: undefined,
          revokedAt: new Date(now).toISOString(),
          presentation: undefined,
          media: undefined,
        },
      }))
    })
    results.push(record.sessionId)
  }
  return results
}

async function listReconcileRequiredProjectImports() {
  return (await listSessions()).filter((record) => record.state === 'reconcile-required')
}

module.exports = {
  expirePendingProjectImports,
  listReconcileRequiredProjectImports,
  recoverProjectImport,
  recoverProjectImports,
}
