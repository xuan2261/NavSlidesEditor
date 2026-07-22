const express = require('express')
const uuidv4 = () => require('node:crypto').randomUUID()
const fs = require('fs-extra')
const path = require('path')
const { readPresentations, withPresentations, HISTORY_DIR } = require('../services/storage')
const {
  getRestorablePackageHead,
  packageOwnerExists,
  releasePackageOwnerWithRetry,
  retainPackageHead,
  restorePackageForward,
} = require('../services/package-lifecycle-integration')
const { toPresentationEditorDto } = require('../services/pptx-import/package-store/dto')
const { hashRecord } = require('../services/pptx-import/package-store/schemas')
const { drainPackageCompatibilityOutbox } = require('../services/pptx-import/package-store-runtime')
const {
  readAuthoritativePresentation,
  resolvePackageBackedRead,
} = require('../services/package-backed-presentation-read')
const { withHistoryLock } = require('../services/history-lock')

const router = express.Router()

const SNAPSHOT_CAP = 50

// Write a snapshot of `pres` into HISTORY_DIR/<id>/<uuid>.json, then prune the
// oldest snapshots beyond SNAPSHOT_CAP. Shared by the snapshot route and the
// auto before-restore path so both stay consistent.
function historyOwner(presId, snapshotId) {
  return { ownerType: 'history', ownerId: `${presId}:${snapshotId}` }
}

function safePathSegment(value) {
  return typeof value === 'string' &&
    value.length > 0 &&
    value !== '.' &&
    value !== '..' &&
    !/[\\/\0]/.test(value)
}

function requireSafeHistoryParams(req, res, names) {
  if (names.every((name) => safePathSegment(req.params[name]))) return true
  res.status(400).json({ error: 'Invalid history identifier' })
  return false
}

async function writeSnapshot(presId, pres, name, { preserveSnapshotId } = {}) {
  const snapshotData = JSON.parse(JSON.stringify(pres))
  const expectedHead = snapshotData.pptxAggregateHead
  if (expectedHead?.pendingJournalHash !== undefined) {
    throw Object.assign(new Error('Cannot snapshot a pending package projection'), {
      code: 'PACKAGE_PENDING_PROJECTION',
      status: 409,
    })
  }
  const presDir = path.join(HISTORY_DIR, presId)
  await fs.ensureDir(presDir)
  const snapshotId = uuidv4()
  const owner = historyOwner(presId, snapshotId)
  let retainedHead
  try {
    retainedHead = await retainPackageHead(owner, presId, {
      ...(expectedHead ? { expectedHead } : {}),
    })
  } catch (error) {
    try {
      await releasePackageOwnerWithRetry(owner)
    } catch (releaseError) {
      throw Object.assign(new AggregateError(
        [error, releaseError],
        'History snapshot retention and rollback failed'
      ), {
        code: 'PACKAGE_LIFECYCLE_ROLLBACK_FAILED',
        status: 503,
      })
    }
    throw error
  }
  if (expectedHead && !retainedHead) {
    throw Object.assign(new Error('Package-backed presentation head is unavailable'), {
      code: 'PRESENTATION_PACKAGE_HEAD_UNAVAILABLE',
      status: 409,
    })
  }
  if (expectedHead && hashRecord(retainedHead) !== hashRecord(expectedHead)) {
    try {
      await releasePackageOwnerWithRetry(owner)
    } catch (releaseError) {
      throw Object.assign(new AggregateError(
        [releaseError],
        'History snapshot retention rollback failed'
      ), {
        code: 'PACKAGE_LIFECYCLE_ROLLBACK_FAILED',
        status: 503,
      })
    }
    throw Object.assign(new Error('Package-backed presentation head changed during snapshot'), {
      code: 'STALE_GENERATION',
      status: 409,
    })
  }
  const snapshot = {
    id: snapshotId,
    name: name || new Date().toISOString(),
    createdAt: new Date().toISOString(),
    data: snapshotData,
    packageBacked: Boolean(retainedHead),
  }
  try {
    await fs.writeJson(path.join(presDir, `${snapshotId}.json`), snapshot, { spaces: 2 })
  } catch (error) {
    if (retainedHead) {
      try {
        await releasePackageOwnerWithRetry(owner)
      } catch (releaseError) {
        throw Object.assign(new AggregateError(
          [error, releaseError],
          'History snapshot persistence and package retention rollback failed'
        ), {
          code: 'PACKAGE_LIFECYCLE_ROLLBACK_FAILED',
          status: 503,
        })
      }
    }
    throw error
  }
  await pruneSnapshots(presDir, { preserveSnapshotId })
  return snapshot
}

