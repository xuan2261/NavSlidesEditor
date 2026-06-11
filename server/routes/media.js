const express = require('express')
const fs = require('fs-extra')
const path = require('path')
const { UPLOADS_DIR, withMediaDb } = require('../services/storage')

const router = express.Router()

function getMediaType(ext) {
  const imageExts = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico'])
  const videoExts = new Set(['.mp4', '.webm', '.ogg', '.ogv', '.mov', '.avi'])
  const audioExts = new Set(['.mp3', '.wav', '.flac', '.aac', '.m4a'])
  if (imageExts.has(ext)) return 'image'
  if (videoExts.has(ext)) return 'video'
  if (audioExts.has(ext)) return 'audio'
  return 'other'
}

// GET /api/media — list all uploaded media
router.get('/', async (req, res, next) => {
  try {
    // Scan uploads dir and merge with metadata DB
    let db = []
    await withMediaDb((mediaDb) => {
      db = Array.isArray(mediaDb) ? mediaDb.slice() : []
    })
    const dbMap = new Map(db.map((m) => [m.filename, m]))

    if (!(await fs.pathExists(UPLOADS_DIR))) {
      return res.json([])
    }

    const files = await fs.readdir(UPLOADS_DIR)
    const media = []
    for (const filename of files) {
      const filePath = path.join(UPLOADS_DIR, filename)
      const stat = await fs.stat(filePath)
      if (!stat.isFile()) continue
      const ext = path.extname(filename).toLowerCase()
      const existing = dbMap.get(filename)

      media.push({
        id: existing?.id || filename,
        filename,
        originalName: existing?.originalName || filename,
        type: getMediaType(ext),
        size: stat.size,
        tags: existing?.tags || [],
        uploadedAt: existing?.uploadedAt || stat.birthtime.toISOString(),
        url: `/uploads/${filename}`,
      })
    }

    // Filter by query params
    let result = media
    if (req.query.type) {
      result = result.filter((m) => m.type === req.query.type)
    }
    if (req.query.search) {
      const q = req.query.search.toLowerCase()
      result = result.filter(
        (m) =>
          m.originalName.toLowerCase().includes(q) ||
          m.tags.some((t) => t.toLowerCase().includes(q))
      )
    }

    res.json(result)
  } catch (err) {
    next(err)
  }
})

// PUT /api/media/:id — update tags/name
router.put('/:id', async (req, res, next) => {
  try {
    await withMediaDb((db) => {
      const records = Array.isArray(db) ? db : []
      const idx = records.findIndex((m) => m.id === req.params.id || m.filename === req.params.id)
      const update = { tags: req.body.tags, originalName: req.body.originalName }

      if (idx >= 0) {
        records[idx] = { ...records[idx], ...update }
      } else {
        records.push({ id: req.params.id, filename: req.params.id, ...update })
      }

      if (!Array.isArray(db)) {
        db.length = 0
        db.push(...records)
      }
    })
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/media/:filename — delete file + metadata
// The :filename param may be either the DB `id` or the stored `filename`. We
// resolve the matching record first so we delete the right file on disk AND
// the right DB row (previously the DB filter keyed only on `filename`, leaving
// orphaned records/files when the client passed an `id`).
router.delete('/:filename', async (req, res, next) => {
  try {
    const key = req.params.filename
    let targetFilename = key

    await withMediaDb((db) => {
      const records = Array.isArray(db) ? db : []
      const match = records.find((m) => m.id === key || m.filename === key)
      if (match?.filename) targetFilename = match.filename
      const filtered = records.filter((m) => m.id !== key && m.filename !== targetFilename)
      db.length = 0
      db.push(...filtered)
    })

    const filePath = path.join(UPLOADS_DIR, path.basename(targetFilename))
    if (await fs.pathExists(filePath)) {
      await fs.remove(filePath)
    }

    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

module.exports = router
