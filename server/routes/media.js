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
router.get('/', async (req, res) => {
  try {
    // Scan uploads dir and merge with metadata DB
    let db = []
    await withMediaDb((mediaDb) => {
      db = Array.isArray(mediaDb) ? mediaDb.slice() : []
    })
    const dbMap = new Map(db.map((m) => [m.filename, m]))

    if (!fs.existsSync(UPLOADS_DIR)) {
      return res.json([])
    }

    const files = fs.readdirSync(UPLOADS_DIR)
    const media = files.map((filename) => {
      const filePath = path.join(UPLOADS_DIR, filename)
      const stat = fs.statSync(filePath)
      const ext = path.extname(filename).toLowerCase()
      const existing = dbMap.get(filename)

      return {
        id: existing?.id || filename,
        filename,
        originalName: existing?.originalName || filename,
        type: getMediaType(ext),
        size: stat.size,
        tags: existing?.tags || [],
        uploadedAt: existing?.uploadedAt || stat.birthtime.toISOString(),
        url: `/uploads/${filename}`,
      }
    })

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
    console.error('Media list error:', err)
    res.status(500).json({ error: 'Failed to list media' })
  }
})

// PUT /api/media/:id — update tags/name
router.put('/:id', async (req, res) => {
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
    // eslint-disable-next-line unused-imports/no-unused-vars
  } catch (err) {
    res.status(500).json({ error: 'Failed to update media' })
  }
})

// DELETE /api/media/:filename — delete file + metadata
router.delete('/:filename', async (req, res) => {
  try {
    const filePath = path.join(UPLOADS_DIR, path.basename(req.params.filename))
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }

    await withMediaDb((db) => {
      const records = Array.isArray(db) ? db : []
      const filtered = records.filter((m) => m.filename !== req.params.filename)
      db.length = 0
      db.push(...filtered)
    })

    res.json({ success: true })
    // eslint-disable-next-line unused-imports/no-unused-vars
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete media' })
  }
})

module.exports = router