// Keep only the newest SNAPSHOT_CAP snapshots per presentation. Ordering uses
// the embedded createdAt (falls back to filename) so pruning is deterministic
// regardless of filesystem read order. A restore target can be excluded from
// this pass so the automatic pre-restore snapshot never deletes the target.
async function pruneSnapshots(presDir, { preserveSnapshotId } = {}) {
  let files
  try {
    files = (await fs.readdir(presDir)).filter((f) => f.endsWith('.json'))
  } catch {
    return
  }
  if (files.length <= SNAPSHOT_CAP) return

  const entries = []
  for (const f of files) {
    let createdAt = ''
    try {
      createdAt = (await fs.readJson(path.join(presDir, f))).createdAt || ''
    } catch {}
    entries.push({ f, createdAt })
  }
  entries.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)) || a.f.localeCompare(b.f))
  const candidates = preserveSnapshotId
    ? entries.filter((entry) => path.basename(entry.f, '.json') !== preserveSnapshotId)
    : entries
  const excess = candidates.slice(0, entries.length - SNAPSHOT_CAP)
  for (const entry of excess) {
    await removeSnapshot(presDir, path.basename(entry.f, '.json'))
  }
}

async function removeSnapshot(presDir, snapshotId) {
  const snapFile = path.join(presDir, `${snapshotId}.json`)
  const snapshot = await fs.readJson(snapFile)
  const owner = historyOwner(path.basename(presDir), snapshotId)
  await fs.remove(snapFile)
  try {
    await releasePackageOwnerWithRetry(owner)
  } catch (error) {
    let ownerRemains = false
    let ownerStatusKnown = false
    try {
      ownerRemains = await packageOwnerExists(owner)
      ownerStatusKnown = true
    } catch {}
    if (ownerRemains || !ownerStatusKnown) {
      try {
        await fs.writeJson(snapFile, {
          ...snapshot,
          packageReleasePending: true,
        }, { spaces: 2 })
      } catch (restoreError) {
        throw new AggregateError(
          [error, restoreError],
          'History snapshot removal and file restoration failed'
        )
      }
    }
    throw error
  }
}

// POST /api/presentations/:id/snapshot
router.post('/:id/snapshot', async (req, res, next) => {
  if (!requireSafeHistoryParams(req, res, ['id'])) return
  try {
    const snapshot = await withHistoryLock(req.params.id, async () => {
      const resolved = await readAuthoritativePresentation(req.params.id)
      if (!resolved) return null
      return writeSnapshot(req.params.id, resolved.presentation, req.body.name)
    })
    if (!snapshot) return res.status(404).json({ error: 'Not found' })
    res.json({ id: snapshot.id, name: snapshot.name, createdAt: snapshot.createdAt })
  } catch (err) {
    next(err)
  }
})

// GET /api/presentations/:id/snapshots
router.get('/:id/snapshots', async (req, res, next) => {
  if (!requireSafeHistoryParams(req, res, ['id'])) return
  try {
    const presDir = path.join(HISTORY_DIR, req.params.id)
    if (!(await fs.pathExists(presDir))) return res.json([])
    const files = (await fs.readdir(presDir)).filter((f) => f.endsWith('.json'))
    const snapshots = []
    for (const f of files) {
      try {
        const s = await fs.readJson(path.join(presDir, f))
        snapshots.push({
          id: s.id,
          name: s.name,
          createdAt: s.createdAt,
          slideCount: (s.data?.slides || []).length,
        })
      } catch {}
    }
    // Newest first.
    snapshots.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    res.json(snapshots)
  } catch (err) {
    next(err)
  }
})

