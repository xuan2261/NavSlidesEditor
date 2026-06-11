const express = require('express')
const uuidv4 = () => require('node:crypto').randomUUID()
const fs = require('fs-extra')
const path = require('path')
const { withPresentations, HISTORY_DIR } = require('../services/storage')

const router = express.Router()

const SNAPSHOT_CAP = 50

// Write a snapshot of `pres` into HISTORY_DIR/<id>/<uuid>.json, then prune the
// oldest snapshots beyond SNAPSHOT_CAP. Shared by the snapshot route and the
// auto before-restore path so both stay consistent.
async function writeSnapshot(presId, pres, name) {
  const presDir = path.join(HISTORY_DIR, presId)
  await fs.ensureDir(presDir)
  const snapshotId = uuidv4()
  const snapshot = {
    id: snapshotId,
    name: name || new Date().toISOString(),
    createdAt: new Date().toISOString(),
    data: JSON.parse(JSON.stringify(pres)),
  }
  await fs.writeJson(path.join(presDir, `${snapshotId}.json`), snapshot, { spaces: 2 })
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
  await Promise.all(excess.map((e) => fs.remove(path.join(presDir, e.f)).catch(() => {})))
}

// POST /api/presentations/:id/snapshot
router.post('/:id/snapshot', async (req, res, next) => {
  try {
    let snapshot
    const found = await withPresentations(async (presentations) => {
      const pres = presentations.find((p) => p.id === req.params.id)
      if (!pres) return false
      snapshot = await writeSnapshot(req.params.id, pres, req.body.name)
      return true
    })
    if (!found) return res.status(404).json({ error: 'Not found' })
    res.json({ id: snapshot.id, name: snapshot.name, createdAt: snapshot.createdAt })
  } catch (err) {
    next(err)
  }
})

// GET /api/presentations/:id/snapshots
router.get('/:id/snapshots', async (req, res, next) => {
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
// Reversible + atomic: snapshots the CURRENT deck as "Before restore" before
// overwriting, and does the read-modify-write through withPresentations.
router.post('/:id/restore/:snapshotId', async (req, res, next) => {
  try {
    const presDir = path.join(HISTORY_DIR, req.params.id)
    const snapFile = path.join(presDir, `${req.params.snapshotId}.json`)
    if (!(await fs.pathExists(snapFile))) {
      return res.status(404).json({ error: 'Snapshot not found' })
    }
    const snapshot = await fs.readJson(snapFile)

    let restored
    let notFound = false
    await withPresentations(async (presentations) => {
      const index = presentations.findIndex((p) => p.id === req.params.id)
      if (index === -1) {
        notFound = true
        return
      }
      // Auto-snapshot the pre-restore state so the restore is reversible.
      await writeSnapshot(
        req.params.id,
        presentations[index],
        `Before restore ${new Date().toISOString()}`
      )
      restored = {
        ...snapshot.data,
        id: req.params.id,
        updatedAt: new Date().toISOString(),
      }
      presentations[index] = restored
    })

    if (notFound) return res.status(404).json({ error: 'Presentation not found' })
    res.json(restored)
  } catch (err) {
    next(err)
  }
})

// DELETE /api/presentations/:id/snapshots/:snapshotId
router.delete('/:id/snapshots/:snapshotId', async (req, res, next) => {
  try {
    const snapFile = path.join(HISTORY_DIR, req.params.id, `${req.params.snapshotId}.json`)
    if (await fs.pathExists(snapFile)) await fs.remove(snapFile)
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

module.exports = router
