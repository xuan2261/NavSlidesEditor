const express = require('express')
const uuidv4 = () => require('node:crypto').randomUUID()
const fs = require('fs-extra')
const path = require('path')
const { readPresentations, withPresentations, HISTORY_DIR } = require('../services/storage')
const {
  getRestorablePackageHead,
  releasePackageOwner,
  retainPackageHead,
  restorePackageForward,
} = require('../services/package-lifecycle-integration')
const { toPresentationEditorDto } = require('../services/pptx-import/package-store/dto')
const { drainPackageCompatibilityOutbox } = require('../services/pptx-import/package-store-runtime')

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

async function writeSnapshot(presId, pres, name) {
  const presDir = path.join(HISTORY_DIR, presId)
  await fs.ensureDir(presDir)
  const snapshotId = uuidv4()
  const owner = historyOwner(presId, snapshotId)
  const retainedHead = await retainPackageHead(owner, presId)
  if (pres?.pptxAggregateHead && !retainedHead) {
    throw Object.assign(new Error('Package-backed presentation head is unavailable'), {
      code: 'PRESENTATION_PACKAGE_HEAD_UNAVAILABLE',
    })
  }
  const snapshot = {
    id: snapshotId,
    name: name || new Date().toISOString(),
    createdAt: new Date().toISOString(),
    data: JSON.parse(JSON.stringify(pres)),
    packageBacked: Boolean(retainedHead),
  }
  try {
    await fs.writeJson(path.join(presDir, `${snapshotId}.json`), snapshot, { spaces: 2 })
  } catch (error) {
    if (retainedHead) {
      try {
        await releasePackageOwner(owner)
      } catch (releaseError) {
        throw new AggregateError(
          [error, releaseError],
          'History snapshot persistence and package retention rollback failed'
        )
      }
    }
    throw error
  }
  await pruneSnapshots(presDir)
  return snapshot
}

// Keep only the newest SNAPSHOT_CAP snapshots per presentation. Ordering uses
// the embedded createdAt (falls back to filename) so pruning is deterministic
// regardless of filesystem read order.
async function pruneSnapshots(presDir) {
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
  const excess = entries.slice(0, entries.length - SNAPSHOT_CAP)
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
    await releasePackageOwner(owner)
  } catch (error) {
    try {
      await fs.writeJson(snapFile, snapshot, { spaces: 2 })
    } catch (restoreError) {
      throw new AggregateError(
        [error, restoreError],
        'History snapshot removal and file restoration failed'
      )
    }
    throw error
  }
}

// POST /api/presentations/:id/snapshot
router.post('/:id/snapshot', async (req, res, next) => {
  if (!requireSafeHistoryParams(req, res, ['id'])) return
  try {
    const presentation = (await readPresentations()).find((item) => item.id === req.params.id)
    if (!presentation) return res.status(404).json({ error: 'Not found' })
    const snapshot = await writeSnapshot(req.params.id, presentation, req.body.name)
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
    const presDir = path.join(HISTORY_DIR, req.params.id)
    const snapFile = path.join(presDir, `${req.params.snapshotId}.json`)
    if (!(await fs.pathExists(snapFile))) {
      return res.status(404).json({ error: 'Snapshot not found' })
    }
    const snapshot = await fs.readJson(snapFile)

    const current = (await readPresentations()).find((item) => item.id === req.params.id)
    if (!current) return res.status(404).json({ error: 'Presentation not found' })
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

    // Auto-snapshot the pre-restore state so the restore is reversible.
    await writeSnapshot(
      req.params.id,
      current,
      `Before restore ${new Date().toISOString()}`
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
        { compatibilityPresentation: restored }
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
        presentations[index] = restored
        return true
      })
      if (!applied) return res.status(404).json({ error: 'Presentation not found' })
    }

    res.json(toPresentationEditorDto(restored, {
      aggregateGeneration: restoredHead?.generation,
    }))
  } catch (err) {
    next(err)
  }
})

// DELETE /api/presentations/:id/snapshots/:snapshotId
router.delete('/:id/snapshots/:snapshotId', async (req, res, next) => {
  if (!requireSafeHistoryParams(req, res, ['id', 'snapshotId'])) return
  try {
    const presDir = path.join(HISTORY_DIR, req.params.id)
    const snapFile = path.join(presDir, `${req.params.snapshotId}.json`)
    if (await fs.pathExists(snapFile)) {
      await removeSnapshot(presDir, req.params.snapshotId)
    }
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

module.exports = router