// POST /api/presentations/:id/restore/:snapshotId
// Reversible: snapshots the CURRENT deck as "Before restore" before overwriting.
// Package lifecycle work stays outside presentation serialization; package-backed
// restores replay their durable compatibility write afterward.
router.post('/:id/restore/:snapshotId', async (req, res, next) => {
  if (!requireSafeHistoryParams(req, res, ['id', 'snapshotId'])) return
  try {
    const result = await withHistoryLock(req.params.id, async () => {
      const presDir = path.join(HISTORY_DIR, req.params.id)
      const snapFile = path.join(presDir, `${req.params.snapshotId}.json`)
      if (!(await fs.pathExists(snapFile))) {
        return { status: 404, body: { error: 'Snapshot not found' } }
      }
      const snapshot = await fs.readJson(snapFile)
      if (snapshot.packageReleasePending) {
        throw Object.assign(new Error('Snapshot package ownership release is pending'), {
          code: 'HISTORY_PACKAGE_RELEASE_PENDING',
          status: 503,
        })
      }

      const currentResolved = await readAuthoritativePresentation(req.params.id)
      if (!currentResolved) return { status: 404, body: { error: 'Presentation not found' } }
      const currentStored = (await readPresentations()).find((item) => item.id === req.params.id)
      if (!currentStored) return { status: 404, body: { error: 'Presentation not found' } }
      const current = currentResolved.presentation
      const currentStoredHash = hashRecord(currentStored)
      if (current.pptxAggregateHead && !snapshot.packageBacked) {
        throw Object.assign(new Error('Legacy snapshots cannot replace a package-backed presentation'), {
          code: 'SNAPSHOT_PACKAGE_HEAD_REQUIRED',
        })
      }
      if (snapshot.packageBacked && !(await getRestorablePackageHead(
        req.params.id,
        historyOwner(req.params.id, req.params.snapshotId)
      ))) {
        throw Object.assign(new Error('Snapshot package head is unavailable'), {
          code: 'SNAPSHOT_PACKAGE_HEAD_UNAVAILABLE',
        })
      }
      if (current.pptxAggregateHead?.pendingJournalHash !== undefined) {
        throw Object.assign(new Error('Cannot restore while the current package projection is pending'), {
          code: 'PACKAGE_PENDING_PROJECTION',
          status: 409,
        })
      }

      // Auto-snapshot the pre-restore state so the restore is reversible.
      await writeSnapshot(
        req.params.id,
        current,
        `Before restore ${new Date().toISOString()}`,
        { preserveSnapshotId: req.params.snapshotId }
      )
      const restored = {
        ...snapshot.data,
        id: req.params.id,
        updatedAt: new Date().toISOString(),
      }
      let restoredHead
      if (snapshot.packageBacked) {
        restoredHead = await restorePackageForward(
          req.params.id,
          historyOwner(req.params.id, req.params.snapshotId),
          {
            compatibilityPresentation: restored,
            ...(current.pptxAggregateHead
              ? { expectedCurrentHead: current.pptxAggregateHead }
              : {}),
          }
        )
        if (!restoredHead) {
          throw Object.assign(new Error('Snapshot package head is unavailable'), {
            code: 'SNAPSHOT_PACKAGE_HEAD_UNAVAILABLE',
          })
        }
        restored.pptxAggregateHead = restoredHead
        await drainPackageCompatibilityOutbox()
      } else {
        const applied = await withPresentations((presentations) => {
          const index = presentations.findIndex((item) => item.id === req.params.id)
          if (index === -1) return false
          if (hashRecord(presentations[index]) !== currentStoredHash) {
            throw Object.assign(new Error('Presentation changed during restore'), {
              code: 'STALE_GENERATION',
              status: 409,
              retryable: true,
            })
          }
          presentations[index] = restored
          return true
        })
        if (!applied) return { status: 404, body: { error: 'Presentation not found' } }
      }

      const resolved = snapshot.packageBacked
        ? await resolvePackageBackedRead(req.params.id, restored)
        : { presentation: restored, generation: undefined }
      return {
        status: 200,
        body: toPresentationEditorDto(resolved.presentation, {
          aggregateGeneration: resolved.generation,
        }),
      }
    })
    res.status(result.status).json(result.body)
  } catch (err) {
    next(err)
  }
})

// DELETE /api/presentations/:id/snapshots/:snapshotId
router.delete('/:id/snapshots/:snapshotId', async (req, res, next) => {
  if (!requireSafeHistoryParams(req, res, ['id', 'snapshotId'])) return
  try {
    await withHistoryLock(req.params.id, async () => {
      const presDir = path.join(HISTORY_DIR, req.params.id)
      const snapFile = path.join(presDir, `${req.params.snapshotId}.json`)
      if (await fs.pathExists(snapFile)) {
        await removeSnapshot(presDir, req.params.snapshotId)
      }
    })
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

module.exports = router
